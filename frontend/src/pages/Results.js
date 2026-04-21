import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import API from "../api";
import './styles/Results.css'

// grab the primary cv score from a model's results
const getScore = (v) => v?.cv_mean ?? v?.cv_mean_r2;

// builds an array of score badges for a model
function buildScorePills(data) {
  const pills = [];

  if (data.cv_mean !== undefined)
    pills.push({ key: "cv_mean", label: "CV F1", value: data.cv_mean, color: "accent" });
  if (data.cv_mean_r2 !== undefined)
    pills.push({ key: "cv_mean_r2", label: "CV R²", value: data.cv_mean_r2, color: "accent" });
  if (data.cv_std !== undefined)
    pills.push({ key: "cv_std", label: "CV ±std", value: data.cv_std, color: "muted" });
  if (data.test_accuracy !== undefined)
    pills.push({ key: "test_accuracy", label: "Test Acc", value: data.test_accuracy, color: "blue" });
  if (data.test_f1_weighted !== undefined)
    pills.push({ key: "test_f1", label: "Test F1", value: data.test_f1_weighted, color: "purple" });
  if (data.test_r2 !== undefined)
    pills.push({ key: "test_r2", label: "Test R²", value: data.test_r2, color: "blue" });
  if (data.test_mae !== undefined)
    pills.push({ key: "test_mae", label: "Test MAE", value: data.test_mae, color: "orange" });

  return pills;
}

// figure out which score to show big in the hero card
function bestScoreKey(data) {
  if (data.cv_mean_r2 !== undefined) return "cv_mean_r2";
  if (data.cv_mean !== undefined) return "cv_mean";
  return null;
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();

  // try getting results from navigation state first, fallback to localStorage
  const stored = localStorage.getItem("automl_results");
  const results =
    location.state?.results || (stored ? JSON.parse(stored) : {});

  // filter out models that errored / have no score
  const validResults = Object.entries(results).filter(
    ([_, v]) => v && getScore(v) !== undefined,
  );

  const sorted = validResults.sort((a, b) => getScore(b[1]) - getScore(a[1]));
  const best = sorted[0];
  const topScore = best ? getScore(best[1]) : 1;
  const barWidth = (score) => Math.max(0, Math.min(1, score / topScore));

  return (
    <Layout>
      <div className="results-root">
        <div className="results-wrap">
          {/* page header */}
          <div className="page-header">
            <div className="page-eyebrow">AutoML · Model Evaluation</div>
            <h1 className="page-title">
              Model <span>Rankings</span>
            </h1>
          </div>

          {sorted.length === 0 ? (
            // no results yet - show empty state
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
                No dataset loaded
              </div>
              <div className="state-sub">
                Please upload and train a dataset first.
              </div>
              <button className="ghost-btn" onClick={() => navigate("/")}>
                Go to Upload
              </button>
            </div>
          ) : (
            <>
              {/* best model hero card */}
              <div className="hero-card">
                <div className="hero-bar" />
                <div className="hero-body">
                  <div className="hero-left">
                    <div className="trophy-box">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 21h8M12 17v4M17 3H7v8a5 5 0 0010 0V3z" />
                        <path d="M17 5h2a2 2 0 012 2v1a4 4 0 01-4 4M7 5H5a2 2 0 00-2 2v1a4 4 0 004 4" />
                      </svg>
                    </div>
                    <div className="hero-meta">
                      <div className="hero-tag">🏆 Best Model</div>
                      <div className="hero-name">{best[0]}</div>

                      {/* score chips */}
                      <div className="hero-scores-grid">
                        {buildScorePills(best[1]).map((pill) => {
                          const isBest = pill.key === bestScoreKey(best[1]);
                          return (
                            <div
                              key={pill.key}
                              className={`hero-score-chip${isBest ? " is-best" : ""}`}
                            >
                              <span className="chip-label">{pill.label}</span>
                              <span
                                className={`chip-value ${isBest ? "gold" : pill.color}`}
                              >
                                {pill.value.toFixed(4)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* all models list */}
              <div className="section-label">All Models</div>

              <div className="model-list">
                {sorted.map(([model, data], i) => {
                  const score = getScore(data);
                  const pills = buildScorePills(data);
                  const rankCls = i === 0 ? " rank-1" : "";
                  const delay = `${0.12 + i * 0.07}s`;

                  return (
                    <div
                      key={model}
                      className={`model-card${rankCls}`}
                      style={{ animationDelay: delay }}
                    >
                      {/* rank + name + score bar */}
                      <div className="model-card-top">
                        <span className="rank-num">#{i + 1}</span>

                        <div className="model-name-wrap">
                          <span className="model-name">{model}</span>
                        </div>

                        <div className="main-score-area">
                          <div className="score-bar-track">
                            <div
                              className="score-bar-fill"
                              style={{
                                width: `${barWidth(score) * 100}%`,
                                animationDelay: delay,
                              }}
                            />
                          </div>
                          <span className="score-primary">
                            {score.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      {/* all the score pills */}
                      <div className="model-scores-grid">
                        {pills.map((pill) => (
                          <div className="score-pill" key={pill.key}>
                            <span className={`pill-dot ${pill.color}`} />
                            <span className="pill-label">{pill.label}</span>
                            <span className={`pill-value ${pill.color}`}>
                              {pill.value.toFixed(4)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* action buttons */}
              <div className="cta-row">
                <button
                  className="btn-primary"
                  onClick={() => {
                    const s = localStorage.getItem("automl_results");
                    navigate(s ? "/eda" : "/");
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  Explore EDA
                </button>
                <button
                  className="btn-ghost"
                  onClick={async () => {
                    localStorage.clear();
                    try {
                      await fetch(`${API}/reset`, { method: "POST" });
                    } catch (e) {
                      console.error("Reset failed", e);
                    }
                    navigate("/upload", { replace: true });
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  New Dataset
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
