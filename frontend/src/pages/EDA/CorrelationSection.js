import React from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid } from "recharts";
import { ACCENT, VIOLET, RED, GOLD, TEXT_MUT, TEXT_DIM, BORDER } from "../../utils/constants.js";
import { corrColor } from "./helpers";

const renderCustomDot = (props) => {
  const { cx, cy, fill } = props;
  return <circle cx={cx} cy={cy} r={2} fill={fill} fillOpacity={0.45} />;
};

function CorrelationSection({ correlation, scatterData, selectedPair, onSelectPair, onCardExpand }) {
  if (!correlation || Object.keys(correlation).length === 0) return null;

  // Get top 6 correlated pairs (excluding self-correlations)
  const pairs = [];
  const cols = Object.keys(correlation);
  for (let i = 0; i < cols.length; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const val = correlation[cols[i]]?.[cols[j]];
      if (val !== undefined && !isNaN(val)) {
        pairs.push({ colA: cols[i], colB: cols[j], corr: val });
      }
    }
  }
  pairs.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  const topPairs = pairs.slice(0, 6);

  return (
    <>
      {/* -- Correlation Matrix -- */}
      <div
        className="section"
        id="correlation-matrix"
        style={{ animationDelay: "0.21s" }}
      >
        <div className="section-label">Correlation Matrix</div>
        <div className="panel">
          <div className="panel-bar gold" />
          <div className="panel-body">
            <div className="corr-scroll">
              <table className="corr-table">
                <thead>
                  <tr>
                    <th />
                    {Object.keys(correlation).map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(correlation).map(([row, cols]) => (
                    <tr key={row}>
                      <th>{row}</th>
                      {Object.entries(cols).map(([col, val], i) => {
                        const pairKey = [row, col].sort().join("__");
                        const isSelected = selectedPair === pairKey;
                        return (
                          <td
                            key={i}
                            className={isSelected ? "selected" : ""}
                            style={{
                              background: corrColor(val),
                              color: Math.abs(val) > 0.5 ? "#e8eaf0" : TEXT_DIM,
                              cursor: row !== col ? "pointer" : "default",
                            }}
                            onClick={() => {
                              if (row === col) return;
                              onSelectPair(isSelected ? null : pairKey);
                            }}
                          >
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* -- Scatter Plots -- */}
      {topPairs.length > 0 && (
        <div
          className="section enlargeable-section"
          id="scatter-plots"
          style={{ animationDelay: "0.16s" }}
        >
          <div className="section-label">Scatter Plots · Top Correlated Pairs</div>
          <div className="chart-grid">
            {topPairs.map(({ colA, colB, corr }) => {
              const key = [colA, colB].sort().join("__");
              const isSelected = selectedPair === key;
              const corrAbs = Math.abs(corr);
              const corrBadgeColor =
                corrAbs > 0.7
                  ? corr > 0
                    ? ACCENT
                    : RED
                  : corrAbs > 0.4
                    ? GOLD
                    : TEXT_DIM;
              const corrBadgeBorder =
                corrAbs > 0.7
                  ? corr > 0
                    ? "rgba(99,210,179,0.4)"
                    : "rgba(248,113,113,0.4)"
                  : corrAbs > 0.4
                    ? "rgba(240,192,64,0.4)"
                    : "rgba(255,255,255,0.1)";
              const chartPoints =
                scatterData?.[`${colA}__${colB}`] ||
                scatterData?.[`${colB}__${colA}`] ||
                [];

              return (
                <div
                  className="chart-card clickable"
                  key={key}
                  style={isSelected ? { borderColor: "rgba(99,210,179,0.3)" } : {}}
                  onClick={() =>
                    onCardExpand?.(
                      `Scatter • ${colA} vs ${colB}`,
                      <div style={{ width: "100%", minHeight: 420 }}>
                        <ResponsiveContainer width="100%" height={360}>
                          <ScatterChart
                            margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                          >
                            <CartesianGrid strokeDasharray="2 4" stroke={BORDER} />
                            <XAxis
                              dataKey="x"
                              type="number"
                              name={colA}
                              padding={{ right: 20 }}
                              tick={{
                                fill: TEXT_MUT,
                                fontSize: 9,
                                fontFamily: "'DM Mono'",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              dataKey="y"
                              type="number"
                              name={colB}
                              tick={{
                                fill: TEXT_MUT,
                                fontSize: 9,
                                fontFamily: "'DM Mono'",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <ZAxis range={[1, 1]} />
                            <Tooltip
                              cursor={{ strokeDasharray: "3 3", stroke: BORDER }}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div
                                    style={{
                                      background: "#111318",
                                      border: "1px solid rgba(99,210,179,0.25)",
                                      borderRadius: 2,
                                      padding: "8px 14px",
                                      fontFamily: "'DM Mono',monospace",
                                      fontSize: 11,
                                    }}
                                  >
                                    <div
                                      style={{
                                        color: TEXT_MUT,
                                        fontSize: 10,
                                        marginBottom: 3,
                                      }}
                                    >
                                      {colA}:{" "}
                                      <span style={{ color: ACCENT }}>
                                        {d?.x?.toFixed(3)}
                                      </span>
                                    </div>
                                    <div style={{ color: TEXT_MUT, fontSize: 10 }}>
                                      {colB}:{" "}
                                      <span style={{ color: VIOLET }}>
                                        {d?.y?.toFixed(3)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              }}
                            />
                            <Scatter
                              data={chartPoints}
                              fill={
                                corrAbs > 0.7 ? (corr > 0 ? ACCENT : RED) : GOLD
                              }
                              fillOpacity={0.45}
                              shape={renderCustomDot}
                            />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>,
                    )
                  }
                >
                  <div
                    className={`chart-card-bar ${corrAbs > 0.7 ? (corr > 0 ? "" : "red") : "gold"}`}
                  />
                  <div className="chart-card-body">
                    <div className="scatter-pair-header">
                      <div className="scatter-pair-cols">
                        <div
                          className={`chart-col-dot ${corrAbs > 0.7 ? (corr > 0 ? "" : "red") : "gold"}`}
                        />
                        <span
                          style={{
                            maxWidth: 100,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {colA}
                        </span>
                        <span style={{ color: TEXT_MUT, fontSize: 9 }}>vs</span>
                        <span
                          style={{
                            maxWidth: 100,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {colB}
                        </span>
                      </div>
                      <span
                        className="scatter-corr-badge"
                        style={{
                          color: corrBadgeColor,
                          borderColor: corrBadgeBorder,
                          background: "transparent",
                          fontSize: 9,
                          fontFamily: "var(--mono)",
                          letterSpacing: "0.06em",
                        }}
                      >
                        r = {corr.toFixed(3)}
                      </span>
                    </div>
                    {chartPoints.length > 0 ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <ScatterChart
                          margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                        >
                          <CartesianGrid strokeDasharray="2 4" stroke={BORDER} />
                          <XAxis
                            dataKey="x"
                            type="number"
                            name={colA}
                            padding={{ right: 20 }}
                            tick={{
                              fill: TEXT_MUT,
                              fontSize: 9,
                              fontFamily: "'DM Mono'",
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            dataKey="y"
                            type="number"
                            name={colB}
                            tick={{
                              fill: TEXT_MUT,
                              fontSize: 9,
                              fontFamily: "'DM Mono'",
                            }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <ZAxis range={[1, 1]} />
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3", stroke: BORDER }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0]?.payload;
                              return (
                                <div
                                  style={{
                                    background: "#111318",
                                    border: "1px solid rgba(99,210,179,0.25)",
                                    borderRadius: 2,
                                    padding: "8px 14px",
                                    fontFamily: "'DM Mono',monospace",
                                    fontSize: 11,
                                  }}
                                >
                                  <div
                                    style={{
                                      color: TEXT_MUT,
                                      fontSize: 10,
                                      marginBottom: 3,
                                    }}
                                  >
                                    {colA}:{" "}
                                    <span style={{ color: ACCENT }}>
                                      {d?.x?.toFixed(3)}
                                    </span>
                                  </div>
                                  <div style={{ color: TEXT_MUT, fontSize: 10 }}>
                                    {colB}:{" "}
                                    <span style={{ color: VIOLET }}>
                                      {d?.y?.toFixed(3)}
                                    </span>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Scatter
                            data={chartPoints}
                            fill={corrAbs > 0.7 ? (corr > 0 ? ACCENT : RED) : GOLD}
                            fillOpacity={0.45}
                            shape={renderCustomDot}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div
                        style={{
                          height: 180,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          color: TEXT_MUT,
                        }}
                      >
                        No sample data available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export default CorrelationSection;
