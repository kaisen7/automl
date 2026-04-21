import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import EDA from "./pages/EDA";
import Predictor from "./pages/Predictor";

// main app - just sets up the routes
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/results" element={<Results />} />
        <Route path="/eda" element={<EDA />} />
        <Route path="/predictor" element={<Predictor />} />
      </Routes>
    </Router>
  );
}

export default App;