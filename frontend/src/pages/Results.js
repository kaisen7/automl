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
    --red: #f87171;
    --blue: #60a5fa;
    --purple: #a78bfa;
    --orange: #fb923c;
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
    max-width: 760px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── State cards ── */
  .state-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
    padding: 60px 40px; display: flex; flex-direction: column; align-items: center;
    gap: 12px; text-align: center; animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }
  .state-icon {
    width: 48px; height: 48px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 2px; display: flex; align-items: center; justify-content: center;
    color: var(--text-muted); margin-bottom: 4px;
  }
  .state-title { font-size: 15px; font-weight: 700; }
  .state-sub { font-family: var(--mono); font-size: 11px; color: var(--text-muted); }

  .ghost-btn {
    margin-top: 8px; padding: 10px 24px;
    border: 1px solid var(--border); border-radius: 2px;
    background: transparent; color: var(--text-dim);
    font-family: var(--sans); font-size: 11px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; transition: border-color 0.2s, color 0.2s;
  }
  .ghost-btn:hover { border-color: rgba(255,255,255,0.18); color: var(--text); }

  /* ── Page header ── */
  .page-header { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .page-eyebrow {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 10px; opacity: 0.85;
  }
  .page-title {
    font-size: 32px; font-weight: 800; letter-spacing: -0.03em;
    line-height: 1.1; color: var(--text);
  }
  .page-title span { color: var(--accent); }

  /* ── Hero card ── */
  .hero-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 2px; overflow: hidden;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both;
  }
  .hero-bar { height: 2px; background: linear-gradient(90deg, var(--gold), transparent); }
  .hero-body {
    padding: 28px 32px;
    display: flex; align-items: flex-start;
    justify-content: space-between; gap: 24px; flex-wrap: wrap;
  }
  .hero-left { display: flex; align-items: flex-start; gap: 18px; }
  .trophy-box {
    width: 52px; height: 52px; background: var(--gold-dim);
    border: 1px solid rgba(240,192,64,0.25); border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
    color: var(--gold); flex-shrink: 0;
  }
  .hero-meta { display: flex; flex-direction: column; gap: 4px; }
  .hero-tag {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--gold); opacity: 0.8;
  }
  .hero-name {
    font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: var(--text);
    margin-bottom: 6px;
  }

  /* Hero scores grid */
  .hero-scores-grid {
    display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;
  }
  .hero-score-chip {
    display: flex; flex-direction: column; gap: 2px;
    padding: 8px 14px;
    background: var(--surface-2); border-radius: 2px;
    border: 1px solid var(--border);
    min-width: 90px;
  }
  .hero-score-chip.is-best {
    border-color: rgba(240,192,64,0.35);
    background: var(--gold-dim);
    position: relative;
  }
  .hero-score-chip.is-best::after {
    content: '★ BEST';
    position: absolute; top: -8px; left: 50%; transform: translateX(-50%);
    font-family: var(--mono); font-size: 8px; letter-spacing: 0.15em;
    color: var(--gold); background: var(--bg);
    padding: 1px 6px; border: 1px solid rgba(240,192,64,0.3); border-radius: 1px;
    white-space: nowrap;
  }
  .chip-label {
    font-family: var(--mono); font-size: 8px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--text-muted);
  }
  .chip-value {
    font-family: var(--mono); font-size: 18px; font-weight: 500;
    line-height: 1;
  }
  .chip-value.gold { color: var(--gold); }
  .chip-value.accent { color: var(--accent); }
  .chip-value.blue { color: var(--blue); }
  .chip-value.purple { color: var(--purple); }
  .chip-value.orange { color: var(--orange); }
  .chip-value.muted { color: var(--text-muted); }

  /* ── Section label ── */
  .section-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.15em;
    text-transform: uppercase; color: var(--text-muted);
    display: flex; align-items: center; gap: 10px;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }
  .section-label::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  /* ── Model cards ── */
  .model-list { display: flex; flex-direction: column; gap: 12px; }

  .model-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 2px; overflow: hidden;
    opacity: 0; animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
    transition: border-color 0.2s, background 0.2s;
  }
  .model-card:hover { border-color: rgba(255,255,255,0.12); background: var(--surface-2); }
  .model-card.rank-1 { border-color: rgba(240,192,64,0.2); }

  .model-card-top {
    padding: 16px 20px 14px;
    display: flex; align-items: center; gap: 14px;
    border-bottom: 1px solid var(--border);
  }
  .rank-num {
    font-family: var(--mono); font-size: 11px; color: var(--text-muted);
    width: 20px; flex-shrink: 0; text-align: right;
  }
  .model-card.rank-1 .rank-num { color: var(--gold); }

  .model-name-wrap { flex: 1; }
  .model-name {
    font-size: 14px; font-weight: 700; letter-spacing: -0.01em;
    color: var(--text);
  }
  .model-card.rank-1 .model-name { color: var(--gold); }

  /* Main score bar */
  .main-score-area {
    display: flex; align-items: center; gap: 12px; flex: 2;
  }
  .score-bar-track {
    flex: 1; height: 3px; background: var(--surface-3);
    border-radius: 999px; overflow: hidden;
  }
  .score-bar-fill {
    height: 100%; border-radius: 999px; background: var(--accent);
    transform-origin: left; transform: scaleX(0);
    animation: barGrow 0.6s cubic-bezier(0.16,1,0.3,1) both;
  }
  .model-card.rank-1 .score-bar-fill { background: var(--gold); }

  .score-primary {
    font-family: var(--mono); font-size: 13px; font-weight: 500;
    color: var(--text-dim); white-space: nowrap;
  }
  .model-card.rank-1 .score-primary { color: var(--gold); }

  /* Score pills grid */
  .model-scores-grid {
    padding: 12px 20px 14px 54px;
    display: flex; flex-wrap: wrap; gap: 6px;
  }

  .score-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 10px;
    background: var(--surface-3); border-radius: 2px;
    border: 1px solid var(--border);
  }
  .pill-label {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--text-muted);
  }
  .pill-value {
    font-family: var(--mono); font-size: 11px; font-weight: 500;
  }
  .pill-value.accent  { color: var(--accent); }
  .pill-value.gold    { color: var(--gold); }
  .pill-value.blue    { color: var(--blue); }
  .pill-value.purple  { color: var(--purple); }
  .pill-value.orange  { color: var(--orange); }
  .pill-value.muted   { color: var(--text-muted); }
  .pill-value.red     { color: var(--red); }

  .pill-dot {
    width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
  }
  .pill-dot.accent  { background: var(--accent); }
  .pill-dot.gold    { background: var(--gold); }
  .pill-dot.blue    { background: var(--blue); }
  .pill-dot.purple  { background: var(--purple); }
  .pill-dot.orange  { background: var(--orange); }
  .pill-dot.muted   { background: var(--text-muted); }
  .pill-dot.red     { background: var(--red); }

  /* ── CTAs ── */
  .cta-row {
    display: flex; gap: 12px; flex-wrap: wrap;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s both;
  }
  .btn-primary {
    flex: 1; min-width: 160px; padding: 14px 24px;
    background: var(--accent); color: #0a0b0f;
    border: none; border-radius: 2px;
    font-family: var(--sans); font-size: 12px; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: opacity 0.2s, transform 0.15s;
  }
  .btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }

  .btn-ghost {
    flex: 1; min-width: 160px; padding: 14px 24px;
    background: transparent; color: var(--text-dim);
    border: 1px solid var(--border); border-radius: 2px;
    font-family: var(--sans); font-size: 12px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: border-color 0.2s, color 0.2s, transform 0.15s;
  }
  .btn-ghost:hover { border-color: rgba(255,255,255,0.2); color: var(--text); transform: translateY(-1px); }
  .btn-ghost:active { transform: translateY(0); }

  /* ── Animations ── */
  @keyframes barGrow {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

const getScore = (v) => v?.cv_mean ?? v?.cv_mean_r2;

/** Return an ordered list of { key, label, value, color } for a model's scores */
function buildScorePills(data) {
  const pills = [];

  if (data.cv_mean !== undefined)
    pills.push({ key: "cv_mean",        label: "CV F1",      value: data.cv_mean,        color: "accent" });
  if (data.cv_mean_r2 !== undefined)
    pills.push({ key: "cv_mean_r2",     label: "CV R²",      value: data.cv_mean_r2,     color: "accent" });
  if (data.cv_std !== undefined)
    pills.push({ key: "cv_std",         label: "CV ±std",    value: data.cv_std,          color: "muted"  });
  if (data.test_accuracy !== undefined)
    pills.push({ key: "test_accuracy",  label: "Test Acc",   value: data.test_accuracy,   color: "blue"   });
  if (data.test_f1_weighted !== undefined)
    pills.push({ key: "test_f1",        label: "Test F1",    value: data.test_f1_weighted,color: "purple" });
  if (data.test_r2 !== undefined)
    pills.push({ key: "test_r2",        label: "Test R²",    value: data.test_r2,         color: "blue"   });
  if (data.test_mae !== undefined)
    pills.push({ key: "test_mae",       label: "Test MAE",   value: data.test_mae,        color: "orange" });

  return pills;
}

/** Best primary score key for the hero display */
function bestScoreKey(data) {
  if (data.cv_mean_r2 !== undefined) return "cv_mean_r2";
  if (data.cv_mean    !== undefined) return "cv_mean";
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  const storedResults = localStorage.getItem("automl_results");
  const results =
    location.state?.results || (storedResults ? JSON.parse(storedResults) : {});

  const validResults = Object.entries(results).filter(
    ([_, v]) => v && getScore(v) !== undefined
  );

  const sorted = validResults.sort((a, b) => getScore(b[1]) - getScore(a[1]));
  const best = sorted[0];
  const maxScore = best ? getScore(best[1]) : 1;
  const relWidth = (score) => Math.max(0, Math.min(1, score / maxScore));

  return (
    <Layout>
      <style>{styles}</style>
      <div className="results-root">
        <div className="results-wrap">

          {/* ── Page header ── */}
          <div className="page-header">
            <div className="page-eyebrow">AutoML · Model Evaluation</div>
            <h1 className="page-title">Model <span>Rankings</span></h1>
          </div>

          {sorted.length === 0 ? (
            <div className="state-card">
              <div className="state-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="state-title" style={{ color: "#f87171" }}>No dataset loaded</div>
              <div className="state-sub">Please upload and train a dataset first.</div>
              <button className="ghost-btn" onClick={() => navigate("/")}>Go to Upload</button>
            </div>
          ) : (
            <>
              {/* ══ BEST MODEL HERO ══ */}
              <div className="hero-card">
                <div className="hero-bar" />
                <div className="hero-body">
                  <div className="hero-left">
                    <div className="trophy-box">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 21h8M12 17v4M17 3H7v8a5 5 0 0010 0V3z" />
                        <path d="M17 5h2a2 2 0 012 2v1a4 4 0 01-4 4M7 5H5a2 2 0 00-2 2v1a4 4 0 004 4" />
                      </svg>
                    </div>
                    <div className="hero-meta">
                      <div className="hero-tag">🏆 Best Model</div>
                      <div className="hero-name">{best[0]}</div>

                      {/* All score chips for best model */}
                      <div className="hero-scores-grid">
                        {buildScorePills(best[1]).map((pill) => {
                          const isBest = pill.key === bestScoreKey(best[1]);
                          return (
                            <div
                              key={pill.key}
                              className={`hero-score-chip${isBest ? " is-best" : ""}`}
                            >
                              <span className="chip-label">{pill.label}</span>
                              <span className={`chip-value ${isBest ? "gold" : pill.color}`}>
                                {pill.value.toFixed(4)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ══ ALL MODELS ══ */}
              <div className="section-label">All Models</div>

              <div className="model-list">
                {sorted.map(([model, data], i) => {
                  const score   = getScore(data);
                  const pills   = buildScorePills(data);
                  const rankCls = i === 0 ? " rank-1" : "";
                  const delay   = `${0.12 + i * 0.07}s`;

                  return (
                    <div
                      key={model}
                      className={`model-card${rankCls}`}
                      style={{ animationDelay: delay }}
                    >
                      {/* Top row: rank + name + bar + primary score */}
                      <div className="model-card-top">
                        <span className="rank-num">#{i + 1}</span>

                        <div className="model-name-wrap">
                          <span className="model-name">{model}</span>
                        </div>

                        <div className="main-score-area">
                          <div className="score-bar-track">
                            <div
                              className="score-bar-fill"
                              style={{
                                width: `${relWidth(score) * 100}%`,
                                animationDelay: delay,
                              }}
                            />
                          </div>
                          <span className="score-primary">
                            {score.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom row: all score pills */}
                      <div className="model-scores-grid">
                        {pills.map((pill) => (
                          <div className="score-pill" key={pill.key}>
                            <span className={`pill-dot ${pill.color}`} />
                            <span className="pill-label">{pill.label}</span>
                            <span className={`pill-value ${pill.color}`}>
                              {pill.value.toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ══ CTAs ══ */}
              <div className="cta-row">
                <button
                  className="btn-primary"
                  onClick={() => {
                    const stored = localStorage.getItem("automl_results");
                    navigate(stored ? "/eda" : "/");
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  Explore EDA
                </button>
                <button
                  className="btn-ghost"
                  onClick={async () => {
                    localStorage.clear();
                    try { await fetch(`${API}/reset`, { method: "POST" }); }
                    catch (e) { console.error("Reset failed", e); }
                    navigate("/", { replace: true });
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  New Dataset
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
