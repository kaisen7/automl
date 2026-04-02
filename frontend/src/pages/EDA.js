import React, { useEffect, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import API from "../api";
import { useNavigate } from "react-router-dom";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

// ── Tokens ────────────────────────────────────────────────────────────────────
const ACCENT   = "#63d2b3";
const VIOLET   = "#a78bfa";
const GOLD     = "#f0c040";
const RED      = "#f87171";
const TEXT_DIM = "#9ca3af";
const TEXT_MUT = "#6b7280";
const BORDER   = "rgba(255,255,255,0.07)";

const PIE_COLORS = ["#63d2b3","#a78bfa","#f0c040","#f87171","#60a5fa","#fb923c","#34d399","#e879f9"];

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#111318", border: "1px solid rgba(99,210,179,0.25)",
      borderRadius: 2, padding: "8px 14px",
      fontFamily: "'DM Mono',monospace", fontSize: 11,
    }}>
      {label && <div style={{ color: TEXT_MUT, marginBottom: 4, fontSize: 10 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || ACCENT }}>
          {p.name ? `${p.name}: ` : ""}
          {typeof p.value === "number" ? p.value.toFixed(4) : p.value}
        </div>
      ))}
    </div>
  );
};

// ── Correlation colour ────────────────────────────────────────────────────────
const corrColor = (val) => {
  const v = Math.max(-1, Math.min(1, val));
  if (v > 0) return `rgba(99,210,179,${(v * 0.75 + 0.1).toFixed(2)})`;
  if (v < 0) return `rgba(248,113,113,${(Math.abs(v) * 0.75 + 0.1).toFixed(2)})`;
  return "transparent";
};

// ── Score bar (horizontal progress) ──────────────────────────────────────────
const ScoreBar = ({ value, color = ACCENT }) => {
  const pct = Math.min(Math.max(value * 100, 0), 100).toFixed(1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 999, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: TEXT_DIM, minWidth: 42, textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg: #0a0b0f; --surface: #111318; --surface-2: #181c24; --surface-3: #1e2330;
    --border: rgba(255,255,255,0.07); --border-active: rgba(99,210,179,0.4);
    --accent: #63d2b3; --accent-dim: rgba(99,210,179,0.10);
    --text: #e8eaf0; --text-muted: #6b7280; --text-dim: #9ca3af;
    --mono: 'DM Mono', monospace; --sans: 'Syne', sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .eda-root {
    min-height: 100vh; background: var(--bg);
    padding: 48px 32px 100px; font-family: var(--sans);
    color: var(--text); position: relative;
  }
  .eda-root::before {
    content: ''; position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(99,210,179,0.03) 1px, transparent 1px),
      linear-gradient(90deg,rgba(99,210,179,0.03) 1px, transparent 1px);
    background-size: 40px 40px; pointer-events: none; z-index: 0;
  }
  .eda-inner {
    position: relative; z-index: 1; max-width: 1100px;
    margin: 0 auto; display: flex; flex-direction: column; gap: 36px;
  }

  .page-header { animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both; }
  .page-eyebrow {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 10px; opacity: 0.85;
  }
  .page-title { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; }
  .page-title span { color: var(--accent); }

  /* stat strip */
  .stat-strip {
    display: flex; gap: 0; border: 1px solid var(--border);
    border-radius: 2px; overflow: hidden; background: var(--surface);
  }
  .stat-cell {
    flex: 1; padding: 14px 20px; border-right: 1px solid var(--border);
    display: flex; flex-direction: column; gap: 4;
  }
  .stat-cell:last-child { border-right: none; }
  .stat-cell-label { font-family: var(--mono); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); }
  .stat-cell-value { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
  .stat-cell-value span { color: var(--accent); }

  /* pill row */
  .pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .col-pill {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em;
    padding: 5px 12px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 999px; color: var(--text-dim); transition: border-color 0.2s, color 0.2s;
  }
  .col-pill:hover { border-color: var(--border-active); color: var(--accent); }

  .section { display: flex; flex-direction: column; gap: 14px; animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
  .section-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text-muted);
    display: flex; align-items: center; gap: 10px;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
  .panel-bar { height: 2px; background: linear-gradient(90deg, var(--accent), transparent); }
  .panel-bar.gold   { background: linear-gradient(90deg, #f0c040, transparent); }
  .panel-bar.violet { background: linear-gradient(90deg, #a78bfa, transparent); }
  .panel-bar.red    { background: linear-gradient(90deg, #f87171, transparent); }
  .panel-body { padding: 24px 28px; }

  .table-scroll { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 11px; }
  .data-table th {
    padding: 10px 14px; text-align: left; color: var(--text-muted);
    font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  .data-table td {
    padding: 9px 14px; color: var(--text-dim);
    border-bottom: 1px solid rgba(255,255,255,0.03); white-space: nowrap;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:hover td { background: var(--surface-2); color: var(--text); }

  .chart-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: 2px; overflow: hidden; transition: border-color 0.2s; }
  .chart-card:hover { border-color: rgba(255,255,255,0.12); }
  .chart-card-bar { height: 2px; background: linear-gradient(90deg, var(--accent), transparent); }
  .chart-card-bar.violet { background: linear-gradient(90deg, #a78bfa, transparent); }
  .chart-card-body { padding: 18px 20px 20px; }
  .chart-col-name {
    font-family: var(--mono); font-size: 11px; color: var(--text-dim);
    margin-bottom: 14px; letter-spacing: 0.05em; display: flex; align-items: center; gap: 7px;
  }
  .chart-col-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .chart-col-dot.violet { background: #a78bfa; }

  /* model scores */
  .scores-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .score-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 2px; padding: 18px 20px; }
  .score-card-name {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em;
    color: #a78bfa; margin-bottom: 14px; display: flex; align-items: center; gap: 6px;
  }
  .score-card-name.best { color: var(--accent); }
  .score-metric { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
  .score-metric-label { font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
  .score-metric-num { font-family: var(--mono); font-size: 13px; color: var(--text-dim); margin-bottom: 2px; }

  .corr-scroll { overflow-x: auto; }
  .corr-table { border-collapse: collapse; font-family: var(--mono); font-size: 10px; }
  .corr-table th, .corr-table td { padding: 7px 10px; text-align: center; border: 1px solid rgba(255,255,255,0.04); white-space: nowrap; }
  .corr-table th { color: var(--text-muted); font-size: 9px; letter-spacing: 0.08em; background: var(--surface-2); }
  .corr-table td { font-size: 10px; color: var(--text); min-width: 54px; transition: filter 0.15s; }
  .corr-table td:hover { filter: brightness(1.3); }

  .missing-list { display: flex; flex-direction: column; gap: 10px; }
  .missing-row { display: flex; align-items: center; gap: 14px; }
  .missing-col { font-family: var(--mono); font-size: 11px; color: var(--text-dim); width: 160px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .missing-bar-track { flex: 1; height: 3px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
  .missing-bar-fill { height: 100%; background: #f87171; border-radius: 999px; min-width: 2px; }
  .missing-count { font-family: var(--mono); font-size: 10px; color: #f87171; width: 34px; text-align: right; flex-shrink: 0; }

  .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
  .summary-col-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 2px; padding: 16px 18px; }
  .summary-col-name { font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; color: var(--accent); margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
  .summary-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .summary-stat-row:last-child { border-bottom: none; }
  .summary-stat-key { font-family: var(--mono); font-size: 10px; color: var(--text-muted); text-transform: lowercase; letter-spacing: 0.05em; }
  .summary-stat-val { font-family: var(--mono); font-size: 11px; color: var(--text-dim); }

  .badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px; border: 1px solid;
  }
  .badge-green  { color: #63d2b3; border-color: rgba(99,210,179,0.3); background: rgba(99,210,179,0.07); }
  .badge-violet { color: #a78bfa; border-color: rgba(167,139,250,0.3); background: rgba(167,139,250,0.07); }

  .cta-btn {
    align-self: flex-start; padding: 13px 28px; background: var(--accent);
    color: #0a0b0f; border: none; border-radius: 2px; font-family: var(--sans);
    font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: opacity 0.2s, transform 0.15s;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both;
  }
  .cta-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
  .cta-btn:active { transform: translateY(0); }

  .state-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 2px;
    padding: 60px 40px; display: flex; flex-direction: column; align-items: center;
    gap: 12px; text-align: center; animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }
  .state-icon {
    width: 48px; height: 48px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 2px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); margin-bottom: 4px;
  }
  .state-title { font-size: 15px; font-weight: 700; color: var(--text-dim); }
  .state-sub   { font-family: var(--mono); font-size: 11px; color: var(--text-muted); }

  .loading-dots span {
    display: inline-block; width: 5px; height: 5px; border-radius: 50%;
    background: var(--accent); margin: 0 3px;
    animation: dot-bounce 1.2s infinite ease-in-out both;
  }
  .loading-dots span:nth-child(1) { animation-delay: 0s; }
  .loading-dots span:nth-child(2) { animation-delay: 0.18s; }
  .loading-dots span:nth-child(3) { animation-delay: 0.36s; }

  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40%           { transform: scale(1);   opacity: 1; }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const STAT_KEYS = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];

// ── Model scores panel ────────────────────────────────────────────────────────
function ModelScores({ scores, bestModel }) {
  if (!scores || Object.keys(scores).length === 0) return null;
  const isCls = Object.values(scores).some((s) => s?.test_accuracy !== undefined);

  return (
    <div className="section" style={{ animationDelay: "0.10s" }}>
      <div className="section-label">Model Comparison</div>
      <div className="scores-grid">
        {Object.entries(scores).map(([name, s]) => {
          if (s?.error) return (
            <div className="score-card" key={name}>
              <div className="score-card-name">{name}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: RED }}>{s.error}</div>
            </div>
          );
          const shortName = name.replace("Classifier","").replace("Regressor","").replace("Regression","Reg");
          const isBest = name.includes(bestModel || "");
          return (
            <div className="score-card" key={name} style={isBest ? { borderColor: "rgba(99,210,179,0.25)" } : {}}>
              <div className={`score-card-name ${isBest ? "best" : ""}`}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg>
                {shortName}
                {isBest && <span className="badge badge-green" style={{ marginLeft: "auto" }}>best</span>}
              </div>

              {isCls ? (
                <>
                  <div className="score-metric">
                    <div className="score-metric-label">CV score (f1-weighted)</div>
                    <div className="score-metric-num">{s.cv_mean} <span style={{ color: TEXT_MUT }}>± {s.cv_std}</span></div>
                    <ScoreBar value={s.cv_mean} color={isBest ? ACCENT : VIOLET} />
                  </div>
                  <div className="score-metric">
                    <div className="score-metric-label">Test accuracy</div>
                    <div className="score-metric-num">{s.test_accuracy}</div>
                    <ScoreBar value={s.test_accuracy} color={isBest ? ACCENT : VIOLET} />
                  </div>
                </>
              ) : (
                <>
                  <div className="score-metric">
                    <div className="score-metric-label">CV R² (mean ± std)</div>
                    <div className="score-metric-num">{s.cv_mean_r2} <span style={{ color: TEXT_MUT }}>± {s.cv_std}</span></div>
                    <ScoreBar value={Math.max(0, s.cv_mean_r2)} color={isBest ? ACCENT : VIOLET} />
                  </div>
                  <div className="score-metric">
                    <div className="score-metric-label">Test MAE</div>
                    <div className="score-metric-num">{s.test_mae}</div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EDA() {
  const [data, setData]     = useState(null);
  const [trainRes, setTrainRes] = useState(null);
  const [error, setError]   = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
  const stored = localStorage.getItem("automl_results");

  // 🚨 If no results → don't even call backend
  if (!stored) {
    setError("No dataset loaded. Please upload a dataset first.");
    return;
  }

  axios.get(`${API}/eda`)
    .then((res) => setData(res.data))
    .catch((err) => setError(err.response?.data?.detail || "Failed to load EDA data."));
}, []);

  // Fetch latest train result for the scores panel (optional — may not exist)
  useEffect(() => {
    axios.get(`${API}/model_info`)
      .then((res) => setTrainRes(res.data))
      .catch(() => {});
  }, []);

  if (!data && !error)
    return (
      <Layout><style>{styles}</style>
        <div className="eda-root"><div className="eda-inner">
          <div className="state-card">
            <div className="loading-dots"><span/><span/><span/></div>
            <div className="state-title">Analysing dataset…</div>
            <div className="state-sub">Fetching EDA from server</div>
          </div>
        </div></div>
      </Layout>
    );

  if (error)
    return (
      <Layout><style>{styles}</style>
        <div className="eda-root"><div className="eda-inner">
          <div className="state-card">
            <div className="state-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="state-title" style={{ color: "#f87171" }}>{error}</div>
            <div className="state-sub">Check that a dataset has been uploaded and trained.</div>
          </div>
        </div></div>
      </Layout>
    );

  // Derived
  const missingEntries = Object.entries(data.missing || {});
  const maxMissing     = Math.max(...missingEntries.map(([, v]) => v), 1);
  const summaryColNames = Object.keys(data.summary || {});
  const numericCols     = data.numeric_columns || [];
  const categoricalCols = data.categorical_columns || [];

  return (
    <Layout>
      <style>{styles}</style>
      <div className="eda-root">
        <div className="eda-inner">

          {/* ── Header ── */}
          <div className="page-header">
            <div className="page-eyebrow">AutoML · Exploratory Analysis</div>
            <h1 className="page-title">
              EDA <span>Dashboard</span>
              {data.has_model && (
                <span style={{ marginLeft: 12 }} className="badge badge-green">● model ready</span>
              )}
            </h1>
          </div>

          {/* ── Stat strip ── */}
          <div className="stat-strip" style={{ animation: "fadeUp 0.42s cubic-bezier(0.16,1,0.3,1) both", animationDelay: "0.04s" }}>
            <div className="stat-cell">
              <div className="stat-cell-label">Rows</div>
              <div className="stat-cell-value">{(data.num_rows || 0).toLocaleString()}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Columns</div>
              <div className="stat-cell-value">{data.num_columns || 0}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Numeric</div>
              <div className="stat-cell-value"><span>{numericCols.length}</span></div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Categorical</div>
              <div className="stat-cell-value"><span style={{ color: VIOLET }}>{categoricalCols.length}</span></div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Missing</div>
              <div className="stat-cell-value">
                <span style={{ color: data.missing_total > 0 ? RED : ACCENT }}>
                  {data.missing_total || 0}
                </span>
              </div>
            </div>
          </div>

          {/* ── Columns ── */}
          <div className="section" style={{ animationDelay: "0.06s" }}>
            <div className="section-label">Dataset Columns</div>
            <div className="pill-row">
              {data.columns.map((col) => {
                const isNum = numericCols.includes(col);
                const isCat = categoricalCols.includes(col);
                return (
                  <div className="col-pill" key={col} style={{
                    borderColor: isNum ? "rgba(99,210,179,0.2)" : isCat ? "rgba(167,139,250,0.2)" : undefined,
                    color: isNum ? ACCENT : isCat ? VIOLET : undefined,
                  }}>
                    {col}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Sample ── */}
          <div className="section" style={{ animationDelay: "0.08s" }}>
            <div className="section-label">Sample Data</div>
            <div className="panel">
              <div className="panel-bar"/>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr>{data.columns.map((col) => <th key={col}>{col}</th>)}</tr></thead>
                  <tbody>
                    {data.sample.map((row, i) => (
                      <tr key={i}>{data.columns.map((col) => <td key={`${i}-${col}`}>{row[col] ?? "—"}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Model scores (shown if train result cached) ── */}
          {data.has_model && trainRes && (
            <ModelScores scores={trainRes._scores} bestModel={trainRes.model_type} />
          )}

          {/* ── Histograms ── */}
          {data.histograms && numericCols.length > 0 && Object.keys(data.histograms).length > 0 && (
            <div className="section" style={{ animationDelay: "0.12s" }}>
              <div className="section-label">Histograms</div>
              <div className="chart-grid">
                {Object.entries(data.histograms).map(([col, values]) => (
                  <div className="chart-card" key={col}>
                    <div className="chart-card-bar"/>
                    <div className="chart-card-body">
                      <div className="chart-col-name"><div className="chart-col-dot"/>{col}</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={values} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke={BORDER} vertical={false}/>
                          <XAxis dataKey="bin" tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false}/>
                          <YAxis tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false}/>
                          <Tooltip content={<ChartTooltip/>} cursor={{ fill: "rgba(99,210,179,0.06)" }}/>
                          <Bar dataKey="count" fill={ACCENT} radius={[2,2,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Categorical pie charts ── */}
          {data.categorical && categoricalCols.length > 0 && Object.keys(data.categorical).length > 0 && (
            <div className="section" style={{ animationDelay: "0.15s" }}>
              <div className="section-label">Categorical Distribution</div>
              <div className="chart-grid">
                {Object.entries(data.categorical).map(([col, values]) => {
                  const chartData = Object.entries(values).map(([k, v]) => ({ name: k, value: v }));
                  return (
                    <div className="chart-card" key={col}>
                      <div className="chart-card-bar violet"/>
                      <div className="chart-card-body">
                        <div className="chart-col-name"><div className="chart-col-dot violet"/>{col}</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={36} paddingAngle={2}>
                              {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none"/>)}
                            </Pie>
                            <Tooltip content={<ChartTooltip/>}/>
                            <Legend iconType="circle" iconSize={7} formatter={(val) => (
                              <span style={{ color: TEXT_DIM, fontFamily: "'DM Mono'", fontSize: 10 }}>{val}</span>
                            )}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Correlation matrix ── */}
          {data.correlation && Object.keys(data.correlation).length > 0 && (
            <div className="section" style={{ animationDelay: "0.18s" }}>
              <div className="section-label">Correlation Matrix</div>
              <div className="panel">
                <div className="panel-bar gold"/>
                <div className="panel-body">
                  <div className="corr-scroll">
                    <table className="corr-table">
                      <thead>
                        <tr>
                          <th/>
                          {Object.keys(data.correlation).map((col) => <th key={col}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.correlation).map(([row, cols]) => (
                          <tr key={row}>
                            <th>{row}</th>
                            {Object.values(cols).map((val, i) => (
                              <td key={i} style={{ background: corrColor(val), color: Math.abs(val) > 0.5 ? "#e8eaf0" : TEXT_DIM }}>
                                {val.toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Feature importance ── */}
          {data.importance && Object.keys(data.importance).length > 0 && (
            <div className="section" style={{ animationDelay: "0.21s" }}>
              <div className="section-label">Feature Importance</div>
              <div className="panel">
                <div className="panel-bar violet"/>
                <div className="panel-body">
                  <ResponsiveContainer width="100%" height={Math.max(200, Object.keys(data.importance).length * 28)}>
                    <BarChart
                      layout="vertical"
                      data={Object.entries(data.importance).sort((a,b) => b[1]-a[1]).map(([k,v]) => ({ name: k, value: v }))}
                      margin={{ top: 0, right: 20, bottom: 0, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke={BORDER} horizontal={false}/>
                      <XAxis type="number" tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: TEXT_DIM, fontSize: 10, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false}/>
                      <Tooltip content={<ChartTooltip/>} cursor={{ fill: "rgba(167,139,250,0.06)" }}/>
                      <Bar dataKey="value" fill={VIOLET} radius={[0,2,2,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── Missing values ── */}
          <div className="section" style={{ animationDelay: "0.24s" }}>
            <div className="section-label">Missing Values</div>
            <div className="panel">
              <div className="panel-bar red"/>
              <div className="panel-body">
                {missingEntries.every(([,v]) => v === 0) ? (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: ACCENT, display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    No missing values detected
                  </div>
                ) : (
                  <div className="missing-list">
                    {missingEntries.filter(([,v]) => v > 0).map(([col, val]) => (
                      <div className="missing-row" key={col}>
                        <div className="missing-col">{col}</div>
                        <div className="missing-bar-track">
                          <div className="missing-bar-fill" style={{ width: `${(val / maxMissing) * 100}%` }}/>
                        </div>
                        <div className="missing-count">{val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Summary statistics ── */}
          {data.summary && summaryColNames.length > 0 && (
            <div className="section" style={{ animationDelay: "0.27s" }}>
              <div className="section-label">Summary Statistics</div>
              <div className="summary-grid">
                {summaryColNames.map((col) => (
                  <div className="summary-col-card" key={col}>
                    <div className="summary-col-name">
                      <svg width="9" height="9" viewBox="0 0 10 10" fill={ACCENT}><circle cx="5" cy="5" r="5"/></svg>
                      {col}
                    </div>
                    {STAT_KEYS.filter((k) => data.summary[col]?.[k] !== undefined).map((k) => (
                      <div className="summary-stat-row" key={k}>
                        <span className="summary-stat-key">{k}</span>
                        <span className="summary-stat-val">
                          {typeof data.summary[col][k] === "number"
                            ? data.summary[col][k].toFixed(4)
                            : data.summary[col][k]}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CTA ── */}
          <button className="cta-btn" onClick={() => navigate("/predictor")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Run Predictor
          </button>

        </div>
      </div>
    </Layout>
  );
}