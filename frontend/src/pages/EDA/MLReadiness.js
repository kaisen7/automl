import React, { useMemo } from "react";
import { ACCENT, GOLD, RED } from "../../utils/constants.js";
import { buildMLReadiness } from "./helpers";

function MLReadinessPanel({ data }) {
  const { issues, warnings, ok } = useMemo(
    () => buildMLReadiness(data),
    [data],
  );
  const score = Math.max(0, 100 - issues.length * 25 - warnings.length * 10);
  const scoreColor = score >= 80 ? ACCENT : score >= 50 ? GOLD : RED;

  return (
    <div
      className="section"
      id="ml-readiness"
      style={{ animationDelay: "0.30s" }}
    >
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

export default MLReadinessPanel;
