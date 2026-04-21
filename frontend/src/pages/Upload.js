import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import API from "../api";
import './styles/Upload.css'

export default function Upload() {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [columns, setColumns] = useState([]);
  const [redundantFeatures, setRedundantFeatures] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  // fetch available sample datasets on mount
  useEffect(() => {
    axios
      .get(`${API}/datasets`)
      .then((res) => setDatasets(res.data.datasets))
      .catch((err) => console.error(err));
  }, []);

  // warn user if they try to close tab while training
  useEffect(() => {
    const handler = (e) => {
      if (loading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading]);

  // read first line of csv to get column names
  const readCsvHeader = async (file) => {
    try {
      const text = await file.text();
      const firstLine = text.split(/\r?\n/)[0] || "";
      return firstLine
        .split(",")
        .map((col) => col.trim())
        .filter(Boolean);
    } catch (err) {
      console.error("Failed to parse CSV header", err);
      return [];
    }
  };

  const handleDatasetChange = async (e) => {
    const picked = e.target.value;
    setSelectedDataset(picked);
    setTarget("");
    setColumns([]);

    if (picked) {
      setFile(null);
      try {
        const res = await axios.post(
          `${API}/load_dataset`,
          new URLSearchParams({ name: picked }),
        );
        setColumns(res.data.columns || []);
        setRedundantFeatures(res.data.redundant_features || []);
      } catch (err) {
        console.error(err);
        setColumns([]);
        setRedundantFeatures([]);
      }
    }
  };

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (f) {
      setFile(f);
      setSelectedDataset("");
      setTarget("");
      setRedundantFeatures([]);

      const cols = await readCsvHeader(f);
      setColumns(cols);
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
      let cols;

      if (selectedDataset) {
        // use the selected sample dataset
        const res = await axios.post(
          `${API}/load_dataset`,
          new URLSearchParams({ name: selectedDataset }),
        );
        cols = res.data.columns;
        setColumns(cols);
      } else {
        // upload the file
        const formData = new FormData();
        formData.append("file", file);
        const res = await axios.post(`${API}/upload`, formData);
        cols = res.data.columns;
        setColumns(cols);
        setRedundantFeatures(res.data.redundant_features || []);
      }

      // now train
      const trainRes = await axios.post(
        `${API}/train?target=${encodeURIComponent(target)}`,
      );

      const scores = trainRes.data.scores;

      // save to localStorage so other pages can access it
      localStorage.setItem("automl_results", JSON.stringify(scores));
      localStorage.setItem("automl_columns", JSON.stringify(cols));
      localStorage.setItem("automl_target", target);
      localStorage.setItem(
        "automl_types",
        JSON.stringify(trainRes.data.column_types),
      );
      localStorage.setItem(
        "automl_redundant_features",
        JSON.stringify(trainRes.data.redundant_features || redundantFeatures),
      );
      localStorage.setItem(
        "automl_dataset_name",
        (selectedDataset || (file ? file.name : "dataset")).replace(/\.[^/.]+$/, ""),
      );

      // go to results page
      navigate("/results", {
        state: { results: scores, columns: cols, target },
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

              {/* file upload area */}
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

              {/* sample dataset picker */}
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

              {/* target column selector */}
              <div>
                <div className="field-label">Target Column</div>

                <select
                  className="styled-select"
                  onChange={(e) => setTarget(e.target.value)}
                  value={target}
                >
                  <option value="">Choose a Target Column…</option>
                  {columns
                    .filter((col) => !redundantFeatures.includes(col))
                    .map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                </select>
                {redundantFeatures.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: "#9ca3af",
                      lineHeight: 1.4,
                    }}
                  >
                    High-cardinality columns excluded from target selection: {redundantFeatures.join(", ")}.
                  </div>
                )}
              </div>

              {/* submit button */}
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
