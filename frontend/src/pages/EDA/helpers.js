import React from "react";
import { TEXT_MUT, TEXT_DIM, ACCENT, RED, GOLD, VIOLET } from "../../utils/constants.js";

// -- Tooltip --
export const ChartTooltip = ({ active, payload, label }) => {
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

// -- Correlation colour --
export const corrColor = (val) => {
  const v = Math.max(-1, Math.min(1, val));
  if (v > 0) return `rgba(99,210,179,${(v * 0.75 + 0.1).toFixed(2)})`;
  if (v < 0)
    return `rgba(248,113,113,${(Math.abs(v) * 0.75 + 0.1).toFixed(2)})`;
  return "transparent";
};

// -- Score bar --
export const ScoreBar = ({ value, color = ACCENT }) => {
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

// -- Helpers --
export function exportSummaryCSV(summary, columns, datasetName) {
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
  const fileName = datasetName
    ? `${datasetName}_statistics.csv`
    : "eda_summary_statistics.csv";
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildMLReadiness(data) {
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

  return { issues, warnings, ok };
}

export function normalizeFeatureName(feature, categoricalCols = []) {
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

export function truncateLabel(label, maxLength = 20) {
  if (!label || label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

export function buildPieChartData(values, maxSlices = 5) {
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

export const PieLegend = ({ payload }) => {
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
};

export const ExpandOverlay = ({ title, children, onClose }) => {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <div className="overlay-title">{title}</div>
          <button className="overlay-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="overlay-content">{children}</div>
      </div>
    </div>
  );
};
