// scripts/refreshMatches.js
// Run by GitHub Actions daily at noon PST
// Fetches IPL matches from CricAPI and saves to Firestore

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Firebase Admin init ────────────────────────────────
initializeApp({
  credential: cert({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();

// ── Fetch IPL matches from CricAPI ─────────────────────
async function fetchIPLMatches() {
  const apiKey = process.env.CRICAPI_KEY;
  const url = `https://api.cricapi.com/v1/matches?apikey=${apiKey}&offset=0`;

  const res = await fetch(url);
  const json = await res.json();

  if (!json.data) {
    console.log("No data from CricAPI:", json);
    return [];
  }

  // Filter for IPL matches only
  const iplMatches = json.data.filter((m) =>
    m.name?.toLowerCase().includes("ipl") ||
    m.series_id === "d5a498c8-7596-4b93-8ab0-e0efc3345312" // IPL 2026 series ID
  );

  console.log(`Found ${iplMatches.length} IPL matches`);
  return iplMatches;
}

// ── IPL Teams config ───────────────────────────────────
const teamConfig = {
  "Mumbai Indians":          { flag: "🔵", shortName: "MI"  },
  "Chennai Super Kings":     { flag: "🟡", shortName: "CSK" },
  "Royal Challengers Bengaluru": { flag: "🔴", shortName: "RCB" },
  "Royal Challengers Bangalore": { flag: "🔴", shortName: "RCB" },
  "Kolkata Knight Riders":   { flag: "🟣", shortName: "KKR" },
  "Sunrisers Hyderabad":     { flag: "🟠", shortName: "SRH" },
  "Delhi Capitals":          { flag: "🔷", shortName: "DC"  },
  "Punjab Kings":            { flag: "🔴", shortName: "PBKS"},
  "Rajasthan Royals":        { flag: "🩷", shortName: "RR"  },
  "Gujarat Titans":          { flag: "🔵", shortName: "GT"  },
  "Lucknow Super Giants":    { flag: "🩵", shortName: "LSG" },
};

function getTeamConfig(name) {
  return teamConfig[name] || { flag: "🏏", shortName: name?.slice(0, 3).toUpperCase() };
}

// ── Format match date ──────────────────────────────────
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

// ── Default odds based on recent form (simple placeholder) ──
function getDefaultOdds(teamA, teamB) {
  // Returns [oddsA, oddsB] — will be overridden by admin if needed
  return [1.9, 1.9];
}

// ── Save matches to Firestore ──────────────────────────
async function saveMatches(matches) {
  const matchesRef = db.collection("matches");

  // Clear existing upcoming matches
  const existing = await matchesRef.where("status", "==", "upcoming").get();
  const batch = db.batch();
  existing.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  if (matches.length === 0) {
    console.log("No IPL matches to save — keeping fallback data");
    return;
  }

  // Save new matches
  for (const m of matches.slice(0, 10)) {
    const teams = m.teams || [];
    const teamA = teams[0] || "Team A";
    const teamB = teams[1] || "Team B";
    const [oddsA, oddsB] = getDefaultOdds(teamA, teamB);
    const cfgA = getTeamConfig(teamA);
    const cfgB = getTeamConfig(teamB);

    await matchesRef.doc(m.id).set({
      id: m.id,
      status: "upcoming",
      time: formatMatchTime(m.dateTimeGMT),
      dateTimeGMT: m.dateTimeGMT || null,
      teamA: {
        name: teamA,
        flag: cfgA.flag,
        shortName: cfgA.shortName,
        odds: oddsA,
        picks: 0,
      },
      teamB: {
        name: teamB,
        flag: cfgB.flag,
        shortName: cfgB.shortName,
        odds: oddsB,
        picks: 0,
      },
      updatedAt: new Date().toISOString(),
    });
    console.log(`Saved: ${teamA} vs ${teamB}`);
  }

  console.log("✅ Matches updated in Firestore!");
}

// ── Main ───────────────────────────────────────────────
async function main() {
  console.log("🏏 Refreshing IPL matches...");
  const matches = await fetchIPLMatches();
  await saveMatches(matches);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});