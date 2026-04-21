import React from "react";
import { ACCENT, VIOLET, RED, TEXT_MUT } from "../../utils/constants.js";
import { ScoreBar } from "./helpers";

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

export default ModelScores;
