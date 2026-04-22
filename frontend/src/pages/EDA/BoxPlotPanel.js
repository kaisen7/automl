import React from "react";

function BoxPlotPanel({ boxPlots, onCardExpand }) {
  if (!boxPlots || Object.keys(boxPlots).length === 0) return null;
  const cols = Object.entries(boxPlots);
  return (
    <div
      className="section enlargeable-section"
      id="box-plots"
      style={{ animationDelay: "0.15s" }}
    >
      <div className="section-label">Box Plots | Outlier Summary</div>
      <div className="boxplot-grid">
        {cols.map(([col, stats]) => {
          const range = stats.max - stats.min || 1;
          const q1Pos = ((stats.q1 - stats.min) / range) * 100;
          const q3Pos = ((stats.q3 - stats.min) / range) * 100;
          const medianPos = ((stats.median - stats.min) / range) * 100;
          const minPos = 0;
          const maxPos = 100;

          return (
            <div
              className="boxplot-card clickable"
              key={col}
              onClick={() =>
                onCardExpand?.(
                  `Box Plot | ${col}`,
                  <div
                    style={{
                      width: "100%",
                      minHeight: 300,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      padding: "20px 0",
                    }}
                  >
                    <div
                      className="boxplot-card"
                      style={{
                        width: "100%",
                        maxWidth: "none",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                      }}
                    >
                      <div
                        className="chart-col-name"
                        style={{ fontSize: 14, marginBottom: 20 }}
                      >
                        <div className="chart-col-dot" />
                        {col}
                      </div>
                      <div
                        className="boxplot-track"
                        style={{ height: 60, margin: "20px 0" }}
                      >
                        <div
                          className="boxplot-whisker"
                          style={{
                            left: `${stats.lower_whisker === stats.min ? minPos : ((stats.lower_whisker - stats.min) / range) * 100}%`,
                            width: `${stats.lower_whisker === stats.min ? q1Pos : q1Pos - ((stats.lower_whisker - stats.min) / range) * 100}%`,
                          }}
                        />
                        <div
                          className="boxplot-whisker"
                          style={{
                            left: `${q3Pos}%`,
                            width: `${stats.upper_whisker === stats.max ? maxPos - q3Pos : ((stats.upper_whisker - stats.min) / range) * 100 - q3Pos}%`,
                          }}
                        />
                        <div
                          className="boxplot-box"
                          style={{
                            left: `${q1Pos}%`,
                            width: `${Math.max(q3Pos - q1Pos, 1)}%`,
                          }}
                        />
                        <div
                          className="boxplot-median"
                          style={{ left: `${medianPos}%` }}
                        />
                        {stats.outliers.map((value, index) => {
                          const pointPos = ((value - stats.min) / range) * 100;
                          return (
                            <div
                              key={`${col}-outlier-${index}`}
                              className="boxplot-outlier"
                              style={{
                                left: `${Math.min(Math.max(pointPos, 0), 100)}%`,
                              }}
                            />
                          );
                        })}
                      </div>
                      <div
                        className="boxplot-meta"
                        style={{
                          fontSize: 12,
                          marginTop: 20,
                          justifyContent: "space-between",
                        }}
                      >
                        <span>min {stats.min.toFixed(2)}</span>
                        <span>q1 {stats.q1.toFixed(2)}</span>
                        <span>median {stats.median.toFixed(2)}</span>
                        <span>q3 {stats.q3.toFixed(2)}</span>
                        <span>max {stats.max.toFixed(2)}</span>
                      </div>
                      {stats.outlier_count > 0 && (
                        <div
                          className="boxplot-outlier-summary"
                          style={{ marginTop: 12 }}
                        >
                          {stats.outlier_count} outlier
                          {stats.outlier_count !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>,
                )
              }
            >
              <div className="chart-col-name">
                <div className="chart-col-dot" />
                {col}
              </div>
              <div className="boxplot-track">
                <div
                  className="boxplot-whisker"
                  style={{
                    left: `${stats.lower_whisker === stats.min ? minPos : ((stats.lower_whisker - stats.min) / range) * 100}%`,
                    width: `${stats.lower_whisker === stats.min ? q1Pos : q1Pos - ((stats.lower_whisker - stats.min) / range) * 100}%`,
                  }}
                />
                <div
                  className="boxplot-whisker"
                  style={{
                    left: `${q3Pos}%`,
                    width: `${stats.upper_whisker === stats.max ? maxPos - q3Pos : ((stats.upper_whisker - stats.min) / range) * 100 - q3Pos}%`,
                  }}
                />
                <div
                  className="boxplot-box"
                  style={{
                    left: `${q1Pos}%`,
                    width: `${Math.max(q3Pos - q1Pos, 1)}%`,
                  }}
                />
                <div
                  className="boxplot-median"
                  style={{ left: `${medianPos}%` }}
                />
                {stats.outliers.map((value, index) => {
                  const pointPos = ((value - stats.min) / range) * 100;
                  return (
                    <div
                      key={`${col}-outlier-${index}`}
                      className="boxplot-outlier"
                      style={{
                        left: `${Math.min(Math.max(pointPos, 0), 100)}%`,
                      }}
                    />
                  );
                })}
              </div>
              <div className="boxplot-meta">
                <span>min {stats.min.toFixed(2)}</span>
                <span>q1 {stats.q1.toFixed(2)}</span>
                <span>median {stats.median.toFixed(2)}</span>
                <span>q3 {stats.q3.toFixed(2)}</span>
                <span>max {stats.max.toFixed(2)}</span>
              </div>
              {stats.outlier_count > 0 && (
                <div className="boxplot-outlier-summary">
                  {stats.outlier_count} outlier
                  {stats.outlier_count !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BoxPlotPanel;
