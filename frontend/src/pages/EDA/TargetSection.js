import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { PIE_COLORS, TEXT_MUT, BORDER } from "../../utils/constants.js";
import { ChartTooltip, PieLegend } from "./helpers";

function TargetSection({ 
    targetColumn, 
    targetDistribution, 
    targetType, 
    categoricalTargetDistribution,
    onCardExpand 
}) {
  const hasTargetDist = targetDistribution && Object.keys(targetDistribution).length > 0;
  const hasCatTargetDist = categoricalTargetDistribution && Object.keys(categoricalTargetDistribution).length > 0;

  if (!targetColumn || (!hasTargetDist && !hasCatTargetDist)) return null;

  const chartData = hasTargetDist 
    ? Object.entries(targetDistribution).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <>
      {/* -- Target Distribution -- */}
      {hasTargetDist && (
        <div
          className="section enlargeable-section"
          id="target-distribution"
          style={{ animationDelay: "0.15s" }}
        >
        <div className="section-label">Target Distribution</div>
        <div className="chart-grid">
          <div
            className="chart-card clickable"
            onClick={() =>
              onCardExpand?.(
                `Target Distribution | ${targetColumn}`,
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
                {targetColumn}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    isAnimationActive={true}
                    animationBegin={300}
                    animationDuration={1000}
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={40}
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
        </div>
      </div>
    )}

    {/* -- Categorical Features vs Target -- */}
      {categoricalTargetDistribution && Object.keys(categoricalTargetDistribution).length > 0 && (
        <div
          className="section enlargeable-section"
          id="categorical-vs-target"
          style={{ animationDelay: "0.17s" }}
        >
          <div className="section-label">Categorical Features vs Target</div>
          <div className="chart-grid">
            {Object.entries(categoricalTargetDistribution).map(([feature, info]) => (
              <div
                className="chart-card clickable"
                key={feature}
                onClick={() =>
                  onCardExpand?.(
                    `Target vs ${feature}`,
                    <div style={{ width: "100%", minHeight: 420 }}>
                      <ResponsiveContainer width="100%" height={360}>
                        <BarChart
                          data={info.data}
                          margin={{ top: 0, right: 0, bottom: 0, left: -10 }}
                        >
                          <CartesianGrid
                            strokeDasharray="2 4"
                            stroke={BORDER}
                            vertical={false}
                          />
                          <XAxis
                            dataKey="category"
                            tick={{
                              fill: TEXT_MUT,
                              fontSize: 9,
                              fontFamily: "'DM Mono'",
                            }}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={60}
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
                          <Tooltip content={<ChartTooltip />} />
                          <Legend content={<PieLegend />} />
                          {info.target_labels.map((label, labelIndex) => (
                            <Bar
                              key={label}
                              isAnimationActive={true}
                              animationBegin={200}
                              animationDuration={1200}
                              animationEasing="ease-in-out"
                              dataKey={label}
                              stackId="target"
                              fill={PIE_COLORS[labelIndex % PIE_COLORS.length]}
                              radius={[2, 2, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>,
                  )
                }
              >
                <div className="chart-card-bar gold" />
                <div className="chart-card-body">
                  <div className="chart-col-name">
                    <div className="chart-col-dot gold" />
                    {feature}
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={info.data}
                      margin={{ top: 0, right: 0, bottom: 0, left: -10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke={BORDER}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="category"
                        tick={{
                          fill: TEXT_MUT,
                          fontSize: 9,
                          fontFamily: "'DM Mono'",
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
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
                      <Tooltip content={<ChartTooltip />} />
                      <Legend content={<PieLegend />} />
                      {info.target_labels.map((label, labelIndex) => (
                        <Bar
                          key={label}
                          isAnimationActive={true}
                          animationBegin={200}
                          animationDuration={1200}
                          animationEasing="ease-in-out"
                          dataKey={label}
                          stackId="target"
                          fill={PIE_COLORS[labelIndex % PIE_COLORS.length]}
                          radius={[2, 2, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default TargetSection;
