import { useState } from "react";
import "./App.css";

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

// ── Pages ──────────────────────────────────────────────
function HomePage() {
  return (
    <div className="page">
      <div className="page-hero">
        <span className="hero-emoji">🏏</span>
        <h1>IPL Fan League</h1>
        <p>Pick match winners. Earn points. Beat your friends.</p>
      </div>

      <div className="section-label">Upcoming Matches</div>

      <div className="match-card">
        <div className="match-teams">
          <div className="team">
            <span className="team-flag">🔵</span>
            <span className="team-name">Mumbai Indians</span>
            <span className="team-odds">1.8x</span>
          </div>
          <div className="vs">VS</div>
          <div className="team">
            <span className="team-flag">🟡</span>
            <span className="team-name">Chennai Super Kings</span>
            <span className="team-odds">2.1x</span>
          </div>
        </div>
        <div className="match-meta">Today · 7:30 PM IST</div>
        <button className="pick-btn">Lock Your Pick →</button>
      </div>

      <div className="match-card">
        <div className="match-teams">
          <div className="team">
            <span className="team-flag">🔴</span>
            <span className="team-name">Royal Challengers</span>
            <span className="team-odds">2.4x</span>
          </div>
          <div className="vs">VS</div>
          <div className="team">
            <span className="team-flag">🟣</span>
            <span className="team-name">Kolkata Knight Riders</span>
            <span className="team-odds">1.6x</span>
          </div>
        </div>
        <div className="match-meta">Tomorrow · 3:30 PM IST</div>
        <button className="pick-btn">Lock Your Pick →</button>
      </div>
    </div>
  );
}

function LeaderboardPage() {
  const players = [
    { rank: 1, name: "Rahul S.", points: 840, trend: "↑" },
    { rank: 2, name: "Priya M.", points: 720, trend: "↑" },
    { rank: 3, name: "Amit G.", points: 680, trend: "→" },
    { rank: 4, name: "Sneha K.", points: 530, trend: "↓" },
    { rank: 5, name: "Dev P.",  points: 490, trend: "↑" },
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

function ProfilePage() {
  return (
    <div className="page">
      <div className="profile-avatar">AG</div>
      <h2 className="profile-name">Amit Garg</h2>
      <p className="profile-sub">Member since IPL 2026</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">680</div>
          <div className="stat-label">Total Points</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">14</div>
          <div className="stat-label">Picks Made</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">9</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">64%</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

      <button className="sign-out-btn">Sign Out</button>
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
  const [activeTab, setActiveTab] = useState("home");

  const renderPage = () => {
    if (activeTab === "home")        return <HomePage />;
    if (activeTab === "leaderboard") return <LeaderboardPage />;
    if (activeTab === "profile")     return <ProfilePage />;
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