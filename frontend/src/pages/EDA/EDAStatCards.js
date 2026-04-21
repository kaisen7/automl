import React from "react";
import { ACCENT, RED, GOLD, VIOLET } from "../../utils/constants.js";

function EDAStatCards({ data, numericCols, categoricalCols, duplicateRows, totalOutliers }) {
  return (
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
  );
}

export default EDAStatCards;
