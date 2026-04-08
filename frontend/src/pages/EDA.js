import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import API from "../api";
import { useNavigate } from "react-router-dom";
import "./styles/EDA.css";
import {
  ACCENT,
  VIOLET,
  RED,
  GOLD,
  TEXT_DIM,
  TEXT_MUT,
  BORDER,
  PIE_COLORS,
} from "../utils/constants.js";

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

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#111318",
        border: "1px solid rgba(99,210,179,0.25)",
        borderRadius: 2,
        padding: "8px 14px",
        fontFamily: "'DM Mono',monospace",
        fontSize: 11,
      }}
    >
      {label && (
        <div style={{ color: TEXT_MUT, marginBottom: 4, fontSize: 10 }}>
          {label}
        </div>
      )}
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
  if (v < 0)
    return `rgba(248,113,113,${(Math.abs(v) * 0.75 + 0.1).toFixed(2)})`;
  return "transparent";
};

// ── Score bar ─────────────────────────────────────────────────────────────────
const ScoreBar = ({ value, color = ACCENT }) => {
  const pct = Math.min(Math.max(value * 100, 0), 100).toFixed(1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          flex: 1,
          height: 3,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 999,
            transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: 11,
          color: TEXT_DIM,
          minWidth: 42,
          textAlign: "right",
        }}
      >
        {pct}%
      </span>
    </div>
  );
};

// ── CSV Export helper ─────────────────────────────────────────────────────────
function exportSummaryCSV(summary, columns) {
  const STAT_KEYS = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];
  const header = ["column", ...STAT_KEYS].join(",");
  const rows = columns
    .filter((col) => summary[col])
    .map((col) => {
      const vals = STAT_KEYS.map((k) => {
        const v = summary[col]?.[k];
        return v !== undefined
          ? typeof v === "number"
            ? v.toFixed(6)
            : v
          : "";
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
  const missingCols = Object.entries(data.missing || {}).filter(
    ([, v]) => v > 0,
  );
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
  const outlierCols = Object.entries(data.outliers || {}).filter(
    ([, v]) => v > 0,
  );
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
        detail: Object.entries(data.class_balance)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", "),
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

const STAT_KEYS = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];

function normalizeFeatureName(feature, categoricalCols = []) {
  if (!feature || !categoricalCols?.length) return feature;

  const matchedCat = categoricalCols.find(
    (col) =>
      feature === col ||
      feature.startsWith(`${col}_`) ||
      feature.startsWith(`${col}__`) ||
      feature.startsWith(`${col}-`),
  );

  return matchedCat || feature;
}

function truncateLabel(label, maxLength = 20) {
  if (!label || label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

function buildPieChartData(values, maxSlices = 5) {
  const entries = Object.entries(values).sort(([, a], [, b]) => b - a);
  if (entries.length <= maxSlices) {
    return entries.map(([name, value]) => ({ name, value }));
  }

  const topEntries = entries
    .slice(0, maxSlices - 1)
    .map(([name, value]) => ({ name, value }));
  const otherValue = entries
    .slice(maxSlices - 1)
    .reduce((sum, [, value]) => sum + value, 0);
  return [...topEntries, { name: "Other", value: otherValue }];
}

function PieLegend({ payload }) {
  if (!payload || !payload.length) return null;
  const ordered = [...payload].sort((a, b) => {
    if (a.value === "Other") return 1;
    if (b.value === "Other") return -1;
    return 0;
  });
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px",
        fontFamily: "'DM Mono'",
        fontSize: 10,
        color: TEXT_DIM,
      }}
    >
      {ordered.map((entry) => (
        <div
          key={entry.value}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          title={entry.value}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: entry.color,
            }}
          />
          <span>{truncateLabel(entry.value, 18)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Model scores panel ─────────────────────────────────────────────────────────
function ModelScores({ scores, bestModel }) {
  if (!scores || Object.keys(scores).length === 0) return null;
  const isCls = Object.values(scores).some(
    (s) => s?.test_accuracy !== undefined,
  );
  return (
    <div className="section" style={{ animationDelay: "0.10s" }}>
      <div className="section-label">Model Comparison</div>
      <div className="scores-grid">
        {Object.entries(scores).map(([name, s]) => {
          if (s?.error)
            return (
              <div className="score-card" key={name}>
                <div className="score-card-name">{name}</div>
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 11,
                    color: RED,
                  }}
                >
                  {s.error}
                </div>
              </div>
            );
          const shortName = name
            .replace("Classifier", "")
            .replace("Regressor", "")
            .replace("Regression", "Reg");
          const isBest = name.includes(bestModel || "");
          return (
            <div
              className="score-card"
              key={name}
              style={isBest ? { borderColor: "rgba(99,210,179,0.25)" } : {}}
            >
              <div className={`score-card-name ${isBest ? "best" : ""}`}>
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 10 10"
                  fill="currentColor"
                >
                  <circle cx="5" cy="5" r="5" />
                </svg>
                {shortName}
                {isBest && (
                  <span
                    className="badge badge-green"
                    style={{ marginLeft: "auto" }}
                  >
                    best
                  </span>
                )}
              </div>
              {isCls ? (
                <>
                  <div className="score-metric">
                    <div className="score-metric-label">
                      CV score (f1-weighted)
                    </div>
                    <div className="score-metric-num">
                      {s.cv_mean}{" "}
                      <span style={{ color: TEXT_MUT }}>± {s.cv_std}</span>
                    </div>
                    <ScoreBar
                      value={s.cv_mean}
                      color={isBest ? ACCENT : VIOLET}
                    />
                  </div>
                  <div className="score-metric">
                    <div className="score-metric-label">Test accuracy</div>
                    <div className="score-metric-num">{s.test_accuracy}</div>
                    <ScoreBar
                      value={s.test_accuracy}
                      color={isBest ? ACCENT : VIOLET}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="score-metric">
                    <div className="score-metric-label">CV R² (mean ± std)</div>
                    <div className="score-metric-num">
                      {s.cv_mean_r2}{" "}
                      <span style={{ color: TEXT_MUT }}>± {s.cv_std}</span>
                    </div>
                    <ScoreBar
                      value={Math.max(0, s.cv_mean_r2)}
                      color={isBest ? ACCENT : VIOLET}
                    />
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
          <span className="badge badge-red" style={{ marginLeft: 0 }}>
            IQR method · {totalOutliers} total
          </span>
        )}
      </div>
      <div className="outlier-grid">
        {Object.entries(outliers).map(([col, count]) => {
          const pct = numRows ? ((count / numRows) * 100).toFixed(1) : "0.0";
          const hasOutliers = count > 0;
          return (
            <div
              className={`outlier-card ${hasOutliers ? "has-outliers" : ""}`}
              key={col}
            >
              <div className="outlier-card-name">
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 140,
                  }}
                >
                  {col}
                </span>
                {hasOutliers ? (
                  <span className="badge badge-red">{pct}%</span>
                ) : (
                  <span className="badge badge-green">clean</span>
                )}
              </div>
              <div className={`outlier-count ${hasOutliers ? "has" : "zero"}`}>
                {count}{" "}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: TEXT_MUT,
                    fontWeight: 400,
                  }}
                >
                  row{count !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="outlier-bar-track">
                <div
                  className={`outlier-bar-fill ${!hasOutliers ? "zero" : ""}`}
                  style={{
                    width: hasOutliers
                      ? `${(count / maxCount) * 100}%`
                      : "100%",
                  }}
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
function ScatterPairs({
  correlation,
  scatterData,
  selectedPair,
  onSelectPair,
}) {
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
          const key = [colA, colB].sort().join("__");
          const isSelected = selectedPair === key;
          const corrAbs = Math.abs(corr);
          const corrBadgeColor =
            corrAbs > 0.7
              ? corr > 0
                ? ACCENT
                : RED
              : corrAbs > 0.4
                ? GOLD
                : TEXT_DIM;
          const corrBadgeBorder =
            corrAbs > 0.7
              ? corr > 0
                ? "rgba(99,210,179,0.4)"
                : "rgba(248,113,113,0.4)"
              : corrAbs > 0.4
                ? "rgba(240,192,64,0.4)"
                : "rgba(255,255,255,0.1)";
          const chartPoints =
            scatterData?.[`${colA}__${colB}`] ||
            scatterData?.[`${colB}__${colA}`] ||
            [];

          return (
            <div
              className="chart-card"
              key={key}
              style={isSelected ? { borderColor: "rgba(99,210,179,0.3)" } : {}}
              onClick={() => onSelectPair(isSelected ? null : key)}
            >
              <div
                className={`chart-card-bar ${corrAbs > 0.7 ? (corr > 0 ? "" : "red") : "gold"}`}
              />
              <div className="chart-card-body">
                <div className="scatter-pair-header">
                  <div className="scatter-pair-cols">
                    <div
                      className={`chart-col-dot ${corrAbs > 0.7 ? (corr > 0 ? "" : "red") : "gold"}`}
                    />
                    <span
                      style={{
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {colA}
                    </span>
                    <span style={{ color: TEXT_MUT, fontSize: 9 }}>vs</span>
                    <span
                      style={{
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {colB}
                    </span>
                  </div>
                  <span
                    className="scatter-corr-badge"
                    style={{
                      color: corrBadgeColor,
                      borderColor: corrBadgeBorder,
                      background: "transparent",
                      fontSize: 9,
                      fontFamily: "var(--mono)",
                      letterSpacing: "0.06em",
                    }}
                  >
                    r = {corr.toFixed(3)}
                  </span>
                </div>
                {chartPoints.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <ScatterChart
                      margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="2 4" stroke={BORDER} />
                      <XAxis
                        dataKey="x"
                        type="number"
                        name={colA}
                        tick={{
                          fill: TEXT_MUT,
                          fontSize: 9,
                          fontFamily: "'DM Mono'",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        dataKey="y"
                        type="number"
                        name={colB}
                        tick={{
                          fill: TEXT_MUT,
                          fontSize: 9,
                          fontFamily: "'DM Mono'",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ZAxis range={[18, 18]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3", stroke: BORDER }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          return (
                            <div
                              style={{
                                background: "#111318",
                                border: "1px solid rgba(99,210,179,0.25)",
                                borderRadius: 2,
                                padding: "8px 14px",
                                fontFamily: "'DM Mono',monospace",
                                fontSize: 11,
                              }}
                            >
                              <div
                                style={{
                                  color: TEXT_MUT,
                                  fontSize: 10,
                                  marginBottom: 3,
                                }}
                              >
                                {colA}:{" "}
                                <span style={{ color: ACCENT }}>
                                  {d?.x?.toFixed(3)}
                                </span>
                              </div>
                              <div style={{ color: TEXT_MUT, fontSize: 10 }}>
                                {colB}:{" "}
                                <span style={{ color: VIOLET }}>
                                  {d?.y?.toFixed(3)}
                                </span>
                              </div>
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
                  <div
                    style={{
                      height: 180,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      color: TEXT_MUT,
                    }}
                  >
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
  const { issues, warnings, ok } = useMemo(
    () => buildMLReadiness(data),
    [data],
  );
  const score = Math.max(0, 100 - issues.length * 25 - warnings.length * 10);
  const scoreColor = score >= 80 ? ACCENT : score >= 50 ? GOLD : RED;

  return (
    <div className="section" style={{ animationDelay: "0.22s" }}>
      <div className="section-label">
        ML Readiness
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 12,
            color: scoreColor,
            letterSpacing: "-0.02em",
            fontWeight: 700,
            marginLeft: 2,
          }}
        >
          {score}/100
        </span>
      </div>
      <div className="panel">
        <div
          className="panel-bar"
          style={{
            background: `linear-gradient(90deg, ${scoreColor}, transparent)`,
          }}
        />
        <div
          className="panel-body"
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          {/* score bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${score}%`,
                  background: scoreColor,
                  borderRadius: 999,
                  transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: scoreColor,
                minWidth: 50,
                textAlign: "right",
              }}
            >
              {score >= 80 ? "Ready" : score >= 50 ? "Needs work" : "Not ready"}
            </span>
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: RED,
                  marginBottom: 10,
                }}
              >
                Issues — must fix
              </div>
              <div className="readiness-list">
                {issues.map((item, i) => (
                  <div
                    className="readiness-item"
                    key={i}
                    style={{ borderColor: "rgba(248,113,113,0.15)" }}
                  >
                    <div
                      className="readiness-item-icon"
                      style={{
                        background: "rgba(248,113,113,0.1)",
                        color: RED,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div className="readiness-item-body">
                      <div
                        className="readiness-item-label"
                        style={{ color: RED }}
                      >
                        {item.label}
                      </div>
                      {item.detail && (
                        <div className="readiness-item-detail">
                          {item.detail}
                        </div>
                      )}
                      {item.action && (
                        <div
                          className="readiness-item-action"
                          style={{ color: RED }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
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
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: GOLD,
                  marginBottom: 10,
                }}
              >
                Warnings — recommended
              </div>
              <div className="readiness-list">
                {warnings.map((item, i) => (
                  <div
                    className="readiness-item"
                    key={i}
                    style={{ borderColor: "rgba(240,192,64,0.12)" }}
                  >
                    <div
                      className="readiness-item-icon"
                      style={{
                        background: "rgba(240,192,64,0.08)",
                        color: GOLD,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div className="readiness-item-body">
                      <div
                        className="readiness-item-label"
                        style={{ color: GOLD }}
                      >
                        {item.label}
                      </div>
                      {item.detail && (
                        <div className="readiness-item-detail">
                          {item.detail}
                        </div>
                      )}
                      {item.action && (
                        <div
                          className="readiness-item-action"
                          style={{ color: GOLD }}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
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
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: ACCENT,
                  marginBottom: 10,
                }}
              >
                Passing checks
              </div>
              <div style={{ paddingLeft: 4 }}>
                {ok.map((item, i) => (
                  <div className="readiness-ok-row" key={i}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="2.5"
                    >
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
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load EDA data."),
      );
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/model_info`)
      .then((res) => setTrainRes(res.data))
      .catch(() => {});
  }, []);

  // Filtered columns
  const filteredCols = useMemo(() => {
    if (!data) return [];
    let cols = data.columns || [];
    if (colTypeFilter === "numeric")
      cols = cols.filter((c) => (data.numeric_columns || []).includes(c));
    else if (colTypeFilter === "categorical")
      cols = cols.filter((c) => (data.categorical_columns || []).includes(c));
    if (colSearch.trim()) {
      const q = colSearch.trim().toLowerCase();
      cols = cols.filter((c) => c.toLowerCase().includes(q));
    }
    return cols;
  }, [data, colSearch, colTypeFilter]);

  const categoricalCols = useMemo(
    () => data?.categorical_columns || [],
    [data?.categorical_columns],
  );

  const featureImportance = useMemo(() => {
    if (!data?.importance) return [];

    const importanceMap = {};
    Object.entries(data.importance).forEach(([feature, value]) => {
      const normalized = normalizeFeatureName(feature, categoricalCols);
      if (
        importanceMap[normalized] === undefined ||
        value > importanceMap[normalized]
      ) {
        importanceMap[normalized] = value;
      }
    });

    return Object.entries(importanceMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [data?.importance, categoricalCols]);

  if (!data && !error)
    return (
      <Layout>
        <div className="eda-root">
          <div className="eda-inner">
            <div className="state-card">
              <div className="loading-dots">
                <span />
                <span />
                <span />
              </div>
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
        <div className="eda-root">
          <div className="eda-inner">
            <div className="state-card">
              <div className="state-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="state-title" style={{ color: "#f87171" }}>
                {error}
              </div>
              <div className="state-sub">
                Check that a dataset has been uploaded and trained.
              </div>
              <button
                className="ghost-btn"
                style={{ marginTop: 8 }}
                onClick={() => (window.location.href = "/")}
              >
                Go to Upload
              </button>
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
  const duplicateRows = data.duplicate_rows ?? 0;
  const totalOutliers = Object.values(data.outliers || {}).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <Layout>
      <div className="eda-root">
        <div className="eda-inner">
          {/* ── Header ── */}
          <div className="page-header">
            <div className="page-eyebrow">
              AutoML · Exploratory Data Analysis
            </div>
            <h1 className="page-title">
              EDA <span>Dashboard</span>
              {data.has_model && (
                <span className="badge badge-green">● model ready</span>
              )}
              {totalOutliers > 0 && (
                <span className="badge badge-red">
                  ⚠ {totalOutliers} outliers
                </span>
              )}
              {duplicateRows > 0 && (
                <span className="badge badge-gold">
                  ⚠ {duplicateRows} dupes
                </span>
              )}
            </h1>
          </div>

          {/* ── Stat strip ── */}
          <div
            className="stat-strip"
            style={{
              animation: "fadeUp 0.42s cubic-bezier(0.16,1,0.3,1) both",
              animationDelay: "0.04s",
            }}
          >
            <div className="stat-cell">
              <div className="stat-cell-label">Rows</div>
              <div className="stat-cell-value">
                {(data.num_rows || 0).toLocaleString()}
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Columns</div>
              <div className="stat-cell-value">{data.num_columns || 0}</div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Numeric</div>
              <div className="stat-cell-value">
                <span>{numericCols.length}</span>
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Categorical</div>
              <div className="stat-cell-value">
                <span style={{ color: VIOLET }}>{categoricalCols.length}</span>
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Missing</div>
              <div className="stat-cell-value">
                <span style={{ color: data.missing_total > 0 ? RED : ACCENT }}>
                  {data.missing_total || 0}
                </span>
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Duplicates</div>
              <div className="stat-cell-value">
                <span style={{ color: duplicateRows > 0 ? GOLD : ACCENT }}>
                  {duplicateRows}
                </span>
              </div>
            </div>
            <div className="stat-cell">
              <div className="stat-cell-label">Outliers</div>
              <div className="stat-cell-value">
                <span style={{ color: totalOutliers > 0 ? RED : ACCENT }}>
                  {totalOutliers}
                </span>
              </div>
            </div>
          </div>

          {/* ── Column Search & Filter ── */}
          <div className="section" style={{ animationDelay: "0.06s" }}>
            <div className="section-label">Dataset Columns</div>

            {/* Search input */}
            <div className="col-search-wrap">
              <svg
                className="col-search-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: TEXT_MUT,
                }}
              >
                Filter:
              </span>
              {[
                { key: "all", label: `All (${data.columns?.length || 0})` },
                { key: "numeric", label: `Numeric (${numericCols.length})` },
                {
                  key: "categorical",
                  label: `Categorical (${categoricalCols.length})`,
                  cls: "violet",
                },
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
                  onClick={() => {
                    setColSearch("");
                    setColTypeFilter("all");
                  }}
                  style={{ color: RED, borderColor: "rgba(248,113,113,0.3)" }}
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Pills */}
            <div className="pill-row">
              {filteredCols.length === 0 ? (
                <span className="col-pill-none">
                  No columns match "{colSearch}"
                </span>
              ) : (
                filteredCols.map((col) => {
                  const isNum = numericCols.includes(col);
                  const isCat = categoricalCols.includes(col);
                  return (
                    <div
                      className="col-pill"
                      key={col}
                      style={{
                        borderColor: isNum
                          ? "rgba(99,210,179,0.2)"
                          : isCat
                            ? "rgba(167,139,250,0.2)"
                            : undefined,
                        color: isNum ? ACCENT : isCat ? VIOLET : undefined,
                      }}
                    >
                      {col}
                    </div>
                  );
                })
              )}
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
                    <tr>
                      {data.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sample.map((row, i) => (
                      <tr key={i}>
                        {data.columns.map((col) => (
                          <td key={`${i}-${col}`}>{row[col] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Model scores ── */}
          {data.has_model && trainRes && (
            <ModelScores
              scores={trainRes._scores}
              bestModel={trainRes.model_type}
            />
          )}

          {/* ── Outlier Detection ── */}
          <OutlierPanel outliers={data.outliers} numRows={data.num_rows} />

          {/* ── ML Readiness ── */}
          <MLReadinessPanel data={data} />

          {/* ── Histograms ── */}
          {data.histograms &&
            numericCols.length > 0 &&
            Object.keys(data.histograms).length > 0 && (
              <div className="section" style={{ animationDelay: "0.17s" }}>
                <div className="section-label">Histograms</div>
                <div className="chart-grid">
                  {Object.entries(data.histograms).map(([col, values]) => (
                    <div className="chart-card" key={col}>
                      <div className="chart-card-bar" />
                      <div className="chart-card-body">
                        <div className="chart-col-name">
                          <div className="chart-col-dot" />
                          {col}
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart
                            data={values}
                            margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                          >
                            <CartesianGrid
                              strokeDasharray="2 4"
                              stroke={BORDER}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="bin"
                              tick={{
                                fill: TEXT_MUT,
                                fontSize: 9,
                                fontFamily: "'DM Mono'",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{
                                fill: TEXT_MUT,
                                fontSize: 9,
                                fontFamily: "'DM Mono'",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              content={<ChartTooltip />}
                              cursor={{ fill: "rgba(99,210,179,0.06)" }}
                            />
                            <Bar
                              dataKey="count"
                              fill={ACCENT}
                              radius={[2, 2, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* ── Categorical pie charts ── */}
          {data.categorical &&
            categoricalCols.length > 0 &&
            Object.keys(data.categorical).length > 0 && (
              <div className="section" style={{ animationDelay: "0.19s" }}>
                <div className="section-label">Categorical Distribution</div>
                <div className="chart-grid">
                  {Object.entries(data.categorical).map(([col, values]) => {
                    const chartData = buildPieChartData(values, 6);
                    return (
                      <div className="chart-card" key={col}>
                        <div className="chart-card-bar violet" />
                        <div className="chart-card-body">
                          <div className="chart-col-name">
                            <div className="chart-col-dot violet" />
                            {col}
                          </div>
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                outerRadius={80}
                                innerRadius={36}
                                paddingAngle={2}
                              >
                                {chartData.map((_, i) => (
                                  <Cell
                                    key={i}
                                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                                    stroke="none"
                                  />
                                ))}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                              <Legend content={<PieLegend />} />
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
              <div className="section-label">
                Correlation Matrix{" "}
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 9,
                    color: TEXT_MUT,
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  · click a cell to open scatter plot
                </span>
              </div>
              <div className="panel">
                <div className="panel-bar gold" />
                <div className="panel-body">
                  <div className="corr-scroll">
                    <table className="corr-table">
                      <thead>
                        <tr>
                          <th />
                          {Object.keys(data.correlation).map((col) => (
                            <th key={col}>{col}</th>
                          ))}
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
                                  style={{
                                    background: corrColor(val),
                                    color:
                                      Math.abs(val) > 0.5
                                        ? "#e8eaf0"
                                        : TEXT_DIM,
                                  }}
                                  onClick={() =>
                                    row !== col &&
                                    setSelectedPair(isSelected ? null : pairKey)
                                  }
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
          {featureImportance.length > 0 && (
            <div className="section" style={{ animationDelay: "0.25s" }}>
              <div className="section-label">Feature Importance</div>
              <div className="panel">
                <div className="panel-bar violet" />
                <div className="panel-body">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(200, featureImportance.length * 28)}
                  >
                    <BarChart
                      layout="vertical"
                      data={featureImportance}
                      margin={{ top: 0, right: 20, bottom: 0, left: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke={BORDER}
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fill: TEXT_MUT,
                          fontSize: 9,
                          fontFamily: "'DM Mono'",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={130}
                        tick={{
                          fill: TEXT_DIM,
                          fontSize: 10,
                          fontFamily: "'DM Mono'",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip />}
                        cursor={{ fill: "rgba(167,139,250,0.06)" }}
                      />
                      <Bar
                        dataKey="value"
                        fill={VIOLET}
                        radius={[0, 2, 2, 0]}
                      />
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
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      color: ACCENT,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="2.5"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    No missing values detected
                  </div>
                ) : (
                  <div className="missing-list">
                    {missingEntries
                      .filter(([, v]) => v > 0)
                      .map(([col, val]) => (
                        <div className="missing-row" key={col}>
                          <div className="missing-col">{col}</div>
                          <div className="missing-bar-track">
                            <div
                              className="missing-bar-fill"
                              style={{ width: `${(val / maxMissing) * 100}%` }}
                            />
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
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 10 10"
                        fill={ACCENT}
                      >
                        <circle cx="5" cy="5" r="5" />
                      </svg>
                      {col}
                    </div>
                    {STAT_KEYS.filter(
                      (k) => data.summary[col]?.[k] !== undefined,
                    ).map((k) => (
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

          {/* ── CTA row ── */}
          <div className="action-row">
            <button className="cta-btn" onClick={() => navigate("/predictor")}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Run Predictor
            </button>
            {data.summary && summaryColNames.length > 0 && (
              <button
                className="ghost-btn"
                onClick={() => exportSummaryCSV(data.summary, summaryColNames)}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
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
