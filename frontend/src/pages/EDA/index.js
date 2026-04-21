import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import API from "../../api";
import "../styles/EDA.css";
import { normalizeFeatureName, exportSummaryCSV, ExpandOverlay } from "./helpers";

// Modular Components
import SidebarNav from "./SidebarNav";
import EDAStatCards from "./EDAStatCards";
import MLReadinessPanel from "./MLReadiness";
import StatsSection from "./StatsSection";
import DistributionSection from "./DistributionSection";
import TargetSection from "./TargetSection";
import CorrelationSection from "./CorrelationSection";
import ModelScores from "./ModelScores";
import OutlierPanel from "./OutlierPanel";
import BoxPlotPanel from "./BoxPlotPanel";
import FeatureImportancePanel from "./FeatureImportance";
import MissingValuesPanel from "./MissingValues";
import SummarySection from "./SummarySection";

export default function EDAPage() {
  const navSections = useMemo(
    () => [
      { id: "sample-data", label: "Sample Data" },
      { id: "outlier-detection", label: "Outliers and Box Plots" },
      { id: "ml-readiness", label: "ML Readiness" },
      { id: "histograms", label: "Histograms" },
      { id: "categorical-distribution", label: "Categorical Distribution" },
      { id: "correlation-matrix", label: "Correlation Matrix" },
      { id: "scatter-plots", label: "Scatter" },
      { id: "feature-importance", label: "Feature Importance" },
      { id: "missing-values", label: "Missing Values" },
      { id: "summary-statistics", label: "Summary" },
    ],
    [],
  );

  const [data, setData] = useState(null);
  const [trainRes, setTrainRes] = useState(null);
  const [error, setError] = useState(null);
  const datasetName = localStorage.getItem("automl_dataset_name");
  const navigate = useNavigate();

  // Column search / filter state
  const [colSearch, setColSearch] = useState("");
  const [colTypeFilter, setColTypeFilter] = useState("all");

  // Selection & UI state
  const [selectedPair, setSelectedPair] = useState(null);
  const [expandedChart, setExpandedChart] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("sample-data");

  useEffect(() => {
    if (window.innerWidth > 1120) {
      setSidebarOpen(true);
    }
  }, []);

  const openChart = (title, content) => setExpandedChart({ title, content });
  const closeExpanded = () => setExpandedChart(null);

  // Data Fetching
  useEffect(() => {
    const stored = localStorage.getItem("automl_results");
    if (!stored) {
      setError("No dataset loaded. Please upload a dataset first.");
      return;
    }
    axios
      .get(`${API}/eda`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load EDA data."),
      );
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/model_info`)
      .then((res) => setTrainRes(res.data))
      .catch(() => {});
  }, []);

  // Scroll Synchronization
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY + window.innerHeight * 0.3;
      const sectionsWithOffset = navSections
        .map((section) => ({
          id: section.id,
          el: document.getElementById(section.id),
        }))
        .filter((s) => s.el)
        .sort((a, b) => a.el.offsetTop - b.el.offsetTop);

      let current = navSections[0]?.id;
      for (let section of sectionsWithOffset) {
        if (section.el.offsetTop <= offset) {
          current = section.id;
        } else {
          break;
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navSections, data]);

  // Derived Data
  const numericCols = useMemo(() => data?.numeric_columns || [], [data]);
  const categoricalCols = useMemo(() => data?.categorical_columns || [], [data]);
  const duplicateRows = data?.duplicate_rows ?? 0;
  const totalOutliers = useMemo(() => 
    Object.values(data?.outliers || {}).reduce((a, b) => a + b, 0), 
    [data]
  );

  const filteredCols = useMemo(() => {
    if (!data) return [];
    let cols = data.columns || [];
    if (colTypeFilter === "numeric")
      cols = cols.filter((c) => numericCols.includes(c));
    else if (colTypeFilter === "categorical")
      cols = cols.filter((c) => categoricalCols.includes(c));
    if (colSearch.trim()) {
      const q = colSearch.trim().toLowerCase();
      cols = cols.filter((c) => c.toLowerCase().includes(q));
    }
    return cols;
  }, [data, colSearch, colTypeFilter, numericCols, categoricalCols]);

  const featureImportance = useMemo(() => {
    if (!data?.importance) return [];
    const importanceMap = {};
    Object.entries(data.importance).forEach(([feature, value]) => {
      const normalized = normalizeFeatureName(feature, categoricalCols);
      if (importanceMap[normalized] === undefined || value > importanceMap[normalized]) {
        importanceMap[normalized] = value;
      }
    });
    return Object.entries(importanceMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [data?.importance, categoricalCols]);

  const missingEntries = useMemo(() => Object.entries(data?.missing || {}), [data]);
  const maxMissing = useMemo(() => Math.max(...missingEntries.map(([, v]) => v), 1), [missingEntries]);
  const summaryColNames = useMemo(() => Object.keys(data?.summary || {}), [data]);

  if (!data && !error) {
    return (
      <Layout>
        <div className="eda-root">
          <div className="eda-inner">
            <div className="state-card">
              <div className="loading-dots">
                <span /><span /><span />
              </div>
              <div className="state-title">Analysing dataset…</div>
              <div className="state-sub">Fetching EDA from server</div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="eda-root">
          <div className="eda-inner">
            <div className="state-card">
              <div className="state-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="state-title" style={{ color: "#f87171" }}>{error}</div>
              <div className="state-sub">Check that a dataset has been uploaded and trained.</div>
              <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => navigate("/")}>Go to Upload</button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <button className="hamburger-btn" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Toggle EDA index" title="Toggle EDA index">
        <span /><span /><span />
      </button>
      
      <div className="eda-root">
        <SidebarNav sections={navSections} activeSection={activeSection} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        <div className={`eda-content ${sidebarOpen ? "with-sidebar" : "no-sidebar"}`}>
          {expandedChart && (
            <ExpandOverlay title={expandedChart.title} onClose={closeExpanded}>
              {expandedChart.content}
            </ExpandOverlay>
          )}

          {/* -- Header -- */}
          <div className="page-header">
            <div>
              <div className="page-eyebrow">AutoML · Exploratory Data Analysis</div>
              <h1 className="page-title">
                EDA <span>Dashboard</span>
                {data.has_model && <span className="badge badge-green">● model ready</span>}
                {totalOutliers > 0 && <span className="badge badge-red">⚠ {totalOutliers} outliers</span>}
                {duplicateRows > 0 && <span className="badge badge-gold">⚠ {duplicateRows} dupes</span>}
              </h1>
            </div>
          </div>

          <EDAStatCards data={data} numericCols={numericCols} categoricalCols={categoricalCols} duplicateRows={duplicateRows} totalOutliers={totalOutliers} />

          <div className="eda-main-modular">
             <StatsSection 
                data={data} 
                colSearch={colSearch} setColSearch={setColSearch} 
                colTypeFilter={colTypeFilter} setColTypeFilter={setColTypeFilter} 
                filteredCols={filteredCols} 
                numericCols={numericCols} 
                categoricalCols={categoricalCols}
                summaryColNames={summaryColNames}
             />

             {data.has_model && trainRes && (
                <ModelScores scores={trainRes._scores} bestModel={trainRes.model_type} />
             )}

             <TargetSection 
                targetColumn={data.target_column} 
                targetDistribution={data.target_distribution || {}} 
                targetType={data.target_type} 
                categoricalTargetDistribution={data.categorical_target_distribution || {}}
                onCardExpand={openChart} 
             />

             <OutlierPanel outliers={data.outliers} numRows={data.num_rows} />
             <BoxPlotPanel boxPlots={data.box_plots} onCardExpand={openChart} />
             <MLReadinessPanel data={data} />
             
             <DistributionSection 
                histograms={data.histograms} 
                categorical={data.categorical} 
                numericCols={numericCols} 
                onCardExpand={openChart} 
             />

             <CorrelationSection 
                correlation={data.correlation} 
                scatterData={data.scatter_data} 
                selectedPair={selectedPair} 
                onSelectPair={setSelectedPair} 
                onCardExpand={openChart} 
             />

             {featureImportance.length > 0 && (
                <FeatureImportancePanel featureImportance={featureImportance} onCardExpand={openChart} />
             )}

             <MissingValuesPanel missingEntries={missingEntries} maxMissing={maxMissing} />
             
             <SummarySection data={data} summaryColNames={summaryColNames} datasetName={datasetName} />
          </div>

          {/* Action Row */}
          <div className="action-row">
            <button className="cta-btn" onClick={() => navigate("/predictor")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Run Predictor
            </button>
            {data.summary && summaryColNames.length > 0 && (
              <button className="ghost-btn" onClick={() => exportSummaryCSV(data.summary, summaryColNames, datasetName)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Summary CSV
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
