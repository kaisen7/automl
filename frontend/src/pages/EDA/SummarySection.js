import React from "react";
import { ACCENT } from "../../utils/constants.js";
import { exportSummaryCSV } from "./helpers";

function SummarySection({ data, summaryColNames, datasetName }) {
  const STAT_KEYS = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];

  if (!data?.summary || !summaryColNames?.length) return null;

  return (
    <div
      className="section"
      id="summary-statistics"
      style={{ animationDelay: "0.29s" }}
    >
      <div className="section-label">
        Summary Statistics
        <button
          className="ghost-btn"
          style={{
            marginLeft: "auto",
            padding: "2px 8px",
            height: 24,
            fontSize: 9,
          }}
          onClick={() => exportSummaryCSV(data.summary, summaryColNames, datasetName)}
        >
          Export CSV
        </button>
      </div>
      <div className="summary-grid">
        {summaryColNames.map((col) => (
          <div className="summary-col-card" key={col}>
            <div className="summary-col-name">
              <svg width="9" height="9" viewBox="0 0 10 10" fill={ACCENT}>
                <circle cx="5" cy="5" r="5" />
              </svg>
              {col}
            </div>
            {STAT_KEYS.filter((k) => data.summary[col]?.[k] !== undefined).map(
              (k) => (
                <div className="summary-stat-row" key={k}>
                  <span className="summary-stat-key">{k}</span>
                  <span className="summary-stat-val">
                    {typeof data.summary[col][k] === "number"
                      ? data.summary[col][k].toFixed(4)
                      : data.summary[col][k]}
                  </span>
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SummarySection;
