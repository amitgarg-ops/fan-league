import { useState, useEffect } from "react";
import "./App.css";
import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

// ── Fallback matches (shown if Firestore has no data yet) ──
const FALLBACK_MATCHES = [
  {
    id: "fallback1",
    time: "Today · 7:30 PM IST",
    teamA: { name: "Mumbai Indians",      flag: "🔵", odds: 1.8, picks: 0 },
    teamB: { name: "Chennai Super Kings", flag: "🟡", odds: 2.1, picks: 0 },
  },
  {
    id: "fallback2",
    time: "Tomorrow · 3:30 PM IST",
    teamA: { name: "Royal Challengers Bengaluru", flag: "🔴", odds: 2.4, picks: 0 },
    teamB: { name: "Kolkata Knight Riders",       flag: "🟣", odds: 1.6, picks: 0 },
  },
];

// ── Icons ──────────────────────────────────────────────
function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function LeaderboardIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  );
}

function ProfileIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ── Login Screen ───────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("start");
  const [error, setError] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);

  async function handleGoogleLogin() {
    setError("");
    setStep("loading");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onLogin(result.user);
    } catch (err) {
      setError("Google sign-in failed. Please try again.");
      setStep("start");
    }
  }

  async function handleSendOtp() {
    setError("");
    if (!phone || phone.length < 10) {
      setError("Please enter a valid phone number with country code e.g. +91XXXXXXXXXX");
      return;
    }
    setStep("loading");
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      }
      const result = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
      setConfirmationResult(result);
      setStep("otp");
    } catch (err) {
      setError("Could not send OTP. Check the number and try again.");
      setStep("start");
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setStep("loading");
    try {
      const result = await confirmationResult.confirm(otp);
      onLogin(result.user);
    } catch (err) {
      setError("Incorrect OTP. Please try again.");
      setStep("otp");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <span className="login-emoji">🏏</span>
        <h1 className="login-title">IPL Fan League</h1>
        <p className="login-sub">Sign in to make picks and compete with friends</p>

        {error && <div className="login-error">{error}</div>}
        {step === "loading" && <div className="login-loading">Signing you in...</div>}

        {step === "start" && (
          <>
            <button className="btn-google" onClick={handleGoogleLogin}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="login-divider"><span>or</span></div>

            <input
              className="login-input"
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button className="btn-phone" onClick={handleSendOtp}>
              Send OTP →
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <p className="otp-hint">Enter the 6-digit code sent to {phone}</p>
            <input
              className="login-input otp-input"
              type="number"
              placeholder="_ _ _ _ _ _"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
            />
            <button className="btn-phone" onClick={handleVerifyOtp}>
              Verify & Sign In →
            </button>
            <button className="btn-resend" onClick={() => setStep("start")}>
              ← Use a different number
            </button>
          </>
        )}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}

// ── Match Card ──────────────────────────────────────────
function MatchCard({ match, user }) {
  const [selected, setSelected] = useState(null);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingPick, setLoadingPick] = useState(true);

  const totalPicks = (match.teamA.picks || 0) + (match.teamB.picks || 0);
  const pctA = totalPicks > 0 ? Math.round((match.teamA.picks / totalPicks) * 100) : 50;
  const pctB = 100 - pctA;

  useEffect(() => {
    async function loadPick() {
      try {
        const pickRef = doc(db, "picks", `${user.uid}_${match.id}`);
        const pickSnap = await getDoc(pickRef);
        if (pickSnap.exists()) {
          setSelected(pickSnap.data().team);
          setLocked(true);
        }
      } catch (err) {
        console.error("Error loading pick:", err);
      } finally {
        setLoadingPick(false);
      }
    }
    loadPick();
  }, [user.uid, match.id]);

  function handleSelect(team) {
    if (locked) return;
    setSelected(team);
  }

  async function handleLock() {
    if (!selected || locked) return;
    setSaving(true);
    try {
      const pickRef = doc(db, "picks", `${user.uid}_${match.id}`);
      await setDoc(pickRef, {
        userId: user.uid,
        matchId: match.id,
        team: selected,
        teamName: selected === "A" ? match.teamA.name : match.teamB.name,
        odds: selected === "A" ? match.teamA.odds : match.teamB.odds,
        pointsIfWin: Math.round(100 * (selected === "A" ? match.teamA.odds : match.teamB.odds)),
        lockedAt: serverTimestamp(),
      });
      setLocked(true);
    } catch (err) {
      console.error("Error saving pick:", err);
      alert("Could not save your pick. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const pointsIfWin = selected
    ? Math.round(100 * (selected === "A" ? match.teamA.odds : match.teamB.odds))
    : null;

  if (loadingPick) {
    return <div className="match-card loading-card">Loading...</div>;
  }

  return (
    <div className="match-card">
      <div className="match-teams">
        <div
          className={`team ${selected === "A" ? "selected" : ""} ${selected && selected !== "A" ? "loser" : ""}`}
          onClick={() => handleSelect("A")}
        >
          <span className="team-flag">{match.teamA.flag}</span>
          <span className="team-name">{match.teamA.name}</span>
          {!locked ? (
            <span className="pick-count">{match.teamA.picks || 0} picks</span>
          ) : (
            <div className="pct-bar-wrap">
              <div className="pct-bar pct-bar--a" style={{ width: pctA + "%" }} />
              <span className="pct-label">{pctA}%</span>
            </div>
          )}
        </div>

        <div className="vs">VS</div>

        <div
          className={`team ${selected === "B" ? "selected" : ""} ${selected && selected !== "B" ? "loser" : ""}`}
          onClick={() => handleSelect("B")}
        >
          <span className="team-flag">{match.teamB.flag}</span>
          <span className="team-name">{match.teamB.name}</span>
          {!locked ? (
            <span className="pick-count">{match.teamB.picks || 0} picks</span>
          ) : (
            <div className="pct-bar-wrap">
              <div className="pct-bar pct-bar--b" style={{ width: pctB + "%" }} />
              <span className="pct-label">{pctB}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="match-meta">{match.time}</div>

      {selected && !locked && (
        <div className="points-hint">
          If {selected === "A" ? match.teamA.name : match.teamB.name} win → you earn <strong>{pointsIfWin} pts</strong>
        </div>
      )}

      {!locked ? (
        <button
          className={`pick-btn ${selected ? "pick-btn--ready" : "pick-btn--disabled"}`}
          onClick={handleLock}
          disabled={!selected || saving}
        >
          {saving ? "Saving..." : selected
            ? `Lock in ${selected === "A" ? match.teamA.name : match.teamB.name} →`
            : "Tap a team to pick"}
        </button>
      ) : (
        <div className="locked-confirm">
          ✓ Locked! You picked {selected === "A" ? match.teamA.name : match.teamB.name} · {pointsIfWin} pts if correct
        </div>
      )}
    </div>
  );
}

// ── Home Page (loads matches from Firestore) ───────────
const ADMIN_UID = "MIP10AFAjuen2QmeEJZzz3Nt1nF3";

function HomePage({ user }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = user.uid === ADMIN_UID;

  useEffect(() => {
    loadMatches();
  }, []);

  async function loadMatches() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "matches"),
        where("status", "==", "upcoming"),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setMatches(FALLBACK_MATCHES);
      } else {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMatches(data);
      }
    } catch (err) {
      console.error("Error loading matches:", err);
      setMatches(FALLBACK_MATCHES);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-hero">
        <span className="hero-emoji">🏏</span>
        <h1>IPL Fan League</h1>
        <p>Pick match winners. Earn points. Beat your friends.</p>
      </div>

      {isAdmin && (
        <button className="admin-refresh-btn" onClick={loadMatches}>
          🔄 Refresh Matches
        </button>
      )}

      <div className="section-label">Upcoming Matches</div>

      {loading ? (
        <div className="loading-card">Loading matches...</div>
      ) : (
        matches.map((match) => (
          <MatchCard key={match.id} match={match} user={user} />
        ))
      )}
    </div>
  );
}

// ── Leaderboard Page ───────────────────────────────────
function LeaderboardPage() {
  const players = [
    { rank: 1, name: "Rahul S.",  points: 840, trend: "↑" },
    { rank: 2, name: "Priya M.",  points: 720, trend: "↑" },
    { rank: 3, name: "Amit G.",   points: 680, trend: "→" },
    { rank: 4, name: "Sneha K.",  points: 530, trend: "↓" },
    { rank: 5, name: "Dev P.",    points: 490, trend: "↑" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>🏆 Leaderboard</h2>
        <p>Your bracket · IPL 2026</p>
      </div>
      <div className="leaderboard">
        {players.map((p) => (
          <div key={p.rank} className={`lb-row ${p.rank <= 3 ? "top-three" : ""}`}>
            <span className="lb-rank">
              {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank}
            </span>
            <span className="lb-name">{p.name}</span>
            <span className="lb-trend">{p.trend}</span>
            <span className="lb-points">{p.points} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Page ───────────────────────────────────────
function ProfilePage({ user, onSignOut }) {
  const displayName = user.displayName || user.phoneNumber || "Player";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="page">
      <div className="profile-avatar">{initials}</div>
      <h2 className="profile-name">{displayName}</h2>
      <p className="profile-sub">{user.email || user.phoneNumber}</p>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Total Points</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Picks Made</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">—</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>
      <div className="uid-box">Your UID: {user.uid}</div>
      <button className="sign-out-btn" onClick={onSignOut}>Sign Out</button>
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────
const tabs = [
  { id: "home",        label: "Home",        Icon: HomeIcon },
  { id: "leaderboard", label: "Leaderboard", Icon: LeaderboardIcon },
  { id: "profile",     label: "Profile",     Icon: ProfileIcon },
];

export default function App() {
  const [user, setUser]           = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  async function handleSignOut() {
    await signOut(auth);
    setUser(null);
  }

  if (!authReady) return <div className="splash">🏏</div>;
  if (!user) return <LoginScreen onLogin={setUser} />;

  const renderPage = () => {
    if (activeTab === "home")        return <HomePage user={user} />;
    if (activeTab === "leaderboard") return <LeaderboardPage />;
    if (activeTab === "profile")     return <ProfilePage user={user} onSignOut={handleSignOut} />;
  };

  return (
    <div className="app-shell">
      <main className="main-content">{renderPage()}</main>
      <nav className="bottom-nav">
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              className={`nav-btn ${active ? "nav-btn--active" : ""}`}
              onClick={() => setActiveTab(id)}
              aria-label={label}
            >
              {active && <span className="nav-dot" />}
              <Icon active={active} />
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}