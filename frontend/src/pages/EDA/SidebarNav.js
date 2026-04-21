import React from "react";

const SidebarNav = ({
  sections,
  activeSection,
  sidebarOpen,
  setSidebarOpen,
}) => {
  return (
    <>
      {sidebarOpen && (
        <div className="eda-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`eda-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="eda-sidebar-header">
          <span>Navigation</span>
          <button
            className="eda-sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="eda-sidebar-body">
          {sections.map((section) => (
            <button
              key={section.id}
              className={`eda-sidebar-link ${
                activeSection === section.id ? "active" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById(section.id);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
};

export default SidebarNav;
