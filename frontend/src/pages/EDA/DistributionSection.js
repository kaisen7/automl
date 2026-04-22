import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { ACCENT, TEXT_MUT, BORDER, PIE_COLORS } from "../../utils/constants.js";
import { ChartTooltip, buildPieChartData, PieLegend } from "./helpers";

function DistributionSection({ histograms, categorical, numericCols, onCardExpand }) {
  return (
    <>
      {/* -- Histograms -- */}
      {histograms &&
        numericCols.length > 0 &&
        Object.keys(histograms).length > 0 && (
          <div
            className="section enlargeable-section"
            id="histograms"
            style={{ animationDelay: "0.17s" }}
          >
            <div className="section-label">Histograms</div>
            <div className="chart-grid">
              {Object.entries(histograms).map(([col, values]) => (
                <div
                  className="chart-card clickable"
                  key={col}
                  onClick={() =>
                    onCardExpand?.(
                      `Histogram | ${col}`,
                      <div style={{ width: "100%", minHeight: 420 }}>
                        <ResponsiveContainer width="100%" height={360}>
                          <BarChart
                            data={values}
                            margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                          >
                            <CartesianGrid
                              strokeDasharray="2 4"
                              stroke={BORDER}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="bin"
                              tick={{
                                fill: TEXT_MUT,
                                fontSize: 9,
                                fontFamily: "'DM Mono'",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{
                                fill: TEXT_MUT,
                                fontSize: 9,
                                fontFamily: "'DM Mono'",
                              }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              content={<ChartTooltip />}
                              cursor={{ fill: "rgba(99,210,179,0.06)" }}
                            />
                            <Bar
                              isAnimationActive={true}
                              animationBegin={200}
                              animationDuration={1200}
                              animationEasing="ease-in-out"
                              dataKey="count"
                              fill={ACCENT}
                              radius={[2, 2, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>,
                    )
                  }
                >
                  <div className="chart-card-bar" />
                  <div className="chart-card-body">
                    <div className="chart-col-name">
                      <div className="chart-col-dot" />
                      {col}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={values}
                        margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                      >
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke={BORDER}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="bin"
                          tick={{
                            fill: TEXT_MUT,
                            fontSize: 9,
                            fontFamily: "'DM Mono'",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{
                            fill: TEXT_MUT,
                            fontSize: 9,
                            fontFamily: "'DM Mono'",
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ fill: "rgba(99,210,179,0.06)" }}
                        />
                        <Bar
                          isAnimationActive={true}
                          animationBegin={200}
                          animationDuration={1200}
                          animationEasing="ease-in-out"
                          dataKey="count"
                          fill={ACCENT}
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* -- Categorical pie charts -- */}
      {categorical && Object.keys(categorical).length > 0 && (
        <div
          className="section enlargeable-section"
          id="categorical-distribution"
          style={{ animationDelay: "0.19s" }}
        >
          <div className="section-label">Categorical Distribution</div>
          <div className="chart-grid">
            {Object.entries(categorical).map(([col, values]) => {
              const chartData = buildPieChartData(values, 6);
              return (
                <div
                  className="chart-card clickable"
                  key={col}
                  onClick={() =>
                    onCardExpand?.(
                      `Category Distribution | ${col}`,
                      <div style={{ width: "100%", minHeight: 420 }}>
                        <ResponsiveContainer width="100%" height={360}>
                          <PieChart>
                            <Pie
                              isAnimationActive={true}
                              animationBegin={300}
                              animationDuration={1000}
                              data={chartData}
                              dataKey="value"
                              nameKey="name"
                              outerRadius={110}
                              innerRadius={50}
                              paddingAngle={2}
                            >
                              {chartData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={PIE_COLORS[i % PIE_COLORS.length]}
                                  stroke="none"
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip />} />
                            <Legend content={<PieLegend />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>,
                    )
                  }
                >
                  <div className="chart-card-bar violet" />
                  <div className="chart-card-body">
                    <div className="chart-col-name">
                      <div className="chart-col-dot violet" />
                      {col}
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          isAnimationActive={true}
                          animationBegin={300}
                          animationDuration={1000}
                          data={chartData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          innerRadius={36}
                          paddingAngle={2}
                        >
                          {chartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend content={<PieLegend />} />
                      </PieChart>
                    </ResponsiveContainer>
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

export default DistributionSection;
