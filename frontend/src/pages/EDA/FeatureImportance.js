import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TEXT_MUT, TEXT_DIM, VIOLET, BORDER } from "../../utils/constants.js";
import { ChartTooltip } from "./helpers";

function FeatureImportancePanel({ featureImportance, onCardExpand }) {
  if (!featureImportance || featureImportance.length === 0) return null;
  return (
    <div
      className="section enlargeable-section"
      id="feature-importance"
      style={{ animationDelay: "0.25s" }}
    >
      <div className="section-label">Feature Importance</div>
      <div
        className="panel clickable"
        onClick={() =>
          onCardExpand?.(
            "Feature Importance",
            <div style={{ width: "100%", minHeight: 420 }}>
              <ResponsiveContainer
                width="100%"
                height={Math.max(320, featureImportance.length * 28)}
              >
                <BarChart
                  layout="vertical"
                  data={featureImportance}
                  margin={{ top: 0, right: 20, bottom: 0, left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke={BORDER}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{
                      fill: TEXT_MUT,
                      fontSize: 9,
                      fontFamily: "'DM Mono'",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={160}
                    tick={{
                      fill: TEXT_DIM,
                      fontSize: 10,
                      fontFamily: "'DM Mono'",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "rgba(167,139,250,0.06)" }}
                  />
                  <Bar
                    isAnimationActive={true}
                    animationBegin={200}
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    dataKey="value"
                    fill={VIOLET}
                    radius={[0, 2, 2, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>,
          )
        }
      >
        <div className="panel-bar violet" />
        <div className="panel-body">
          <ResponsiveContainer
            width="100%"
            height={Math.max(200, featureImportance.length * 28)}
          >
            <BarChart
              layout="vertical"
              data={featureImportance}
              margin={{ top: 0, right: 20, bottom: 0, left: 20 }}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                stroke={BORDER}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{
                  fill: TEXT_MUT,
                  fontSize: 9,
                  fontFamily: "'DM Mono'",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{
                  fill: TEXT_DIM,
                  fontSize: 10,
                  fontFamily: "'DM Mono'",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "rgba(167,139,250,0.06)" }}
              />
              <Bar
                isAnimationActive={true}
                animationBegin={200}
                animationDuration={1200}
                animationEasing="ease-in-out"
                dataKey="value"
                fill={VIOLET}
                radius={[0, 2, 2, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default FeatureImportancePanel;
