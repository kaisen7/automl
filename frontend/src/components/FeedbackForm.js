import React, { useState } from "react";
import axios from "axios";
import API from "../api";
import "./FeedbackForm.css";

export default function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", query: "" });
  const [status, setStatus] = useState("idle"); // idle, submitting, success, error
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.query) {
      setStatus("error");
      setMessage("Please fill in all fields.");
      return;
    }

    setStatus("submitting");
    try {
      await axios.post(`${API}/feedback`, formData);
      setStatus("success");
      setMessage("Feedback sent! Thank you.");
      setFormData({ name: "", email: "", query: "" });
      setTimeout(() => {
        setIsOpen(false);
        setStatus("idle");
      }, 3000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Failed to send feedback. Please try again later.");
    }
  };

  return (
    <div className={`feedback-container ${isOpen ? "open" : ""}`}>
      {/* Floating Toggle Button */}
      <button 
        className="feedback-toggle" 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Feedback"
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Feedback Card */}
      {isOpen && (
        <div className="feedback-card">
          <div className="feedback-header">
            <h3>Feed<span>back</span></h3>
            <p>Help us improve your experience</p>
          </div>
          
          <form onSubmit={handleSubmit} className="feedback-form">
            <div className="input-field">
              <label htmlFor="fb-name">Name</label>
              <input 
                id="fb-name"
                name="name" 
                type="text" 
                placeholder="Your name" 
                value={formData.name} 
                onChange={handleChange}
                disabled={status === "submitting"}
              />
            </div>
            
            <div className="input-field">
              <label htmlFor="fb-email">Email</label>
              <input 
                id="fb-email"
                name="email" 
                type="email" 
                placeholder="your@email.com" 
                value={formData.email} 
                onChange={handleChange}
                disabled={status === "submitting"}
              />
            </div>
            
            <div className="input-field">
              <label htmlFor="fb-query">Query</label>
              <textarea 
                id="fb-query"
                name="query" 
                rows="4" 
                placeholder="What's on your mind?" 
                value={formData.query} 
                onChange={handleChange}
                disabled={status === "submitting"}
              />
            </div>

            {status === "error" && <div className="fb-error">{message}</div>}
            {status === "success" && <div className="fb-success">{message}</div>}

            <button 
              type="submit" 
              className={`fb-submit ${status}`}
              disabled={status === "submitting"}
            >
              {status === "submitting" ? <div className="fb-spinner" /> : "Send Feedback"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}