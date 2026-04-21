import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FeedbackForm from "./FeedbackForm";
import "./Layout.css"

// navigation items - each page gets a step number
const NAV_ITEMS = [
  { label: "Home",      path: "/",          step: "00" },
  { label: "Upload",    path: "/upload",    step: "01" },
  { label: "Results",   path: "/results",   step: "02" },
  { label: "EDA",       path: "/eda",       step: "03" },
  { label: "Predictor", path: "/predictor", step: "04" },
];

export default function Layout({ children }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen] = useState(false);

  // close the mobile drawer whenever we navigate
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // click outside to close drawer
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest(".nav-drawer") && !e.target.closest(".nav-hamburger")) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <>
      <nav className="layout-nav">
        {/* logo + hamburger */}
        <div className="nav-left">
          <div className="nav-wordmark" onClick={() => go("/")}>
            <div className="nav-logo-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span className="nav-wordmark-text">Auto<span>ML</span></span>
          </div>

          {/* hamburger for mobile */}
          <button
            className={`nav-hamburger${open ? " open" : ""}`}
            onClick={() => setOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>

        {/* desktop nav links */}
        <div className="nav-links">
          {NAV_ITEMS.map(({ label, path, step }) => (
            <div
              key={path}
              className={`nav-link${isActive(path) ? " active" : ""}`}
              onClick={() => go(path)}
            >
              <div className="nav-link-dot" />
              <span className="nav-link-step">{step}</span>
              {label}
            </div>
          ))}
        </div>
      </nav>

      {/* mobile slide-out drawer */}
      <div className={`nav-drawer${open ? " open" : ""}`}>
        {NAV_ITEMS.map(({ label, path, step }) => (
          <div
            key={path}
            className={`drawer-link${isActive(path) ? " active" : ""}`}
            onClick={() => go(path)}
          >
            <span className="nav-link-step">{step}</span>
            {label}
            <span className="drawer-step">{isActive(path) ? "current" : ""}</span>
          </div>
        ))}
      </div>

      <main className="layout-content">{children}</main>
      <FeedbackForm />
    </>
  );
}