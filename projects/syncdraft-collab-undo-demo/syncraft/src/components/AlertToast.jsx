import { useState, useEffect } from "react";
import "./AlertToast.css";

// Individual Alert Toast Component
function AlertToast({ message, type = "success", duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: "✓",
    error: "⚠️",
    info: "ℹ️",
    warning: "⚠️"
  };

  return (
    <div className="alert-toast-overlay">
      <div className={`alert-toast alert-toast-${type}`}>
        <span className="alert-toast-icon">{icons[type]}</span>
        <span className="alert-toast-message">{message}</span>
        <button className="alert-toast-close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}

// Export the AlertToast component to be used in your main app
export default AlertToast;
