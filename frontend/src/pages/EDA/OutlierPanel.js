import React from "react";
import { TEXT_MUT } from "../../utils/constants.js";

function OutlierPanel({ outliers, numRows }) {
  if (!outliers || Object.keys(outliers).length === 0) return null;
  const maxCount = Math.max(...Object.values(outliers), 1);
  const totalOutliers = Object.values(outliers).reduce((a, b) => a + b, 0);

  return (
    <div
      className="section"
      id="outlier-detection"
      style={{ animationDelay: "0.13s" }}
    >
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

export default OutlierPanel;
