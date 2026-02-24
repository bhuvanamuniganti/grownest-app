import { useState } from "react";
import UploadSection from "./UploadSection";
import ClaimSection from "./ClaimSection";
import { useLocation, useNavigate } from "react-router-dom";
import "./index.css";

export default function SharingSection() {
  const [activeTab, setActiveTab] = useState(null);

  const navigate = useNavigate();    
  const location = useLocation();   

  // Upload Screen
  if (activeTab === "upload") {
    return (
      <div>
        <button
          className="back-btn"
          onClick={() => setActiveTab(null)}
        >
          ← Back
        </button>
        <UploadSection />
      </div>
    );
  }

  // Claim Screen
  if (activeTab === "claim") {
    return (
      <div>
        <button
          className="back-btn"
          onClick={() => setActiveTab(null)}
        >
          ← Back
        </button>
        <ClaimSection />
      </div>
    );
  }

  // Main Sharing Cards
  return (
    <div className="sharing-container">

        
            <button
        className="back-btn"  style={{
    marginBottom: "12px",
    alignSelf: "flex-start"
  }}
        onClick={() => navigate("/practice", { state: location.state })}
      >
        Back
      </button>
      <h2>Sharing Section</h2>

      <div className="card-wrapper">

        {/* Upload Card */}
        <div className="sharing-card">
          <div className="card-header">
            <h3>♻️Smart Contribution</h3>
          </div>

          <div className="card-image-wrapper">
            {/* Image from public folder */}
            <img src="/public/upload.png" alt="Upload" />
          </div>

          <div className="card-footer">
            <button onClick={() => setActiveTab("upload")}>
              📤Upload
            </button>
          </div>
        </div>

        {/* Claim Card */}
        <div className="sharing-card">
          <div className="card-header">
            <h3>🔄Knowledge Exchange</h3>
          </div>

          <div className="card-image-wrapper">
            {/* Image from public folder */}
            <img src="/public/recieve.png" alt="Receive" />
          </div>

          <div className="card-footer">
            <button onClick={() => setActiveTab("claim")}>
              📥Receive
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}