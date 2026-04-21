import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import API from "../api";
import "./styles/History.css";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Turns an ISO timestamp into a human-friendly relative string */
function timeAgo(isoString) {
  if (!isoString) return "Unknown date";
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/** Formats an ISO timestamp as a readable date + time */
function formatDateTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── component ─────────────────────────────────────────────────────────────────

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [loadingCard, setLoadingCard] = useState(null); // name of card being loaded

  // fetch history list on mount
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/history`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      setError("Failed to load history. Make sure the backend is running.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // click a card → load session → go to results (no re-training)
  const handleCardClick = async (session) => {
    if (loadingCard) return;
    setLoadingCard(session.name);
    setError("");

    try {
      const res = await fetch(`${API}/history/${encodeURIComponent(session.name)}/load`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data = await res.json();

      // mirror what Upload.js stores in localStorage
      // IMPORTANT: automl_columns must be original CSV columns (not model feature columns)
      // so the Predictor page guard (target-in-columns check) works correctly
      localStorage.setItem("automl_results",           JSON.stringify(data.scores || {}));
      localStorage.setItem("automl_columns",           JSON.stringify(data.original_columns || []));
      localStorage.setItem("automl_target",            data.target || "");
      localStorage.setItem("automl_types",             JSON.stringify(data.column_types || {}));
      localStorage.setItem("automl_redundant_features", JSON.stringify(data.redundant_features || []));
      localStorage.setItem("automl_dataset_name",      data.dataset_name || session.name);

      // navigate to results with scores in state (no spinner, instant render)
      navigate("/results", {
        state: {
          results: data.scores || {},
          columns: data.columns || [],
          target:  data.target || "",
          fromHistory: true,
        },
      });
    } catch (e) {
      setError(`Could not load session "${session.dataset_name}": ${e.message}`);
      console.error(e);
    } finally {
      setLoadingCard(null);
    }
  };

  return (
    <Layout>
      <div className="history-root">
        <div className="history-wrap">

          {/* ── page header ── */}
          <div className="history-header">
            <div className="history-eyebrow">AutoML · Training Sessions</div>
            <h1 className="history-title">
              Session <span>History</span>
            </h1>
            <div className="history-subtitle">
              Click any session to restore it instantly — no re-training needed.
            </div>
          </div>

          {/* ── error banner ── */}
          {error && (
            <div className="history-error">⚠ {error}</div>
          )}

          {/* ── loading state ── */}
          {loading ? (
            <div className="history-loading">
              <div className="history-spinner" />
              <div className="history-loading-text">Fetching sessions…</div>
            </div>
          ) : sessions.length === 0 ? (

            /* ── empty state ── */
            <div className="history-empty">
              <div className="history-empty-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </div>
              <div className="history-empty-title">No sessions yet</div>
              <div className="history-empty-sub">
                Train a model on a dataset and it will appear here automatically — along with all metrics and EDA data.
              </div>
              <button
                className="history-empty-btn"
                onClick={() => navigate("/upload")}
              >
                Train a Model
              </button>
            </div>

          ) : (
            <>
              {/* ── session count label ── */}
              <div className="history-section-label">
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} saved
              </div>

              {/* ── session grid ── */}
              <div className="history-grid">
                {sessions.map((session, i) => (
                  <SessionCard
                    key={session.name}
                    session={session}
                    index={i}
                    isLoading={loadingCard === session.name}
                    onClick={() => handleCardClick(session)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── SessionCard ───────────────────────────────────────────────────────────────

function SessionCard({ session, index, isLoading, onClick }) {
  const delay = `${0.08 + index * 0.06}s`;
  const problemType = session.problem_type || "unknown";
  const typeCls = problemType === "classification"
    ? "type-classification"
    : "type-regression";

  return (
    <div
      className={`session-card${isLoading ? " loading-session" : ""}`}
      style={{ animationDelay: delay }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      title={`Trained: ${formatDateTime(session.timestamp)}`}
    >
      {/* top coloured bar */}
      <div className="card-accent-bar" />

      <div className="card-body-inner">
        {/* top row: icon + name + arrow */}
        <div className="card-top-row">
          <div className="card-icon-box">
            {isLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                style={{ animation: "spin 0.7s linear infinite" }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M2 12a10 10 0 0110-10" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            )}
          </div>

          <div className="card-name-block">
            <div className="card-dataset-name">{session.dataset_name || session.name}</div>
            <div className="card-timestamp" title={formatDateTime(session.timestamp)}>
              🕐 {timeAgo(session.timestamp)}
            </div>
          </div>

          <div className="card-arrow">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>

        <div className="card-divider" />

        {/* meta badges row */}
        <div className="card-meta-row">
          {/* problem type badge */}
          <span className={`meta-badge ${typeCls}`}>
            {problemType}
          </span>

          {/* best model badge */}
          {session.best_model && (
            <span className="meta-badge best-model">
              🏆 {session.best_model}
            </span>
          )}

          {/* best cv score — pushed to right */}
          {session.best_cv_score != null && (
            <div className="card-score-chip">
              <span className="score-label-small">
                {problemType === "regression" ? "Best R²" : "Best F1"}
              </span>
              <span className="score-value-big">
                {Number(session.best_cv_score).toFixed(3)}
              </span>
            </div>
          )}
        </div>

        {/* target column row */}
        {session.target && (
          <div className="card-target-row">
            <span className="target-key">Target</span>
            <span className="target-val">{session.target}</span>
          </div>
        )}
      </div>
    </div>
  );
}
