import React from "react";
import { ACCENT, VIOLET, RED, TEXT_MUT } from "../../utils/constants.js";

function StatsSection({ 
    data, 
    colSearch, 
    setColSearch, 
    colTypeFilter, 
    setColTypeFilter, 
    filteredCols, 
    numericCols, 
    categoricalCols,
    summaryColNames
}) {
  return (
    <>
      {/* -- Column Search & Filter -- */}
      <div className="section" style={{ animationDelay: "0.06s" }}>
        <div className="section-label">Dataset Columns</div>

        {/* Search input */}
        <div className="col-search-wrap">
          <svg
            className="col-search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="col-search-input"
            type="text"
            placeholder="Search columns…"
            value={colSearch}
            onChange={(e) => setColSearch(e.target.value)}
          />
        </div>

        {/* Type filter */}
        <div className="col-filter-row">
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: TEXT_MUT,
            }}
          >
            Filter:
          </span>
          {[
            { key: "all", label: `All (${data.columns?.length || 0})` },
            { key: "numeric", label: `Numeric (${numericCols.length})` },
            {
              key: "categorical",
              label: `Categorical (${categoricalCols.length})`,
              cls: "violet",
            },
          ].map(({ key, label, cls }) => (
            <button
              key={key}
              className={`col-filter-btn ${cls || ""} ${colTypeFilter === key ? "active" : ""}`}
              onClick={() => setColTypeFilter(key)}
            >
              {label}
            </button>
          ))}
          {(colSearch || colTypeFilter !== "all") && (
            <button
              className="col-filter-btn"
              onClick={() => {
                setColSearch("");
                setColTypeFilter("all");
              }}
              style={{ color: RED, borderColor: "rgba(248,113,113,0.3)" }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Pills */}
        <div className="pill-row">
          {filteredCols.length === 0 ? (
            <span className="col-pill-none">
              No columns match "{colSearch}"
            </span>
          ) : (
            filteredCols.map((col) => {
              const isNum = numericCols.includes(col);
              const isCat = categoricalCols.includes(col);
              return (
                <div
                  className="col-pill"
                  key={col}
                  style={{
                    borderColor: isNum
                      ? "rgba(99,210,179,0.2)"
                      : isCat
                        ? "rgba(167,139,250,0.2)"
                        : undefined,
                    color: isNum ? ACCENT : isCat ? VIOLET : undefined,
                  }}
                >
                  {col}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* -- Sample Data -- */}
      <div
        className="section"
        id="sample-data"
        style={{ animationDelay: "0.08s" }}
      >
        <div className="section-label">Sample Data</div>
        <div className="panel">
          <div className="panel-bar" />
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {data.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sample.map((row, i) => (
                  <tr key={i}>
                    {data.columns.map((col) => (
                      <td key={`${i}-${col}`}>{row[col] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </>
  );
}

export default StatsSection;
