import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg: #0a0b0f;
    --surface: #111318;
    --surface-2: #181c24;
    --border: rgba(255,255,255,0.07);
    --border-active: rgba(99,210,179,0.4);
    --accent: #63d2b3;
    --accent-dim: rgba(99,210,179,0.10);
    --text: #e8eaf0;
    --text-muted: #6b7280;
    --text-dim: #9ca3af;
    --mono: 'DM Mono', monospace;
    --sans: 'Syne', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }

  /* ── Nav ── */
  .layout-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(10,11,15,0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 32px;
    height: 56px;
    gap: 24px;
  }

  /* Subtle top accent */
  .layout-nav::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, var(--accent), transparent 60%);
    opacity: 0.5;
  }

  /* ── Wordmark ── */
  .nav-wordmark {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    flex-shrink: 0;
    text-decoration: none;
    user-select: none;
  }

  .nav-logo-box {
    width: 28px;
    height: 28px;
    background: var(--accent-dim);
    border: 1px solid var(--border-active);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    transition: background 0.2s;
  }

  .nav-wordmark:hover .nav-logo-box {
    background: rgba(99,210,179,0.18);
  }

  .nav-wordmark-text {
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .nav-wordmark-text span {
    color: var(--accent);
  }

  /* ── Nav links ── */
  .nav-links {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .nav-link {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 15px;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    transition: color 0.18s, background 0.18s;
    user-select: none;
    border: 1px solid transparent;
  }

  .nav-link:hover {
    color: var(--text-dim);
    background: var(--surface-2);
  }

  .nav-link.active {
    color: var(--accent);
    background: var(--accent-dim);
    border-color: rgba(99,210,179,0.18);
  }

  .nav-link-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0;
    transition: opacity 0.18s;
    flex-shrink: 0;
  }

  .nav-link.active .nav-link-dot {
    opacity: 1;
  }

  /* Step numbers */
  .nav-link-step {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text-muted);
    opacity: 0.6;
  }

  .nav-link.active .nav-link-step {
    color: var(--accent);
    opacity: 0.7;
  }

  /* ── Mobile hamburger ── */
  .nav-hamburger {
    display: none;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    padding: 4px;
    background: none;
    border: none;
    flex-shrink: 0;
  }

  .nav-hamburger span {
    display: block;
    width: 20px;
    height: 1.5px;
    background: var(--text-muted);
    border-radius: 999px;
    transition: transform 0.25s, opacity 0.25s, background 0.2s;
  }

  .nav-hamburger.open span:nth-child(1) { transform: translateY(5.5px) rotate(45deg); background: var(--accent); }
  .nav-hamburger.open span:nth-child(2) { opacity: 0; }
  .nav-hamburger.open span:nth-child(3) { transform: translateY(-5.5px) rotate(-45deg); background: var(--accent); }

  /* ── Mobile drawer ── */
  .nav-drawer {
    display: none;
    position: fixed;
    top: 56px;
    left: 0; right: 0;
    background: rgba(10,11,15,0.97);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    padding: 16px 24px 24px;
    flex-direction: column;
    gap: 4px;
    z-index: 99;
    animation: drawerIn 0.2s ease both;
  }

  .nav-drawer.open { display: flex; }

  @keyframes drawerIn {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .drawer-link {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    transition: color 0.18s, background 0.18s;
    border: 1px solid transparent;
  }

  .drawer-link:hover { color: var(--text-dim); background: var(--surface-2); }

  .drawer-link.active {
    color: var(--accent);
    background: var(--accent-dim);
    border-color: rgba(99,210,179,0.18);
  }

  .drawer-step {
    font-size: 9px;
    color: var(--text-muted);
    opacity: 0.5;
    margin-left: auto;
  }

  .drawer-link.active .drawer-step { color: var(--accent); opacity: 0.6; }

  /* ── Page content ── */
  .layout-content {
    min-height: calc(100vh - 56px);
  }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .nav-links    { display: none; }
    .nav-hamburger { display: flex; }
  }
`;

const NAV_ITEMS = [
  { label: "Upload",    path: "/",          step: "01" },
  { label: "Results",   path: "/results",   step: "02" },
  { label: "EDA",       path: "/eda",       step: "03" },
  { label: "Predictor", path: "/predictor", step: "04" },
];

export default function Layout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close drawer on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest(".nav-drawer") && !e.target.closest(".nav-hamburger")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <>
      <style>{styles}</style>

      <nav className="layout-nav">
        {/* Wordmark */}
        <div className="nav-wordmark" onClick={() => go("/")}>
          <div className="nav-logo-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span className="nav-wordmark-text">Auto<span>ML</span></span>
        </div>

        {/* Desktop links */}
        <div className="nav-links">
          {NAV_ITEMS.map(({ label, path, step }) => (
            <div
              key={path}
              className={`nav-link${isActive(path) ? " active" : ""}`}
              onClick={() => go(path)}
            >
              <div className="nav-link-dot" />
              <span className="nav-link-step">{step}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Hamburger */}
        <button
          className={`nav-hamburger${open ? " open" : ""}`}
          onClick={() => setOpen(v => !v)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile drawer */}
      <div className={`nav-drawer${open ? " open" : ""}`}>
        {NAV_ITEMS.map(({ label, path, step }) => (
          <div
            key={path}
            className={`drawer-link${isActive(path) ? " active" : ""}`}
            onClick={() => go(path)}
          >
            <span className="nav-link-step">{step}</span>
            {label}
            <span className="drawer-step">{isActive(path) ? "current" : ""}</span>
          </div>
        ))}
      </div>

      <main className="layout-content">{children}</main>
    </>
  );
}