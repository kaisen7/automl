import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import API from "../api";
import { useNavigate } from "react-router-dom";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

// ── Tokens ────────────────────────────────────────────────────────────────────
const ACCENT = "#63d2b3";
const VIOLET = "#a78bfa";
const RED = "#f87171";
const GOLD = "#f0c040";
const TEXT_DIM = "#9ca3af";
const TEXT_MUT = "#6b7280";
const BORDER = "rgba(255,255,255,0.07)";

const PIE_COLORS = [
  "#63d2b3","#a78bfa","#f0c040","#f87171",
  "#60a5fa","#fb923c","#34d399","#e879f9",
];

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

// ── Correlation colour ─────────────────────────────────────────────────────────
const corrColor = (val) => {
  const v = Math.max(-1, Math.min(1, val));
  if (v > 0) return `rgba(99,210,179,${(v * 0.75 + 0.1).toFixed(2)})`;
  if (v < 0) return `rgba(248,113,113,${(Math.abs(v) * 0.75 + 0.1).toFixed(2)})`;
  return "transparent";
};

// ── Score bar ─────────────────────────────────────────────────────────────────
const ScoreBar = ({ value, color = ACCENT }) => {
  const pct = Math.min(Math.max(value * 100, 0), 100).toFixed(1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        flex: 1, height: 3, background: "rgba(255,255,255,0.06)",
        borderRadius: 999, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 999, transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
      <span style={{
        fontFamily: "'DM Mono',monospace", fontSize: 11,
        color: TEXT_DIM, minWidth: 42, textAlign: "right",
      }}>{pct}%</span>
    </div>
  );
};

// ── CSV Export helper ─────────────────────────────────────────────────────────
function exportSummaryCSV(summary, columns) {
  const STAT_KEYS = ["count","mean","std","min","25%","50%","75%","max"];
  const header = ["column", ...STAT_KEYS].join(",");
  const rows = columns
    .filter((col) => summary[col])
    .map((col) => {
      const vals = STAT_KEYS.map((k) => {
        const v = summary[col]?.[k];
        return v !== undefined ? (typeof v === "number" ? v.toFixed(6) : v) : "";
      });
      return [col, ...vals].join(",");
    });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "eda_summary_statistics.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── ML Readiness helper ───────────────────────────────────────────────────────
function buildMLReadiness(data) {
  const issues = [];
  const warnings = [];
  const ok = [];

  // Missing values
  const missingCols = Object.entries(data.missing || {}).filter(([, v]) => v > 0);
  if (missingCols.length > 0) {
    issues.push({
      icon: "⚠",
      color: RED,
      label: `${missingCols.length} column${missingCols.length > 1 ? "s" : ""} have missing values`,
      detail: missingCols.map(([c]) => c).join(", "),
      action: "Impute or drop before training",
    });
  } else {
    ok.push({ label: "No missing values", icon: "✓" });
  }

  // Duplicates
  if ((data.duplicate_rows || 0) > 0) {
    warnings.push({
      icon: "⚠",
      color: GOLD,
      label: `${data.duplicate_rows} duplicate rows detected`,
      detail: `${((data.duplicate_rows / data.num_rows) * 100).toFixed(1)}% of dataset`,
      action: "Consider deduplication",
    });
  } else {
    ok.push({ label: "No duplicate rows", icon: "✓" });
  }

  // High cardinality categoricals
  const highCard = (data.categorical_columns || []).filter((col) => {
    const vals = data.categorical?.[col];
    return vals && Object.keys(vals).length > 20;
  });
  if (highCard.length > 0) {
    warnings.push({
      icon: "⚠",
      color: GOLD,
      label: `${highCard.length} high-cardinality categorical column${highCard.length > 1 ? "s" : ""}`,
      detail: highCard.join(", "),
      action: "Consider target encoding or grouping rare values",
    });
  }

  // Outlier-heavy columns
  const outlierCols = Object.entries(data.outliers || {}).filter(([, v]) => v > 0);
  if (outlierCols.length > 0) {
    warnings.push({
      icon: "⚠",
      color: GOLD,
      label: `${outlierCols.length} column${outlierCols.length > 1 ? "s" : ""} contain outliers`,
      detail: outlierCols.map(([c, v]) => `${c}(${v})`).join(", "),
      action: "Apply clipping or robust scaling",
    });
  }

  // Scaling suggestion for numeric cols
  if ((data.numeric_columns || []).length > 1) {
    warnings.push({
      icon: "◎",
      color: VIOLET,
      label: `${data.numeric_columns.length} numeric columns may need scaling`,
      detail: "Standardisation or min-max recommended",
      action: "Use StandardScaler or MinMaxScaler",
    });
  }

  // Class imbalance
  if (data.class_balance) {
    const vals = Object.values(data.class_balance);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const ratio = max / (min || 1);
    if (ratio > 3) {
      issues.push({
        icon: "⚠",
        color: RED,
        label: `Class imbalance detected (ratio ${ratio.toFixed(1)}×)`,
        detail: Object.entries(data.class_balance).map(([k, v]) => `${k}: ${v}`).join(", "),
        action: "Use SMOTE, class_weight='balanced', or resample",
      });
    } else {
      ok.push({ label: "Classes are reasonably balanced", icon: "✓" });
    }
  }

  if (ok.length === Object.keys({ ...data.missing }).length) {
    ok.push({ label: "Dataset looks clean", icon: "✓" });
  }

  return { issues, warnings, ok };
}

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
  .page-title { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .page-title span { color: var(--accent); }

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

  /* ── Column search bar ── */
  .col-search-wrap { position: relative; }
  .col-search-input {
    width: 100%; padding: 10px 16px 10px 38px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 2px; color: var(--text); font-family: var(--mono);
    font-size: 11px; outline: none; transition: border-color 0.2s;
  }
  .col-search-input:focus { border-color: var(--border-active); }
  .col-search-icon {
    position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
    color: var(--text-muted); pointer-events: none;
  }
  .col-filter-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .col-filter-btn {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em;
    text-transform: uppercase; padding: 5px 12px;
    border: 1px solid var(--border); border-radius: 999px;
    background: transparent; color: var(--text-muted);
    cursor: pointer; transition: all 0.15s;
  }
  .col-filter-btn:hover, .col-filter-btn.active {
    border-color: var(--border-active); color: var(--accent);
    background: var(--accent-dim);
  }
  .col-filter-btn.violet.active { color: #a78bfa; border-color: rgba(167,139,250,0.4); background: rgba(167,139,250,0.08); }

  .pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .col-pill {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.06em;
    padding: 5px 12px; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 999px; color: var(--text-dim); transition: border-color 0.2s, color 0.2s;
    cursor: default;
  }
  .col-pill:hover { border-color: var(--border-active); color: var(--accent); }
  .col-pill-none { font-family: var(--mono); font-size: 11px; color: var(--text-muted); font-style: italic; }

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
  .chart-card-bar.gold { background: linear-gradient(90deg, #f0c040, transparent); }
  .chart-card-bar.red { background: linear-gradient(90deg, #f87171, transparent); }
  .chart-card-body { padding: 18px 20px 20px; }
  .chart-col-name {
    font-family: var(--mono); font-size: 11px; color: var(--text-dim);
    margin-bottom: 14px; letter-spacing: 0.05em; display: flex; align-items: center; gap: 7px;
  }
  .chart-col-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .chart-col-dot.violet { background: #a78bfa; }
  .chart-col-dot.gold { background: #f0c040; }
  .chart-col-dot.red { background: #f87171; }

  /* ── Outlier panel ── */
  .outlier-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .outlier-card {
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 2px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
    transition: border-color 0.2s;
  }
  .outlier-card.has-outliers { border-color: rgba(248,113,113,0.2); }
  .outlier-card-name { font-family: var(--mono); font-size: 10px; letter-spacing: 0.07em; color: var(--text-dim); display: flex; align-items: center; justify-content: space-between; }
  .outlier-count { font-family: var(--mono); font-size: 18px; font-weight: 700; }
  .outlier-count.zero { color: var(--accent); }
  .outlier-count.has { color: #f87171; }
  .outlier-bar-track { height: 3px; background: var(--surface-3); border-radius: 999px; overflow: hidden; }
  .outlier-bar-fill { height: 100%; background: #f87171; border-radius: 999px; min-width: 2px; transition: width 0.8s cubic-bezier(0.16,1,0.3,1); }
  .outlier-bar-fill.zero { background: rgba(99,210,179,0.3); }

  /* ── ML Readiness ── */
  .readiness-list { display: flex; flex-direction: column; gap: 10px; }
  .readiness-item {
    display: flex; gap: 14px; align-items: flex-start;
    padding: 14px 16px; border-radius: 2px;
    border: 1px solid rgba(255,255,255,0.04);
    background: var(--surface-2);
    transition: border-color 0.2s;
  }
  .readiness-item:hover { border-color: rgba(255,255,255,0.09); }
  .readiness-item-icon {
    width: 28px; height: 28px; border-radius: 2px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; flex-shrink: 0; margin-top: 1px;
  }
  .readiness-item-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .readiness-item-label { font-family: var(--mono); font-size: 11px; color: var(--text); }
  .readiness-item-detail { font-family: var(--mono); font-size: 10px; color: var(--text-muted); }
  .readiness-item-action {
    font-family: var(--mono); font-size: 10px;
    display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;
  }
  .readiness-ok-row {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--mono); font-size: 11px; color: var(--accent);
    padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.03);
  }
  .readiness-ok-row:last-child { border-bottom: none; }

  /* ── Scatter ── */
  .scatter-pair-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
  }
  .scatter-pair-cols {
    font-family: var(--mono); font-size: 11px; color: var(--text-dim);
    display: flex; align-items: center; gap: 6px;
  }
  .scatter-corr-badge {
    font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em;
    padding: 3px 8px; border-radius: 999px; border: 1px solid;
  }

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
  .corr-table td { font-size: 10px; color: var(--text); min-width: 54px; transition: filter 0.15s; cursor: pointer; }
  .corr-table td:hover { filter: brightness(1.4); outline: 1px solid rgba(99,210,179,0.3); }
  .corr-table td.selected { outline: 2px solid rgba(99,210,179,0.6); }

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
  .badge-red    { color: #f87171; border-color: rgba(248,113,113,0.3); background: rgba(248,113,113,0.07); }
  .badge-gold   { color: #f0c040; border-color: rgba(240,192,64,0.3); background: rgba(240,192,64,0.07); }

  .action-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

  .cta-btn {
    padding: 13px 28px; background: var(--accent);
    color: #0a0b0f; border: none; border-radius: 2px; font-family: var(--sans);
    font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: opacity 0.2s, transform 0.15s;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both;
  }
  .cta-btn:hover  { opacity: 0.88; transform: translateY(-1px); }
  .cta-btn:active { transform: translateY(0); }

  .ghost-btn {
    padding: 13px 22px; border: 1px solid var(--border);
    border-radius: 2px; background: transparent; color: var(--text-dim);
    font-family: var(--sans); font-size: 12px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: border-color 0.2s, color 0.2s;
    animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s both;
  }
  .ghost-btn:hover { border-color: rgba(255,255,255,0.18); color: var(--text); }

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

const STAT_KEYS = ["count","mean","std","min","25%","50%","75%","max"];

// ── Model scores panel ─────────────────────────────────────────────────────────
function ModelScores({ scores, bestModel }) {
  if (!scores || Object.keys(scores).length === 0) return null;
  const isCls = Object.values(scores).some((s) => s?.test_accuracy !== undefined);
  return (
    <div className="section" style={{ animationDelay: "0.10s" }}>
      <div className="section-label">Model Comparison</div>
      <div className="scores-grid">
        {Object.entries(scores).map(([name, s]) => {
          if (s?.error)
            return (
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
                <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5" /></svg>
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

// ── Outlier Panel ─────────────────────────────────────────────────────────────
function OutlierPanel({ outliers, numRows }) {
  if (!outliers || Object.keys(outliers).length === 0) return null;
  const maxCount = Math.max(...Object.values(outliers), 1);
  const totalOutliers = Object.values(outliers).reduce((a, b) => a + b, 0);

  return (
    <div className="section" style={{ animationDelay: "0.13s" }}>
      <div className="section-label">
        Outlier Detection
        {totalOutliers > 0 && (
          <span className="badge badge-red" style={{ marginLeft: 0 }}>IQR method · {totalOutliers} total</span>
        )}
      </div>
      <div className="outlier-grid">
        {Object.entries(outliers).map(([col, count]) => {
          const pct = numRows ? ((count / numRows) * 100).toFixed(1) : "0.0";
          const hasOutliers = count > 0;
          return (
            <div className={`outlier-card ${hasOutliers ? "has-outliers" : ""}`} key={col}>
              <div className="outlier-card-name">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>{col}</span>
                {hasOutliers
                  ? <span className="badge badge-red">{pct}%</span>
                  : <span className="badge badge-green">clean</span>
                }
              </div>
              <div className={`outlier-count ${hasOutliers ? "has" : "zero"}`}>
                {count} <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: TEXT_MUT, fontWeight: 400 }}>
                  row{count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="outlier-bar-track">
                <div
                  className={`outlier-bar-fill ${!hasOutliers ? "zero" : ""}`}
                  style={{ width: hasOutliers ? `${(count / maxCount) * 100}%` : "100%" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scatter Plots for top correlated pairs ────────────────────────────────────
function ScatterPairs({ correlation, scatterData, selectedPair, onSelectPair }) {
  if (!correlation || Object.keys(correlation).length === 0) return null;

  // Get top 6 correlated pairs (excluding self-correlations)
  const pairs = [];
  const cols = Object.keys(correlation);
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const val = correlation[cols[i]]?.[cols[j]];
      if (val !== undefined && !isNaN(val)) {
        pairs.push({ colA: cols[i], colB: cols[j], corr: val });
      }
    }
  }
  pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  const topPairs = pairs.slice(0, 6);

  if (topPairs.length === 0) return null;

  return (
    <div className="section" style={{ animationDelay: "0.16s" }}>
      <div className="section-label">Scatter Plots · Top Correlated Pairs</div>
      <div className="chart-grid">
        {topPairs.map(({ colA, colB, corr }) => {
          const key = `${colA}__${colB}`;
          const isSelected = selectedPair === key;
          const corrAbs = Math.abs(corr);
          const corrBadgeColor = corrAbs > 0.7
            ? (corr > 0 ? ACCENT : RED)
            : corrAbs > 0.4 ? GOLD : TEXT_DIM;
          const corrBadgeBorder = corrAbs > 0.7
            ? (corr > 0 ? "rgba(99,210,179,0.4)" : "rgba(248,113,113,0.4)")
            : corrAbs > 0.4 ? "rgba(240,192,64,0.4)" : "rgba(255,255,255,0.1)";
          const chartPoints = scatterData?.[key] || [];

          return (
            <div
              className="chart-card"
              key={key}
              style={isSelected ? { borderColor: "rgba(99,210,179,0.3)" } : {}}
              onClick={() => onSelectPair(isSelected ? null : key)}
            >
              <div className={`chart-card-bar ${corrAbs > 0.7 ? (corr > 0 ? "" : "red") : "gold"}`} />
              <div className="chart-card-body">
                <div className="scatter-pair-header">
                  <div className="scatter-pair-cols">
                    <div className={`chart-col-dot ${corrAbs > 0.7 ? (corr > 0 ? "" : "red") : "gold"}`} />
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{colA}</span>
                    <span style={{ color: TEXT_MUT, fontSize: 9 }}>vs</span>
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{colB}</span>
                  </div>
                  <span
                    className="scatter-corr-badge"
                    style={{ color: corrBadgeColor, borderColor: corrBadgeBorder, background: "transparent", fontSize: 9, fontFamily: "var(--mono)", letterSpacing: "0.06em" }}
                  >
                    r = {corr.toFixed(3)}
                  </span>
                </div>
                {chartPoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <ScatterChart margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke={BORDER} />
                      <XAxis
                        dataKey="x" type="number" name={colA}
                        tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        dataKey="y" type="number" name={colB}
                        tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }}
                        axisLine={false} tickLine={false}
                      />
                      <ZAxis range={[18, 18]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3", stroke: BORDER }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div style={{ background: "#111318", border: "1px solid rgba(99,210,179,0.25)", borderRadius: 2, padding: "8px 14px", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
                              <div style={{ color: TEXT_MUT, fontSize: 10, marginBottom: 3 }}>{colA}: <span style={{ color: ACCENT }}>{d?.x?.toFixed(3)}</span></div>
                              <div style={{ color: TEXT_MUT, fontSize: 10 }}>{colB}: <span style={{ color: VIOLET }}>{d?.y?.toFixed(3)}</span></div>
                            </div>
                          );
                        }}
                      />
                      <Scatter
                        data={chartPoints}
                        fill={corrAbs > 0.7 ? (corr > 0 ? ACCENT : RED) : GOLD}
                        fillOpacity={0.55}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    height: 180, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--mono)", fontSize: 10, color: TEXT_MUT,
                  }}>
                    No sample data available
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ML Readiness Panel ────────────────────────────────────────────────────────
function MLReadinessPanel({ data }) {
  const { issues, warnings, ok } = useMemo(() => buildMLReadiness(data), [data]);
  const score = Math.max(0, 100 - issues.length * 25 - warnings.length * 10);
  const scoreColor = score >= 80 ? ACCENT : score >= 50 ? GOLD : RED;

  return (
    <div className="section" style={{ animationDelay: "0.22s" }}>
      <div className="section-label">
        ML Readiness
        <span style={{
          fontFamily: "var(--mono)", fontSize: 12, color: scoreColor,
          letterSpacing: "-0.02em", fontWeight: 700, marginLeft: 2,
        }}>
          {score}/100
        </span>
      </div>
      <div className="panel">
        <div className="panel-bar" style={{ background: `linear-gradient(90deg, ${scoreColor}, transparent)` }} />
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* score bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              flex: 1, height: 4, background: "rgba(255,255,255,0.05)",
              borderRadius: 999, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${score}%`, background: scoreColor,
                borderRadius: 999, transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
              }} />
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: scoreColor, minWidth: 50, textAlign: "right" }}>
              {score >= 80 ? "Ready" : score >= 50 ? "Needs work" : "Not ready"}
            </span>
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: RED, marginBottom: 10 }}>
                Issues — must fix
              </div>
              <div className="readiness-list">
                {issues.map((item, i) => (
                  <div className="readiness-item" key={i} style={{ borderColor: "rgba(248,113,113,0.15)" }}>
                    <div className="readiness-item-icon" style={{ background: "rgba(248,113,113,0.1)", color: RED }}>{item.icon}</div>
                    <div className="readiness-item-body">
                      <div className="readiness-item-label" style={{ color: RED }}>{item.label}</div>
                      {item.detail && <div className="readiness-item-detail">{item.detail}</div>}
                      {item.action && (
                        <div className="readiness-item-action" style={{ color: RED }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                          {item.action}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: GOLD, marginBottom: 10 }}>
                Warnings — recommended
              </div>
              <div className="readiness-list">
                {warnings.map((item, i) => (
                  <div className="readiness-item" key={i} style={{ borderColor: "rgba(240,192,64,0.12)" }}>
                    <div className="readiness-item-icon" style={{ background: "rgba(240,192,64,0.08)", color: GOLD }}>{item.icon}</div>
                    <div className="readiness-item-body">
                      <div className="readiness-item-label" style={{ color: GOLD }}>{item.label}</div>
                      {item.detail && <div className="readiness-item-detail">{item.detail}</div>}
                      {item.action && (
                        <div className="readiness-item-action" style={{ color: GOLD }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                          {item.action}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OK items */}
          {ok.length > 0 && (
            <div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: ACCENT, marginBottom: 10 }}>
                Passing checks
              </div>
              <div style={{ paddingLeft: 4 }}>
                {ok.map((item, i) => (
                  <div className="readiness-ok-row" key={i}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function EDA() {
  const [data, setData] = useState(null);
  const [trainRes, setTrainRes] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Column search / filter state
  const [colSearch, setColSearch] = useState("");
  const [colTypeFilter, setColTypeFilter] = useState("all"); // "all" | "numeric" | "categorical"

  // Scatter pair selection
  const [selectedPair, setSelectedPair] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("automl_results");
    if (!stored) {
      setError("No dataset loaded. Please upload a dataset first.");
      return;
    }
    axios
      .get(`${API}/eda`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Failed to load EDA data."));
  }, []);

  useEffect(() => {
    axios.get(`${API}/model_info`).then((res) => setTrainRes(res.data)).catch(() => {});
  }, []);

  // Filtered columns
  const filteredCols = useMemo(() => {
    if (!data) return [];
    let cols = data.columns || [];
    if (colTypeFilter === "numeric") cols = cols.filter((c) => (data.numeric_columns || []).includes(c));
    else if (colTypeFilter === "categorical") cols = cols.filter((c) => (data.categorical_columns || []).includes(c));
    if (colSearch.trim()) {
      const q = colSearch.trim().toLowerCase();
      cols = cols.filter((c) => c.toLowerCase().includes(q));
    }
    return cols;
  }, [data, colSearch, colTypeFilter]);

  if (!data && !error)
    return (
      <Layout>
        <style>{styles}</style>
        <div className="eda-root">
          <div className="eda-inner">
            <div className="state-card">
              <div className="loading-dots"><span /><span /><span /></div>
              <div className="state-title">Analysing dataset…</div>
              <div className="state-sub">Fetching EDA from server</div>
            </div>
          </div>
        </div>
      </Layout>
    );

  if (error)
    return (
      <Layout>
        <style>{styles}</style>
        <div className="eda-root">
          <div className="eda-inner">
            <div className="state-card">
              <div className="state-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="state-title" style={{ color: "#f87171" }}>{error}</div>
              <div className="state-sub">Check that a dataset has been uploaded and trained.</div>
              <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => (window.location.href = "/")}>Go to Upload</button>
            </div>
          </div>
        </div>
      </Layout>
    );

  // Derived
  const missingEntries = Object.entries(data.missing || {});
  const maxMissing = Math.max(...missingEntries.map(([, v]) => v), 1);
  const summaryColNames = Object.keys(data.summary || {});
  const numericCols = data.numeric_columns || [];
  const categoricalCols = data.categorical_columns || [];
  const duplicateRows = data.duplicate_rows ?? 0;
  const totalOutliers = Object.values(data.outliers || {}).reduce((a, b) => a + b, 0);

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
                <span className="badge badge-green">● model ready</span>
              )}
              {totalOutliers > 0 && (
                <span className="badge badge-red">⚠ {totalOutliers} outliers</span>
              )}
              {duplicateRows > 0 && (
                <span className="badge badge-gold">⚠ {duplicateRows} dupes</span>
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
              <div className="stat-cell-value"><span style={{ color: data.missing_total > 0 ? RED : ACCENT }}>{data.missing_total || 0}</span></div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Duplicates</div>
              <div className="stat-cell-value"><span style={{ color: duplicateRows > 0 ? GOLD : ACCENT }}>{duplicateRows}</span></div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Outliers</div>
              <div className="stat-cell-value"><span style={{ color: totalOutliers > 0 ? RED : ACCENT }}>{totalOutliers}</span></div>
            </div>
          </div>

          {/* ── Column Search & Filter ── */}
          <div className="section" style={{ animationDelay: "0.06s" }}>
            <div className="section-label">Dataset Columns</div>

            {/* Search input */}
            <div className="col-search-wrap">
              <svg className="col-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="col-search-input"
                type="text"
                placeholder="Search columns…"
                value={colSearch}
                onChange={(e) => setColSearch(e.target.value)}
              />
            </div>

            {/* Type filter */}
            <div className="col-filter-row">
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: TEXT_MUT }}>
                Filter:
              </span>
              {[
                { key: "all", label: `All (${data.columns?.length || 0})` },
                { key: "numeric", label: `Numeric (${numericCols.length})` },
                { key: "categorical", label: `Categorical (${categoricalCols.length})`, cls: "violet" },
              ].map(({ key, label, cls }) => (
                <button
                  key={key}
                  className={`col-filter-btn ${cls || ""} ${colTypeFilter === key ? "active" : ""}`}
                  onClick={() => setColTypeFilter(key)}
                >
                  {label}
                </button>
              ))}
              {(colSearch || colTypeFilter !== "all") && (
                <button
                  className="col-filter-btn"
                  onClick={() => { setColSearch(""); setColTypeFilter("all"); }}
                  style={{ color: RED, borderColor: "rgba(248,113,113,0.3)" }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Pills */}
            <div className="pill-row">
              {filteredCols.length === 0
                ? <span className="col-pill-none">No columns match "{colSearch}"</span>
                : filteredCols.map((col) => {
                    const isNum = numericCols.includes(col);
                    const isCat = categoricalCols.includes(col);
                    return (
                      <div
                        className="col-pill"
                        key={col}
                        style={{
                          borderColor: isNum ? "rgba(99,210,179,0.2)" : isCat ? "rgba(167,139,250,0.2)" : undefined,
                          color: isNum ? ACCENT : isCat ? VIOLET : undefined,
                        }}
                      >
                        {col}
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* ── Sample ── */}
          <div className="section" style={{ animationDelay: "0.08s" }}>
            <div className="section-label">Sample Data</div>
            <div className="panel">
              <div className="panel-bar" />
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>{data.columns.map((col) => <th key={col}>{col}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.sample.map((row, i) => (
                      <tr key={i}>
                        {data.columns.map((col) => <td key={`${i}-${col}`}>{row[col] ?? "—"}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Model scores ── */}
          {data.has_model && trainRes && (
            <ModelScores scores={trainRes._scores} bestModel={trainRes.model_type} />
          )}

          {/* ── Outlier Detection ── */}
          <OutlierPanel outliers={data.outliers} numRows={data.num_rows} />

          {/* ── ML Readiness ── */}
          <MLReadinessPanel data={data} />

          {/* ── Histograms ── */}
          {data.histograms && numericCols.length > 0 && Object.keys(data.histograms).length > 0 && (
            <div className="section" style={{ animationDelay: "0.17s" }}>
              <div className="section-label">Histograms</div>
              <div className="chart-grid">
                {Object.entries(data.histograms).map(([col, values]) => (
                  <div className="chart-card" key={col}>
                    <div className="chart-card-bar" />
                    <div className="chart-card-body">
                      <div className="chart-col-name"><div className="chart-col-dot" />{col}</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={values} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke={BORDER} vertical={false} />
                          <XAxis dataKey="bin" tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(99,210,179,0.06)" }} />
                          <Bar dataKey="count" fill={ACCENT} radius={[2, 2, 0, 0]} />
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
            <div className="section" style={{ animationDelay: "0.19s" }}>
              <div className="section-label">Categorical Distribution</div>
              <div className="chart-grid">
                {Object.entries(data.categorical).map(([col, values]) => {
                  const chartData = Object.entries(values).map(([k, v]) => ({ name: k, value: v }));
                  return (
                    <div className="chart-card" key={col}>
                      <div className="chart-card-bar violet" />
                      <div className="chart-card-body">
                        <div className="chart-col-name"><div className="chart-col-dot violet" />{col}</div>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} innerRadius={36} paddingAngle={2}>
                              {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                            <Legend iconType="circle" iconSize={7} formatter={(val) => (
                              <span style={{ color: TEXT_DIM, fontFamily: "'DM Mono'", fontSize: 10 }}>{val}</span>
                            )} />
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
            <div className="section" style={{ animationDelay: "0.21s" }}>
              <div className="section-label">Correlation Matrix <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: TEXT_MUT, textTransform: "none", letterSpacing: 0 }}>· click a cell to open scatter plot</span></div>
              <div className="panel">
                <div className="panel-bar gold" />
                <div className="panel-body">
                  <div className="corr-scroll">
                    <table className="corr-table">
                      <thead>
                        <tr>
                          <th />
                          {Object.keys(data.correlation).map((col) => <th key={col}>{col}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.correlation).map(([row, cols]) => (
                          <tr key={row}>
                            <th>{row}</th>
                            {Object.entries(cols).map(([col, val], i) => {
                              const pairKey = [row, col].sort().join("__");
                              const isSelected = selectedPair === pairKey;
                              return (
                                <td
                                  key={i}
                                  className={isSelected ? "selected" : ""}
                                  style={{ background: corrColor(val), color: Math.abs(val) > 0.5 ? "#e8eaf0" : TEXT_DIM }}
                                  onClick={() => row !== col && setSelectedPair(isSelected ? null : pairKey)}
                                >
                                  {val.toFixed(2)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Scatter Plots ── */}
          <ScatterPairs
            correlation={data.correlation}
            scatterData={data.scatter_data}
            selectedPair={selectedPair}
            onSelectPair={setSelectedPair}
          />

          {/* ── Feature importance ── */}
          {data.importance && Object.keys(data.importance).length > 0 && (
            <div className="section" style={{ animationDelay: "0.25s" }}>
              <div className="section-label">Feature Importance</div>
              <div className="panel">
                <div className="panel-bar violet" />
                <div className="panel-body">
                  <ResponsiveContainer width="100%" height={Math.max(200, Object.keys(data.importance).length * 28)}>
                    <BarChart
                      layout="vertical"
                      data={Object.entries(data.importance).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, value: v }))}
                      margin={{ top: 0, right: 20, bottom: 0, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke={BORDER} horizontal={false} />
                      <XAxis type="number" tick={{ fill: TEXT_MUT, fontSize: 9, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fill: TEXT_DIM, fontSize: 10, fontFamily: "'DM Mono'" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(167,139,250,0.06)" }} />
                      <Bar dataKey="value" fill={VIOLET} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ── Missing values ── */}
          <div className="section" style={{ animationDelay: "0.27s" }}>
            <div className="section-label">Missing Values</div>
            <div className="panel">
              <div className="panel-bar red" />
              <div className="panel-body">
                {missingEntries.every(([, v]) => v === 0) ? (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: ACCENT, display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    No missing values detected
                  </div>
                ) : (
                  <div className="missing-list">
                    {missingEntries.filter(([, v]) => v > 0).map(([col, val]) => (
                      <div className="missing-row" key={col}>
                        <div className="missing-col">{col}</div>
                        <div className="missing-bar-track">
                          <div className="missing-bar-fill" style={{ width: `${(val / maxMissing) * 100}%` }} />
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
            <div className="section" style={{ animationDelay: "0.29s" }}>
              <div className="section-label">Summary Statistics</div>
              <div className="summary-grid">
                {summaryColNames.map((col) => (
                  <div className="summary-col-card" key={col}>
                    <div className="summary-col-name">
                      <svg width="9" height="9" viewBox="0 0 10 10" fill={ACCENT}><circle cx="5" cy="5" r="5" /></svg>
                      {col}
                    </div>
                    {STAT_KEYS.filter((k) => data.summary[col]?.[k] !== undefined).map((k) => (
                      <div className="summary-stat-row" key={k}>
                        <span className="summary-stat-key">{k}</span>
                        <span className="summary-stat-val">
                          {typeof data.summary[col][k] === "number" ? data.summary[col][k].toFixed(4) : data.summary[col][k]}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CTA row ── */}
          <div className="action-row">
            <button className="cta-btn" onClick={() => navigate("/predictor")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Run Predictor
            </button>
            {data.summary && summaryColNames.length > 0 && (
              <button
                className="ghost-btn"
                onClick={() => exportSummaryCSV(data.summary, summaryColNames)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Summary CSV
              </button>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
}
