import React from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "./styles/Home.css";

export default function Home() {
  const navigate = useNavigate();

  // each card on the homepage
  const features = [
    {
      icon: "⚙️",
      title: "Automated ML",
      description:
        "Upload your data and select a target. AutoML evaluates multiple algorithms to choose and optimize the best performer for your task.",
      action: () => navigate("/upload"),
      buttonText: "Training Studio",
    },
    {
      icon: "📊",
      title: "Interactive EDA",
      description:
        "Deep-dive into dataset health with automated ML readiness scores, outlier detection, and correlation matrices to understand data patterns.",
      action: () => navigate("/eda"),
      buttonText: "Data Insights",
    },
    {
      icon: "📈",
      title: "Performance Metrics",
      description:
        "View champion model rankings, detailed test metrics, and feature importance mappings in a unified analytics dashboard.",
      action: () => navigate("/results"),
      buttonText: "Model Registry",
    },
    {
      icon: "🔮",
      title: "Live Predictor",
      description:
        "Deploy your model instantly. Input values manually or upload secondary CSVs to get real-time predictions with confidence scores.",
      action: () => navigate("/predictor"),
      buttonText: "Test Inference",
    },
  ];

  return (
    <Layout>
      <div className="home-root">
        {/* hero section */}
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">
              Automated Machine Learning, <span>Simplified</span>
            </h1>
            <p className="hero-subtitle">
              Upload your data, and AutoML handles the rest. Train models, explore
              patterns, and make predictions—all without deep ML expertise.
            </p>
            <button
              onClick={() => navigate("/upload")}
              className="hero-cta"
            >
              Start Training Now
            </button>
          </div>
        </section>

        {/* feature cards */}
        <section className="features-grid">
          {features.map((feat, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon">{feat.icon}</div>
              <h3 className="feature-title">{feat.title}</h3>
              <p className="feature-description">{feat.description}</p>
              <button
                className={`feature-button${feat.disabled ? " disabled" : ""}`}
                onClick={feat.action}
                disabled={feat.disabled}
              >
                {feat.buttonText}
                {feat.disabled && (
                  <span className="disabled-reason">{feat.disabledReason}</span>
                )}
              </button>
            </div>
          ))}
        </section>

        {/* how it works */}
        <section className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-title">Upload Your Data</div>
              <p>Import a CSV file or choose from our sample datasets to get started quickly.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-title">Select Target Column</div>
              <p>Choose the column you want to predict (classification or regression).</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-title">AutoML Trains</div>
              <p>Our system automatically selects and trains the best algorithm for your task.</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <div className="step-title">Analyze & Predict</div>
              <p>View metrics, explore your data, and make predictions on new instances.</p>
            </div>
          </div>
        </section>

        {/* capabilities list */}
        <section className="capabilities">
          <h2>Capabilities</h2>
          <ul className="capabilities-list">
            <li>✓ Automatic algorithm selection (Random Forest, Gradient Boosting, Linear Regression, etc.)</li>
            <li>✓ Built-in feature preprocessing & scaling</li>
            <li>✓ Cross-validation and performance metrics</li>
            <li>✓ Feature importance & correlation analysis</li>
            <li>✓ Outlier detection with IQR method</li>
            <li>✓ Support for categorical and numeric data</li>
            <li>✓ Session-scoped model storage</li>
            <li>✓ Real-time predictions on new data</li>
          </ul>
        </section>

        {/* bottom cta */}
        <section className="final-cta">
          <h2>Ready to Build Your Model?</h2>
          <p>No machine learning experience required. Start with one click.</p>
          <button
            onClick={() => navigate("/upload")}
            className="final-cta-button"
          >
            Begin Now
          </button>
        </section>
      </div>
    </Layout>
  );
}
