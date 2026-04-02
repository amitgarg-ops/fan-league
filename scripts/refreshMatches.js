// scripts/refreshMatches.js
// Runs daily via GitHub Actions at noon PST
// 1. Fetches upcoming IPL matches → saves to Firestore
// 2. Checks completed matches → awards points automatically

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// ── Fix private key formatting ─────────────────────────
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, "\n")
      .replace(/^["']|["']$/g, "")
      .trim()
  : undefined;

// ── Firebase Admin init ────────────────────────────────
initializeApp({
  credential: cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = getFirestore();

// ── IPL Teams config ───────────────────────────────────
const teamConfig = {
  "Mumbai Indians":                  { flag: "🔵", shortName: "MI"   },
  "Chennai Super Kings":             { flag: "🟡", shortName: "CSK"  },
  "Royal Challengers Bengaluru":     { flag: "🔴", shortName: "RCB"  },
  "Royal Challengers Bangalore":     { flag: "🔴", shortName: "RCB"  },
  "Kolkata Knight Riders":           { flag: "🟣", shortName: "KKR"  },
  "Sunrisers Hyderabad":             { flag: "🟠", shortName: "SRH"  },
  "Delhi Capitals":                  { flag: "🔷", shortName: "DC"   },
  "Punjab Kings":                    { flag: "🔴", shortName: "PBKS" },
  "Rajasthan Royals":                { flag: "🩷", shortName: "RR"   },
  "Gujarat Titans":                  { flag: "🔵", shortName: "GT"   },
  "Lucknow Super Giants":            { flag: "🩵", shortName: "LSG"  },
};

const IPL_TEAMS = new Set(Object.keys(teamConfig));

function getTeamConfig(name) {
  return teamConfig[name] || { flag: "🏏", shortName: name?.slice(0, 3).toUpperCase() };
}

function formatMatchTime(dateStr) {
  if (!dateStr) return "Time TBC";
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }) + " IST";

  if (isToday) return `Today · ${timeStr}`;
  if (isTomorrow) return `Tomorrow · ${timeStr}`;

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  }) + ` · ${timeStr}`;
}

// ── Fetch all current IPL matches from CricAPI ─────────
async function fetchAllIPLMatches() {
  const apiKey = process.env.CRICAPI_KEY;
  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`;
  console.log("Fetching matches from CricAPI...");

  const res = await fetch(url);
  const json = await res.json();
  console.log("API status:", json.status, "| Total returned:", json.data?.length || 0);

  if (!json.data) {
    console.log("API error:", JSON.stringify(json));
    return [];
  }

  // Filter for IPL only
  const iplMatches = json.data.filter((m) => {
    const name = (m.name || "").toLowerCase();
    const teams = m.teams || [];
    const hasIPLTeam = teams.some(t => IPL_TEAMS.has(t));
    const hasIPLInName = name.includes("ipl") || name.includes("indian premier");
    return hasIPLTeam || hasIPLInName;
  });

  console.log(`Found ${iplMatches.length} IPL matches`);
  iplMatches.forEach(m => console.log(
    `  → ${m.name} | status: ${m.status} | matchStarted: ${m.matchStarted} | matchEnded: ${m.matchEnded}`
  ));

  return iplMatches;
}

// ── Determine winner from match data ──────────────────
function determineWinner(match) {
  // CricAPI provides a "status" field with the result text
  // e.g. "Mumbai Indians won by 6 wickets"
  const status = (match.status || "").toLowerCase();
  const teams = match.teams || [];

  if (!match.matchEnded) return null;

  for (const team of teams) {
    if (status.includes(team.toLowerCase())) {
      // Make sure it's a win, not just a mention
      if (status.includes("won")) {
        // Check this team won
        const teamIdx = status.indexOf(team.toLowerCase());
        const wonIdx = status.indexOf("won");
        // Team name should appear before "won"
        if (teamIdx < wonIdx || wonIdx - teamIdx < 50) {
          console.log(`Winner detected: ${team} (status: "${match.status}")`);
          return team;
        }
      }
    }
  }

  console.log(`Could not determine winner from status: "${match.status}"`);
  return null;
}

// ── Award points for a completed match ────────────────
async function awardPoints(matchId, winnerName, teams) {
  console.log(`\nAwarding points for match ${matchId}, winner: ${winnerName}`);

  // Check if already scored
  const matchRef = db.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();
  if (matchSnap.exists && matchSnap.data().scored) {
    console.log("Already scored — skipping");
    return;
  }

  // Determine which team (A or B) won
  const matchData = matchSnap.data();
  let winningTeam = null;
  if (matchData) {
    if (matchData.teamA?.name === winnerName) winningTeam = "A";
    else if (matchData.teamB?.name === winnerName) winningTeam = "B";
  }

  if (!winningTeam) {
    console.log(`Could not map winner "${winnerName}" to team A or B`);
    return;
  }

  // Get all picks for this match
  const picksSnap = await db.collection("picks")
    .where("matchId", "==", matchId)
    .get();

  console.log(`Found ${picksSnap.docs.length} picks for this match`);

  let awardedCount = 0;
  const batch = db.batch();

  for (const pickDoc of picksSnap.docs) {
    const pick = pickDoc.data();
    const isCorrect = pick.team === winningTeam;
    const pointsEarned = isCorrect ? pick.pointsIfWin : 0;

    // Update the pick with result
    batch.update(pickDoc.ref, {
      result: isCorrect ? "correct" : "wrong",
      pointsEarned,
      scoredAt: new Date().toISOString(),
    });

    // Update user stats
    const userRef = db.collection("users").doc(pick.userId);
    batch.update(userRef, {
      totalPoints: FieldValue.increment(pointsEarned),
      picksCount: FieldValue.increment(1),
      correctCount: FieldValue.increment(isCorrect ? 1 : 0),
    });

    if (isCorrect) {
      console.log(`  ✅ User ${pick.userId} picked correctly → +${pointsEarned} pts`);
      awardedCount++;
    } else {
      console.log(`  ❌ User ${pick.userId} picked wrong → 0 pts`);
    }
  }

  // Mark match as scored
  batch.update(matchRef, {
    scored: true,
    winner: winnerName,
    winningTeam,
    status: "completed",
    scoredAt: new Date().toISOString(),
  });

  await batch.commit();
  console.log(`✅ Scoring complete! ${awardedCount}/${picksSnap.docs.length} correct picks awarded points`);
}

// ── Save upcoming matches to Firestore ─────────────────
async function saveUpcomingMatches(matches) {
  const upcoming = matches.filter(m => !m.matchEnded && !m.matchStarted);
  console.log(`\nSaving ${upcoming.length} upcoming matches to Firestore...`);

  for (const m of upcoming.slice(0, 10)) {
    const teams = m.teams || [];
    const teamA = teams[0] || "Team A";
    const teamB = teams[1] || "Team B";
    const cfgA = getTeamConfig(teamA);
    const cfgB = getTeamConfig(teamB);

    // Don't overwrite existing match data (preserves pick counts, odds)
    const matchRef = db.collection("matches").doc(m.id);
    const existing = await matchRef.get();

    if (!existing.exists) {
      await matchRef.set({
        id: m.id,
        status: "upcoming",
        time: formatMatchTime(m.dateTimeGMT),
        dateTimeGMT: m.dateTimeGMT || null,
        teamA: { name: teamA, flag: cfgA.flag, shortName: cfgA.shortName, odds: 1.9, picks: 0 },
        teamB: { name: teamB, flag: cfgB.flag, shortName: cfgB.shortName, odds: 1.9, picks: 0 },
        scored: false,
        updatedAt: new Date().toISOString(),
      });
      console.log(`  ✅ Saved new match: ${teamA} vs ${teamB}`);
    } else {
      // Just update the time in case it changed
      await matchRef.update({
        time: formatMatchTime(m.dateTimeGMT),
        status: "upcoming",
        updatedAt: new Date().toISOString(),
      });
      console.log(`  🔄 Updated time: ${teamA} vs ${teamB}`);
    }
  }
}

// ── Process completed matches ──────────────────────────
async function processCompletedMatches(matches) {
  const completed = matches.filter(m => m.matchEnded === true);
  console.log(`\nProcessing ${completed.length} completed matches...`);

  for (const m of completed) {
    const winner = determineWinner(m);
    if (winner) {
      await awardPoints(m.id, winner, m.teams || []);
    }
  }
}

// ── Main ───────────────────────────────────────────────
async function main() {
  console.log("🏏 IPL Fan League — Daily Refresh & Scoring");
  console.log("=============================================");
  console.log("Project:", process.env.VITE_FIREBASE_PROJECT_ID);

  const allMatches = await fetchAllIPLMatches();

  // Process completed matches first (award points)
  await processCompletedMatches(allMatches);

  // Then save upcoming matches
  await saveUpcomingMatches(allMatches);

  console.log("\n✅ All done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});