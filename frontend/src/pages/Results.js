import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import API from "../api";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg: #0a0b0f;
    --surface: #111318;
    --surface-2: #181c24;
    --surface-3: #1e2330;
    --border: rgba(255,255,255,0.07);
    --border-active: rgba(99,210,179,0.4);
    --accent: #63d2b3;
    --accent-dim: rgba(99,210,179,0.10);
    --accent-glow: rgba(99,210,179,0.2);
    --gold: #f0c040;
    --gold-dim: rgba(240,192,64,0.12);
    --text: #e8eaf0;
    --text-muted: #6b7280;
    --text-dim: #9ca3af;
    --mono: 'DM Mono', monospace;
    --sans: 'Syne', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .results-root {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 48px 20px 80px;
    font-family: var(--sans);
    color: var(--text);
  }

  .results-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(99,210,179,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,210,179,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .results-wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 680px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Page header ── */
  .page-header {
    animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
  }

  .page-eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 10px;
    opacity: 0.85;
  }

  .page-title {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    color: var(--text);
  }

  .page-title span {
    color: var(--accent);
  }

  /* ── Best model hero card ── */
  .hero-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    overflow: hidden;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both;
  }

  .hero-bar {
    height: 2px;
    background: linear-gradient(90deg, var(--gold), transparent);
  }

  .hero-body {
    padding: 28px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .hero-left {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .trophy-box {
    width: 52px;
    height: 52px;
    background: var(--gold-dim);
    border: 1px solid rgba(240,192,64,0.25);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gold);
    flex-shrink: 0;
  }

  .hero-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .hero-tag {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold);
    opacity: 0.8;
  }

  .hero-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
  }

  .hero-score-block {
    text-align: right;
  }

  .hero-score-label {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .hero-score-value {
    font-family: var(--mono);
    font-size: 34px;
    font-weight: 500;
    color: var(--gold);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  /* ── Rankings section ── */
  .section-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 10px;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Model rows ── */
  .model-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .model-row {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: border-color 0.2s, background 0.2s;
    opacity: 0;
    animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }

  .model-row:hover {
    border-color: rgba(255,255,255,0.12);
    background: var(--surface-2);
  }

  .model-row.rank-1 {
    border-color: rgba(240,192,64,0.2);
  }

  .rank-num {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-muted);
    width: 20px;
    flex-shrink: 0;
    text-align: right;
  }

  .model-row.rank-1 .rank-num {
    color: var(--gold);
  }

  .model-name {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Score bar */
  .score-bar-wrap {
    flex: 2;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .score-bar-track {
    flex: 1;
    height: 3px;
    background: var(--surface-3);
    border-radius: 999px;
    overflow: hidden;
  }

  .score-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: var(--accent);
    transform-origin: left;
    transform: scaleX(0);
    animation: barGrow 0.6s cubic-bezier(0.16,1,0.3,1) both;
  }

  .model-row.rank-1 .score-bar-fill {
    background: var(--gold);
  }

  @keyframes barGrow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }

  .score-val {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-dim);
    width: 58px;
    text-align: right;
    flex-shrink: 0;
  }

  .model-row.rank-1 .score-val {
    color: var(--gold);
  }

  /* ── CTA ── */
  .cta-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s both;
  }

  .btn-primary {
    flex: 1;
    min-width: 160px;
    padding: 14px 24px;
    background: var(--accent);
    color: #0a0b0f;
    border: none;
    border-radius: 2px;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.2s, transform 0.15s;
  }

  .btn-primary:hover {
    opacity: 0.88;
    transform: translateY(-1px);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-ghost {
    flex: 1;
    min-width: 160px;
    padding: 14px 24px;
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 2px;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: border-color 0.2s, color 0.2s, transform 0.15s;
  }

  .btn-ghost:hover {
    border-color: rgba(255,255,255,0.2);
    color: var(--text);
    transform: translateY(-1px);
  }

  .btn-ghost:active {
    transform: translateY(0);
  }

  /* ── Animations ── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Empty state ── */
  .empty-state {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 60px 40px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both;
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-dim);
    letter-spacing: -0.01em;
  }

  .empty-sub {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-muted);
  }
`;

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  const storedResults = localStorage.getItem("automl_results");

  const results =
    location.state?.results || (storedResults ? JSON.parse(storedResults) : {});

  //  Filter only valid models (ignore errors)
  const getScore = (v) => v.cv_mean ?? v.cv_mean_r2;

  const validResults = Object.entries(results).filter(
    ([_, v]) => v && getScore(v) !== undefined,
  );

  //  Sort by CV score
  const sorted = validResults.sort((a, b) => getScore(b[1]) - getScore(a[1]));

  
  const best = sorted[0];

  const maxScore = best ? getScore(best[1]) : 1;

  const relWidth = (score) => Math.max(0, Math.min(1, score / maxScore));

  return (
    <Layout>
      <style>{styles}</style>
      <div style={{ padding: "40px", color: "white" }}>
        <h1>🏆 Model Rankings</h1>

        {sorted.length === 0 ? (
          <p>No valid models found. Try another dataset.</p>
        ) : (
          <>
            {/*  BEST MODEL */}
            <div
              style={{
                marginTop: "20px",
                padding: "20px",
                border: "1px solid #444",
                borderRadius: "8px",
              }}
            >
              <h2>Best Model: {best[0]}</h2>
              <p>CV Score: {getScore(best[1]).toFixed(4)}</p>
            </div>

            {/*  ALL MODELS */}
            <div style={{ marginTop: "30px" }}>
              {sorted.map(([model, data], i) => {
                const score = getScore(data);

                return (
                  <div
                    key={model}
                    style={{
                      marginBottom: "15px",
                      padding: "12px",
                      border: "1px solid #333",
                      borderRadius: "6px",
                    }}
                  >
                    <strong>
                      #{i + 1} {model}
                    </strong>

                    <div
                      style={{
                        height: "6px",
                        background: "#222",
                        marginTop: "6px",
                      }}
                    >
                      <div
                        style={{
                          width: `${relWidth(score) * 100}%`,
                          height: "100%",
                          background: i === 0 ? "gold" : "#4ade80",
                        }}
                      />
                    </div>

                    <div style={{ marginTop: "5px", fontSize: "12px" }}>
                      CV: {score.toFixed(4)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTAs */}
            <div className="cta-row">
              <button
                className="btn-primary"
                onClick={() => {
                  const stored = localStorage.getItem("automl_results");
                  if (!stored) {
                    navigate("/");
                  } else {
                    navigate("/eda");
                  }
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                Explore EDA
              </button>
              <button
                className="btn-ghost"
                onClick={async () => {
                  // clear ALL frontend state FIRST
                  localStorage.clear(); 

                  //  reset backend
                  try {
                    await fetch(`${API}/reset`, { method: "POST" });
                  } catch (e) {
                    console.error("Reset failed", e);
                  }

                  //  force navigation AFTER clearing
                  navigate("/", { replace: true });
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                New Dataset
              </button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
