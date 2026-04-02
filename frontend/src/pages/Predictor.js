import { useState } from "react";
import axios from "axios";
import API from "../api";
import Layout from "../components/Layout";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg: #0a0b0f;
    --surface: #111318;
    --surface-2: #181c24;
    --surface-3: #1e2330;
    --border: rgba(255,255,255,0.07);
    --border-active: rgba(99,210,179,0.4);
    --accent: #63d2b3;
    --accent-dim: rgba(99,210,179,0.10);
    --accent-glow: rgba(99,210,179,0.22);
    --text: #e8eaf0;
    --text-muted: #6b7280;
    --text-dim: #9ca3af;
    --violet: #a78bfa;
    --violet-dim: rgba(167,139,250,0.12);
    --violet-glow: rgba(167,139,250,0.22);
    --mono: 'DM Mono', monospace;
    --sans: 'Syne', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .pred-root {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 48px 20px 80px;
    font-family: var(--sans);
    color: var(--text);
  }

  .pred-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(99,210,179,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,210,179,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .pred-wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ── Header ── */
  .page-header {
    animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }

  .page-eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 10px;
    opacity: 0.85;
  }

  .page-title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
  }

  .page-title span { color: var(--accent); }

  /* ── Target badge ── */
  .target-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--accent-dim);
    border: 1px solid var(--border-active);
    border-radius: 2px;
    padding: 7px 14px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s both;
  }

  .target-badge-label {
    color: var(--text-muted);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  /* ── Card ── */
  .pred-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    overflow: hidden;
    animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.08s both;
  }

  .card-bar {
    height: 2px;
    background: linear-gradient(90deg, var(--accent), transparent);
  }

  .card-body {
    padding: 28px 32px 32px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  /* ── Section label ── */
  .section-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Input grid ── */
  .input-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .field-wrap {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    text-transform: lowercase;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field-label-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.5;
    flex-shrink: 0;
  }

  .styled-input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    padding: 10px 12px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .styled-input::placeholder {
    color: var(--text-muted);
    font-size: 11px;
    font-style: italic;
  }

  .styled-input:focus {
    border-color: var(--border-active);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  /* ── Error ── */
  .error-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: 2px;
    padding: 12px 16px;
    font-family: var(--mono);
    font-size: 11px;
    color: #f87171;
  }

  /* ── Submit button ── */
  .submit-btn {
    width: 100%;
    padding: 14px 24px;
    background: var(--accent);
    color: #0a0b0f;
    border: none;
    border-radius: 2px;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    overflow: hidden;
    transition: opacity 0.2s, transform 0.15s;
  }

  .submit-btn:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .submit-btn.loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
    animation: shimmer 1.2s infinite;
    transform: translateX(-100%);
  }

  @keyframes shimmer { to { transform: translateX(100%); } }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(10,11,15,0.3);
    border-top-color: #0a0b0f;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Result card ── */
  .result-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    overflow: hidden;
    animation: resultIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }

  @keyframes resultIn {
    from { opacity: 0; transform: translateY(12px) scale(0.99); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .result-bar {
    height: 2px;
    background: linear-gradient(90deg, var(--violet), transparent);
  }

  .result-body {
    padding: 28px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }

  .result-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .result-icon {
    width: 48px;
    height: 48px;
    background: var(--violet-dim);
    border: 1px solid rgba(167,139,250,0.25);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--violet);
    flex-shrink: 0;
  }

  .result-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-tag {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--violet);
    opacity: 0.8;
  }

  .result-target {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .result-value {
    font-family: var(--mono);
    font-size: 36px;
    font-weight: 500;
    color: var(--violet);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  /* ── Empty / crash guard ── */
  .guard-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 52px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    animation: fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
  }

  .guard-icon {
    width: 48px;
    height: 48px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .guard-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-dim);
  }

  .guard-sub {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--text-muted);
  }

  .ghost-btn {
    margin-top: 8px;
    padding: 10px 24px;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: transparent;
    color: var(--text-dim);
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: border-color 0.2s, color 0.2s;
  }

  .ghost-btn:hover {
    border-color: rgba(255,255,255,0.18);
    color: var(--text);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

export default function Predictor() {
  const rawColumns = localStorage.getItem("automl_columns");
  const target = localStorage.getItem("automl_target");

  const [input, setInput] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Guard: no session data
  if (!rawColumns || !target) {
    return (
      <Layout>
        <style>{styles}</style>
        <div className="pred-root">
          <div className="pred-wrap">
            <div className="guard-card">
              <div className="guard-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="guard-title">No session data found</div>
              <div className="guard-sub">
                Train a model first before running predictions.
              </div>
              <button
                className="ghost-btn"
                onClick={() => (window.location.href = "/")}
              >
                Go to Upload
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const columns = JSON.parse(rawColumns);
  const inputCols = columns.filter((col) => col !== target);

  const handleChange = (col, value) => {
    setInput((prev) => ({ ...prev, [col]: value === "" ? "" : Number(value) }));
  };

  const handlePredict = async () => {
    setError("");
    const missing = inputCols.filter(
      (col) => input[col] === undefined || input[col] === "",
    );
    if (missing.length > 0) {
      setError(
        `Fill in all fields before predicting. Missing: ${missing.join(", ")}`,
      );
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/predict`, input);
      setPrediction(res.data.prediction);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || "Prediction failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <style>{styles}</style>
      <div className="pred-root">
        <div className="pred-wrap">
          {/* Header */}
          <div className="page-header">
            <div className="page-eyebrow">AutoML · Inference</div>
            <h1 className="page-title">
              Run a <span>Prediction</span>
            </h1>
          </div>

          {/* Target badge */}
          <div>
            <div className="target-badge">
              <span className="target-badge-label">Target →</span>
              {target}
            </div>
          </div>

          {/* Input card */}
          <div className="pred-card">
            <div className="card-bar" />
            <div className="card-body">
              <div className="section-label">Feature Inputs</div>

              {error && (
                <div className="error-box">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <div className="input-grid">
                {inputCols.map((col) => (
                  <div className="field-wrap" key={col}>
                    <div className="field-label">
                      <div className="field-label-dot" />
                      {col}
                    </div>
                    <input
                      className="styled-input"
                      type="number"
                      placeholder="enter value"
                      value={input[col] ?? ""}
                      onChange={(e) => handleChange(col, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <button
                className={`submit-btn${loading ? " loading" : ""}`}
                onClick={handlePredict}
                disabled={loading}
              >
                {loading && <div className="spinner" />}
                {loading ? "Running inference…" : "Predict"}
              </button>
            </div>
          </div>

          {/* Result */}
          {prediction !== null && (
            <div className="result-card">
              <div className="result-bar" />
              <div className="result-body">
                <div className="result-left">
                  <div className="result-icon">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div className="result-meta">
                    <div className="result-tag">Prediction Output</div>
                    <div className="result-target">{target}</div>
                  </div>
                </div>
                <div className="result-value">
                  {Array.isArray(prediction) ? prediction[0] : prediction}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
