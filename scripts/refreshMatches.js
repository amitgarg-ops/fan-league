// scripts/refreshMatches.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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

// ── Fetch matches from CricAPI ─────────────────────────
async function fetchIPLMatches() {
  const apiKey = process.env.CRICAPI_KEY;

  // Try upcoming matches endpoint

  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${apiKey}&offset=0`;
  console.log("Fetching from:", url);

  const res = await fetch(url);
  const json = await res.json();
  console.log("API status:", json.status);
  console.log("Total matches returned:", json.data?.length || 0);

  if (!json.data) {
    console.log("API error:", JSON.stringify(json));
    return [];
  }

  // Log all match names so we can see what's available
  json.data.forEach(m => console.log("Match:", m.name, "| Teams:", m.teams?.join(" vs ")));

  // Filter for IPL — match by team names or "ipl" in name
  const iplMatches = json.data.filter((m) => {
    const name = (m.name || "").toLowerCase();
    const teams = m.teams || [];
    const hasIPLTeam = teams.some(t => IPL_TEAMS.has(t));
    const hasIPLInName = name.includes("ipl") || name.includes("indian premier");
    return hasIPLTeam || hasIPLInName;
  });

  console.log(`Found ${iplMatches.length} IPL matches`);
  return iplMatches;
}

// ── Save matches to Firestore ──────────────────────────
async function saveMatches(matches) {
  const matchesRef = db.collection("matches");

  // Clear existing upcoming matches
  const existing = await matchesRef.where("status", "==", "upcoming").get();
  const deleteBatch = db.batch();
  existing.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();
  console.log(`Deleted ${existing.docs.length} old matches`);

  if (matches.length === 0) {
    console.log("No IPL matches found — Firestore cleared, app will use fallback data");
    return;
  }

  for (const m of matches.slice(0, 10)) {
    const teams = m.teams || [];
    const teamA = teams[0] || "Team A";
    const teamB = teams[1] || "Team B";
    const cfgA = getTeamConfig(teamA);
    const cfgB = getTeamConfig(teamB);

    await matchesRef.doc(m.id).set({
      id: m.id,
      status: "upcoming",
      time: formatMatchTime(m.dateTimeGMT),
      dateTimeGMT: m.dateTimeGMT || null,
      teamA: { name: teamA, flag: cfgA.flag, shortName: cfgA.shortName, odds: 1.9, picks: 0 },
      teamB: { name: teamB, flag: cfgB.flag, shortName: cfgB.shortName, odds: 1.9, picks: 0 },
      updatedAt: new Date().toISOString(),
    });
    console.log(`✅ Saved: ${teamA} vs ${teamB}`);
  }
}

// ── Main ───────────────────────────────────────────────
async function main() {
  console.log("🏏 Refreshing IPL matches...");
  console.log("Project:", process.env.VITE_FIREBASE_PROJECT_ID);
  console.log("Client email:", process.env.FIREBASE_CLIENT_EMAIL);

  const matches = await fetchIPLMatches();
  await saveMatches(matches);

  console.log("✅ Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});