import React from "react";
import { ACCENT } from "../../utils/constants.js";

function MissingValuesPanel({ missingEntries, maxMissing }) {
  if (!missingEntries || missingEntries.length === 0) return null;
  return (
    <div
      className="section"
      id="missing-values"
      style={{ animationDelay: "0.27s" }}
    >
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
  );
}

export default MissingValuesPanel;
