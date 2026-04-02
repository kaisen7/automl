import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import API from "../api";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Syne:wght@400;600;700;800&display=swap');

  :root {
    --bg: #0a0b0f;
    --surface: #111318;
    --surface-2: #181c24;
    --border: rgba(255,255,255,0.07);
    --border-active: rgba(99,210,179,0.4);
    --accent: #63d2b3;
    --accent-dim: rgba(99,210,179,0.12);
    --accent-glow: rgba(99,210,179,0.25);
    --text: #e8eaf0;
    --text-muted: #6b7280;
    --text-dim: #9ca3af;
    --danger: #f87171;
    --danger-dim: rgba(248,113,113,0.1);
    --mono: 'DM Mono', monospace;
    --sans: 'Syne', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .upload-root {
    min-height: 100vh;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    font-family: var(--sans);
    color: var(--text);
  }

  /* Ambient grid */
  .upload-root::before {
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

  .upload-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 560px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 2px;
    overflow: hidden;
    animation: cardIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Top accent bar */
  .card-bar {
    height: 2px;
    background: linear-gradient(90deg, var(--accent), transparent);
  }

  .card-header {
    padding: 32px 36px 24px;
    border-bottom: 1px solid var(--border);
  }

  .card-eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 10px;
    opacity: 0.85;
  }

  .card-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text);
    line-height: 1.1;
  }

  .card-title span {
    color: var(--accent);
  }

  .card-body {
    padding: 28px 36px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* ── Error ── */
  .error-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--danger-dim);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: 2px;
    padding: 12px 16px;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--danger);
    animation: slideDown 0.25s ease both;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .error-icon {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border: 1px solid var(--danger);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-style: normal;
  }

  /* ── Section labels ── */
  .field-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── File drop zone ── */
  .drop-zone {
    border: 1px dashed rgba(255,255,255,0.12);
    border-radius: 2px;
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background: transparent;
    position: relative;
    overflow: hidden;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: var(--border-active);
    background: var(--accent-dim);
  }

  .drop-zone.has-file {
    border-color: var(--border-active);
    background: var(--accent-dim);
  }

  .drop-zone input[type="file"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .drop-icon {
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-active);
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    background: var(--accent-dim);
  }

  .drop-primary {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-dim);
  }

  .drop-secondary {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .file-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    background: var(--accent-dim);
    padding: 4px 10px;
    border-radius: 2px;
  }

  /* ── Divider ── */
  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── Select ── */
  .styled-select {
    width: 100%;
    appearance: none;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    padding: 12px 40px 12px 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    outline: none;
  }

  .styled-select:focus {
    border-color: var(--border-active);
    background-color: var(--surface-2);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .styled-select option {
    background: #1a1e28;
    color: var(--text);
  }

  /* ── Text input ── */
  .styled-input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 2px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    padding: 12px 14px;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    letter-spacing: 0.02em;
  }

  .styled-input::placeholder {
    color: var(--text-muted);
    font-style: italic;
  }

  .styled-input:focus {
    border-color: var(--border-active);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  /* ── Submit button ── */
  .submit-btn {
    width: 100%;
    position: relative;
    padding: 14px 24px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-family: var(--sans);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    overflow: hidden;
    transition: opacity 0.2s, transform 0.15s;
    background: var(--accent);
    color: #0a0b0f;
  }

  .submit-btn:not(:disabled):hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .submit-btn:not(:disabled):active {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Shimmer on loading */
  .submit-btn.loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
    animation: shimmer 1.2s infinite;
    transform: translateX(-100%);
  }

  @keyframes shimmer {
    to { transform: translateX(100%); }
  }

  .btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    z-index: 1;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(10,11,15,0.3);
    border-top-color: #0a0b0f;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Footer note ── */
  .card-footer {
    padding: 14px 36px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .footer-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.5;
    flex-shrink: 0;
  }
`;

export default function Upload() {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${API}/datasets`)
      .then((res) => setDatasets(res.data.datasets))
      .catch((err) => console.error(err));
  }, []);

  const handleDatasetChange = (e) => {
    setSelectedDataset(e.target.value);
    if (e.target.value) setFile(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setSelectedDataset("");
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!target.trim()) return setError("Please enter a target column.");
    if (!selectedDataset && !file)
      return setError("Please upload a file or select a sample dataset.");
    if (file && !file.name.endsWith(".csv"))
      return setError("Please upload a CSV file.");

    setLoading(true);
    try {
      let columns;

      if (selectedDataset) {
        const res = await axios.post(
          `${API}/load_dataset`,
          new URLSearchParams({ name: selectedDataset }),
        );
        columns = res.data.columns;
      } else {
        const formData = new FormData();
        formData.append("file", file);
        const res = await axios.post(`${API}/upload`, formData);
        columns = res.data.columns;
      }

      const trainRes = await axios.post(
        `${API}/train?target=${encodeURIComponent(target)}`,
      );

      const scores = trainRes.data.scores;

      //  SAVE DATA 
      localStorage.setItem("automl_results", JSON.stringify(scores));
      localStorage.setItem("automl_columns", JSON.stringify(columns));
      localStorage.setItem("automl_target", target);

      //  navigate
      navigate("/results", {
        state: { results: scores, columns, target },
      });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <style>{styles}</style>
      <div className="upload-root">
        <div className="upload-card">
          <div className="card-bar" />

          <div className="card-header">
            <div className="card-eyebrow">AutoML · Dataset Ingestion</div>
            <h1 className="card-title">
              Train a <span>Model</span>
            </h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card-body">
              {error && (
                <div className="error-box">
                  <i className="error-icon">!</i>
                  {error}
                </div>
              )}

              {/* File upload */}
              <div>
                <div className="field-label">Upload CSV</div>
                <div
                  className={`drop-zone${dragOver ? " drag-over" : ""}${file ? " has-file" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) {
                      setFile(f);
                      setSelectedDataset("");
                    }
                  }}
                >
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                  />
                  <div className="drop-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  {file ? (
                    <div className="file-chip">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {file.name}
                    </div>
                  ) : (
                    <>
                      <div className="drop-primary">
                        Drop file or click to browse
                      </div>
                      <div className="drop-secondary">
                        Accepts .csv — max 50 MB
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="divider">or</div>

              {/* Dataset picker */}
              <div>
                <div className="field-label">Sample Dataset</div>
                <select
                  className="styled-select"
                  onChange={handleDatasetChange}
                  value={selectedDataset}
                >
                  <option value="">Choose a built-in dataset…</option>
                  {datasets.map((ds) => (
                    <option key={ds} value={ds}>
                      {ds}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target column */}
              <div>
                <div className="field-label">Target Column</div>
                <input
                  className="styled-input"
                  placeholder="e.g. price, churn, label"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={`submit-btn${loading ? " loading" : ""}`}
              >
                <div className="btn-inner">
                  {loading && <div className="spinner" />}
                  {loading ? "Training model…" : "Upload & Train"}
                </div>
              </button>
            </div>
          </form>

          <div className="card-footer">
            <div className="footer-dot" />
            Supports classification &amp; regression · Session-scoped storage
          </div>
        </div>
      </div>
    </Layout>
  );
}
