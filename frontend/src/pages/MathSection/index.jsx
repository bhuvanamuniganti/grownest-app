// src/sections/MathTutorSection.jsx
import { API_BASE } from "../../api";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

export default function MathTutorSection() {
  const [text, setText] = useState("");
  const [problemFile, setProblemFile] = useState(null);
  const [preview, setPreview] = useState(null);

  // Teacher pattern inputs + preview
  const [teacherPatternText, setTeacherPatternText] = useState("");
  const [teacherPatternFile, setTeacherPatternFile] = useState(null);
  const [teacherPatternPreview, setTeacherPatternPreview] = useState(null);

  // Separate outputs / loadings
  const [quickSolution, setQuickSolution] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);

  const [teacherSolution, setTeacherSolution] = useState("");
  const [teacherLoading, setTeacherLoading] = useState(false);

  const [altSolution, setAltSolution] = useState("");
  const [altLoading, setAltLoading] = useState(false);

  const [similar, setSimilar] = useState("");

  // camera modal states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState(null); // 'problem' or 'pattern'
  const cameraFacingRef = useRef("user"); // useRef instead of unused state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // file refs
  const fileInputRef = useRef(null);
  const patternFileRef = useRef(null);
  const mountedRef = useRef(true);

  const [chatInput, setChatInput] = useState("");
const [chatMessages, setChatMessages] = useState([]);
const [chatLoading, setChatLoading] = useState(false);

  const location = useLocation();
    const navigate = useNavigate();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (preview) URL.revokeObjectURL(preview);
      if (teacherPatternPreview) URL.revokeObjectURL(teacherPatternPreview);
      stopCameraStream();
    };
  }, [preview, teacherPatternPreview]);

  const startCamera = async (facing = "user") => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Camera not supported");
      const constraints = { video: { facingMode: facing } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      cameraFacingRef.current = facing;
    } catch (err) {
      console.error("Camera start error:", err);
      alert("⚠️ Unable to access camera: " + (err.message || err));
      setShowCamera(false);
    }
  };

  const stopCameraStream = () => {
    try {
      const s = streamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    } catch (err) {
      console.warn("Error stopping camera:", err);
    }
  };

  const openCameraModal = async (target = "problem", facing = "user") => {
    setCameraTarget(target);
    setShowCamera(true);
    // wait for modal to render, then start
    setTimeout(() => startCamera(facing), 50);
  };

  const closeCameraModal = () => {
    setShowCamera(false);
    stopCameraStream();
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("⚠️ Capture failed");
          resolve(null);
          return;
        }
        const fileName = `${cameraTarget || "capture"}_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: blob.type });
        if (cameraTarget === "problem") {
          if (preview) URL.revokeObjectURL(preview);
          setProblemFile(file);
          const url = URL.createObjectURL(file);
          setPreview(url);
        } else if (cameraTarget === "pattern") {
          if (teacherPatternPreview) URL.revokeObjectURL(teacherPatternPreview);
          setTeacherPatternFile(file);
          const url = URL.createObjectURL(file);
          setTeacherPatternPreview(url);
        }
        resolve(file);
      }, "image/jpeg", 0.92);
    });
  };

  // Reusable button (keeps animation)
  function AnimatedButton({ onClick, children, className = "", disabled = false, style = {} }) {
    const [anim, setAnim] = useState(false);
    const handle = async (e) => {
      if (disabled) return;
      setAnim(true);
      try {
        await onClick?.(e);
      } finally {
        setTimeout(() => setAnim(false), 160);
      }
    };
    const animStyle = anim ? { transform: "scale(0.98)", transition: "transform 140ms ease-out" } : { transform: "scale(1)", transition: "transform 160ms ease-out" };
    const disabledStyle = disabled ? { opacity: 0.55, cursor: "not-allowed" } : {};
    return (
      <button onClick={handle} disabled={disabled} className={`translator-btn ${className}`} style={{ ...animStyle, ...disabledStyle, ...style }}>
        {children}
      </button>
    );
  }

  const downloadPDF = (title, content) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const maxWidth = pageWidth - margin * 2;
    const wrappedText = doc.splitTextToSize(content, maxWidth);
    doc.setFontSize(12);
    doc.text(title, margin, 15);
    doc.text(wrappedText, margin, 30);
    doc.save(`${title}.pdf`);
  };

  // === Quick Solve (image OCR then math-tutor) ===
  const handleQuickSolve = async () => {
    if (!text.trim() && !problemFile) {
      alert("⚠️ Please enter a math problem or upload an image first.");
      return;
    }

    setQuickLoading(true);
    setQuickSolution("");

    try {
      let problemText = text?.trim();

      if (problemFile && !problemText) {
        const fd = new FormData();
        fd.append("file", problemFile);

        const r = await fetch(`${API_BASE}/api/learning/analyze-math`, {
          method: "POST",
          body: fd,
        });

        if (!r.ok) {
          const errTxt = await r.text().catch(() => "");
          throw new Error(`OCR failed: ${r.status} ${errTxt}`);
        }

        const ocrData = await r.json().catch(() => ({}));
        problemText = (ocrData && ocrData.result) ? ocrData.result.trim() : "";

        if (!problemText) {
          setQuickSolution("⚠️ OCR did not extract any problem text from the image.");
          return;
        }

        setText(problemText);
      }

      const tutorReq = {
        text: problemText,
        mode: "alternative",
        ...(teacherPatternText ? { teacherPattern: teacherPatternText } : {}),
      };

      const res = await fetch(`${API_BASE}/api/learning/math-tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tutorReq),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status}: ${errBody}`);
      }

      const data = await res.json().catch(() => ({}));
      setQuickSolution(data.result || "⚠️ No quick solution generated.");
      setTimeout(() => {
        const el = document.getElementById("quick-solution-anchor");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      console.error("❌ Quick solve failed:", err);
      setQuickSolution(`⚠️ Error generating quick solution: ${err?.message || err}`);
    } finally {
      setQuickLoading(false);
    }
  };

  // === Teacher-pattern OCR (extract text from uploaded pattern image) ===
  const analyzeTeacherPatternImage = async () => {
    if (!teacherPatternFile) return "";
    try {
      const formData = new FormData();
      formData.append("file", teacherPatternFile);
      const res = await fetch(`${API_BASE}/api/learning/analyze-math`, { method: "POST", body: formData });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        console.warn("Pattern OCR returned non-ok:", res.status, err);
        return "";
      }

      const data = await res.json().catch(() => ({}));
      const extracted = (data && data.result) ? String(data.result).trim() : "";
      if (extracted) {
        setTeacherPatternText((prev) => (prev ? `${prev}\n${extracted}`.trim() : extracted));
      }
      return extracted;
    } catch (err) {
      console.error("❌ Pattern OCR failed:", err);
      return "";
    }
  };

  // === Solve Teacher method (send pattern image if available + text) ===
  const handleSolveTeacher = async () => {
    if (!text.trim()) { alert("Enter or upload a math problem first."); return; }
    if (!teacherPatternText.trim() && !teacherPatternFile) { alert("Provide teacher pattern text or image."); return; }

    setTeacherLoading(true);
    setTeacherSolution("");
    try {
      // If a pattern image exists but no pattern text, OCR it first and update textarea
      if (teacherPatternFile && !teacherPatternText.trim()) {
        const extracted = await analyzeTeacherPatternImage();
        if (!extracted) {
          setTeacherSolution("⚠️ Could not extract teacher pattern text from the uploaded image. Please paste the pattern text or upload a clearer image.");
          setTeacherLoading(false);
          return;
        }
      }

      // If a pattern image exists, send multipart/form-data with file + text
      if (teacherPatternFile) {
        const formData = new FormData();
        formData.append("file", teacherPatternFile);
        formData.append("text", text.trim());
        formData.append("mode", "teacher");
        if (teacherPatternText.trim()) formData.append("teacherPattern", teacherPatternText.trim());

        const res = await fetch(`${API_BASE}/api/learning/math-tutor`, { method: "POST", body: formData });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(`Server returned ${res.status}: ${errBody}`);
        }
        const data = await res.json().catch(() => ({}));
        setTeacherSolution(data.result || "⚠️ No solution generated (teacher).");
      } else {
        // only text path
        const res = await fetch(`${API_BASE}/api/learning/math-tutor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), mode: "teacher", teacherPattern: teacherPatternText.trim() }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(`Server returned ${res.status}: ${errBody}`);
        }
        const data = await res.json().catch(() => ({}));
        setTeacherSolution(data.result || "⚠️ No solution generated (teacher).");
      }

      setTimeout(() => {
        const el = document.getElementById("teacher-solution-anchor");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      console.error("❌ Teacher solve failed:", err);
      setTeacherSolution(`⚠️ Error solving the problem (teacher): ${err?.message || err}`);
    } finally {
      setTeacherLoading(false);
    }
  };

  // === Solve Alternative method (separate) ===
  const handleSolveAlt = async () => {
    if (!text.trim()) { alert("Enter or upload a math problem first."); return; }

    setAltLoading(true);
    setAltSolution("");
    try {
      const res = await fetch(`${API_BASE}/api/learning/math-tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: "alternative", teacherPattern: teacherPatternText || undefined }),
      });
      const data = await res.json();
      setAltSolution(data.result || "⚠️ No alternative solution generated.");
      setTimeout(() => {
        const el = document.getElementById("alt-solution-anchor");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      console.error("❌ Alternative solve failed:", err);
      setAltSolution("⚠️ Error generating alternative method.");
    }
    setAltLoading(false);
  };

  // Helper to sanitize similar problems: remove trailing solution/answer blocks
  const sanitizeSimilarText = (raw) => {
    if (!raw) return "";
    const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    const cleaned = blocks.map((blk) => {
      const cutAt = blk.search(/\b(Solution|Answer|Ans|Explanation|Solution:|Answer:)\b/i);
      if (cutAt >= 0) return blk.slice(0, cutAt).trim();
      const lines = blk.split("\n");
      const filtered = [];
      for (const line of lines) {
        if (/^\s*(Solution|Answer|Ans|Explanation)\b/i.test(line)) break;
        filtered.push(line);
      }
      const candidate = filtered.join("\n").trim();
      if (!candidate) return blk.split("\n")[0].trim();
      return candidate;
    }).map(s => s.trim()).filter(Boolean);
    return cleaned.join("\n\n");
  };

  // Similar Questions
  const handleSimilar = async () => {
    if (!text.trim()) { alert("Enter or upload a math problem first."); return; }
    try {
      const res = await fetch(`${API_BASE}/api/learning/math-similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const raw = data.result || "";
      const cleaned = sanitizeSimilarText(raw);
      setSimilar(cleaned);
    } catch (err) {
      console.error("❌ Math similar fetch failed:", err);
      setSimilar("⚠️ Error generating similar questions.");
    }
  };

  const clearAll = () => {
    setText(""); setProblemFile(null);
    if (preview) { URL.revokeObjectURL(preview); setPreview(null); }
    setTeacherPatternFile(null); setTeacherPatternText(""); if (teacherPatternPreview) { URL.revokeObjectURL(teacherPatternPreview); setTeacherPatternPreview(null); }
    setQuickSolution(""); setTeacherSolution(""); setAltSolution(""); setSimilar("");
  };

  // file change handlers (single file only)
  const handleProblemFileChange = (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setProblemFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const removeProblemFile = () => {
  setProblemFile(null);

  if (preview) {
    URL.revokeObjectURL(preview);
    setPreview(null);
  }

  // ADD THIS LINE
  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }
};

  const handlePatternFileChange = (e) => {
    const f = e?.target?.files?.[0];
    if (!f) return;
    setTeacherPatternFile(f);
    if (teacherPatternPreview) URL.revokeObjectURL(teacherPatternPreview);
    setTeacherPatternPreview(URL.createObjectURL(f));
  };

  const removeTeacherPatternFile = () => {
  setTeacherPatternFile(null);

  if (teacherPatternPreview) {
    URL.revokeObjectURL(teacherPatternPreview);
    setTeacherPatternPreview(null);
  }

  // ADD THIS LINE
  if (patternFileRef.current) {
    patternFileRef.current.value = "";
  }
};

  // styles for distinctive buttons (can adjust hexs to taste)
  const styles = {
    upload: { background: "#2E8B57", color: "#fff" },
    analyze: { background: "#20B2AA", color: "#fff" },
    solve: { background: "#6a5acd", color: "#fff" },
    clear: { background: "#e74c3c", color: "#fff" },
    teacher: { background: "#1e90ff", color: "#fff" },
    alternative: { background: "#ff8c42", color: "#fff" },
    similarBtn: { background: "#16a085", color: "#fff" },
    download: { background: "#2e7d32", color: "#fff" },
  };

  return (
    <div className="translator-container" style={{ padding: 16 }}>
      <style>{`
        /* Responsive layout tweaks */
        .top-controls { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
        .file-column { display:flex; gap:12px; align-items:center; flex-wrap:wrap; width:100%; }
        .left-area { flex:1 1 320px; min-width:220px; }
        .right-area { flex: 0 0 auto; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
        .translator-textarea { width:100%; box-sizing:border-box; padding:10px; border-radius:8px; border:1px solid #ddd; resize:vertical; min-height:88px;}
        .translator-btn { padding:10px 14px; border-radius:10px; border: none; cursor:pointer; font-weight:600; box-shadow:0 6px 14px rgba(0,0,0,0.08); }
        .translator-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .ai-output { margin-top:16px; }
        .scroll-box { max-height:320px; overflow:auto; background:#fff; border-radius:8px; padding:12px; border:1px solid #eee; }
        .thumb-wrap { display:flex; gap:12px; align-items:flex-start; margin-top:8px; }
        .thumb-img { width:140px; height:100px; object-fit:cover; border-radius:6px; border:1px solid #ddd; cursor:pointer; }
        /* Camera inputs: show back camera on large screens, front camera on smaller */
        .camera-back-label, .camera-front-label { display:inline-flex; align-items:center; gap:8px; }
        .camera-front-label { display:none; }
        @media (max-width:1024px) {
          .camera-front-label{ display:inline-flex; }
          .camera-back-label{ display:none; }
        }
        @media (max-width:720px) {
          .right-area { width:100%; justify-content:flex-start; }
          .left-area { flex-basis: 100%; }
        }
        /* Camera modal styles */
        .camera-modal { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; }
        .camera-box { background:#fff; padding:12px; border-radius:10px; max-width:920px; width:100%; max-height:90vh; display:flex; flex-direction:column; gap:8px; }
        .camera-stage { flex:1; display:flex; align-items:center; justify-content:center; background:#000; border-radius:8px; overflow:hidden; }
        .camera-stage video { width:100%; height:100%; object-fit:cover; }
        .camera-controls { display:flex; gap:8px; justify-content:center; }
      `}</style>

            <button
        className="back-btn"  style={{
    marginBottom: "12px",
    alignSelf: "flex-start"
  }}
        onClick={() => navigate("/practice", { state: location.state })}
      >
        Back
      </button>

      <h2 className="translator-title" style={{ marginBottom: 12 }}>📐 Math Tutor</h2>

      {/* Problem textarea */}
      <div style={{ marginBottom: 12 }}>
        <textarea
          className="translator-textarea"
          rows="4"
          placeholder="Type a math problem (e.g., Solve 2x + 5 = 15)"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {/* Row: Upload | Camera (back/front) | Solve | Clear  (Solve placed beside Upload+Camera) */}
      <div className="top-controls" style={{ marginBottom: 12 }}>
        <div className="file-column left-area">

          {/* Hidden input for problem upload */}
          <input
            id="problem-upload"
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleProblemFileChange}
            ref={fileInputRef}
          />

          {/* Visible upload control (button that triggers the hidden input) */}
          <button
            type="button"
            className="translator-btn"
            title="Upload problem image"
            onClick={() => { try { fileInputRef.current && fileInputRef.current.click(); } catch (err) {} }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
            <span style={{ display: "inline-block", padding: "6px 8px", borderRadius: 6, ...styles.upload }}>
              📂 Upload Image
            </span>
          </button>

          {/* Camera controls now open in-app modal with live preview */}
          <button className="translator-btn camera-back-label" style={{ padding: "6px 8px", background: "#1976d2", color: "#fff" }} onClick={() => openCameraModal('problem', 'environment')}>📷 Camera</button>
          <button className="translator-btn camera-front-label" style={{ padding: "6px 8px", background: "#1976d2", color: "#fff" }} onClick={() => openCameraModal('problem', 'user')}>📷 Camera (Front)</button>

          <AnimatedButton onClick={handleQuickSolve} className="translator-btn" disabled={quickLoading} style={{ ...styles.solve }}>
            {quickLoading ? "Solving..." : "⚡ Quick Solve"}
          </AnimatedButton>

          <AnimatedButton onClick={clearAll} className="translator-btn" style={{ ...styles.clear }}>
            ❌ Clear
          </AnimatedButton>

          {/* Problem image thumbnail + controls */}
          {preview && (
            <div className="thumb-wrap" style={{ marginTop: 6 }}>
              <img src={preview} alt="problem preview" className="thumb-img" onClick={() => preview && window.open(preview)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={removeProblemFile} className="translator-btn" style={{ ...styles.clear, padding: "6px 8px" }}>Close</button>
                  <button onClick={() => preview && window.open(preview)} className="translator-btn" style={{ ...styles.upload, padding: "6px 8px" }}>Open</button>
                </div>
                <small style={{ color: "#666" }}>Uploaded problem image (click to view)</small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera modal */}
      {showCamera && (
        <div className="camera-modal">
          <div className="camera-box">
            <div className="camera-stage">
              <video ref={videoRef} autoPlay playsInline muted />
            </div>
            <div className="camera-controls">
              <button className="translator-btn" onClick={() => {
                const next = cameraFacingRef.current === 'user' ? 'environment' : 'user';
                stopCameraStream();
                startCamera(next);
                cameraFacingRef.current = next;
              }}>🔄 Switch</button>
              <button className="translator-btn" onClick={async () => { await captureFromCamera(); closeCameraModal(); }}>📸 Capture</button>
              <button className="translator-btn" onClick={() => closeCameraModal()}>✖ Close</button>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {/* Quick Solution area */}
      <div id="quick-solution-anchor" style={{ marginBottom: 14 }}>
        <div className="ai-output">
          <h4 style={{ margin: "6px 0 10px 0" }}>🔎 Quick Solution</h4>
          <div className="scroll-box" style={{ minHeight: 72 }}>
            {quickLoading ? <p>Solving…</p> : quickSolution ? quickSolution.split("\n").map((l, i) => <p key={i} style={{ margin: "6px 0" }}>{l}</p>) : <p style={{ color: "#999" }}>No quick solution yet. Use Quick Solve to get a fast solution (alternative method).</p>}
          </div>
          {quickSolution && <AnimatedButton onClick={() => downloadPDF("Quick Solution", quickSolution)} className="translator-btn" style={{ marginTop: 8, ...styles.download }}>⬇ Download Quick PDF</AnimatedButton>}
        </div>
      </div>

      {/* Teacher pattern section */}
      <div style={{ marginTop: 4 }}>
        <h4 style={{ marginBottom: 8 }}>📘 Teacher's Pattern (paste text or upload image)</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <textarea
            placeholder="Paste teacher's pattern steps here (optional)"
            rows="3"
            value={teacherPatternText}
            onChange={(e) => setTeacherPatternText(e.target.value)}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #ccc",
              minWidth: 160,
            }}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
            <input
              id="pattern-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePatternFileChange}
              ref={patternFileRef}
            />

            <button
              type="button"
              className="translator-btn"
              title="Upload pattern image"
              onClick={() => { try { patternFileRef.current && patternFileRef.current.click(); } catch (err) {} }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                background: "#2E8B57",
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 10,
                boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
                fontWeight: 600,
              }}
            >
              📂 Upload Pattern Image
            </button>

            <button className="translator-btn camera-back-label" style={{ padding: "8px 12px", borderRadius: 10, background: "#1976d2", color: "#fff", boxShadow: "0 6px 14px rgba(0,0,0,0.08)", fontWeight: 600 }} onClick={() => openCameraModal('pattern', 'environment')}>
              📷 Pattern Camera
            </button>
            

            {/* Preview */}
            {teacherPatternPreview && (
              <div style={{ marginTop: 6 }}>
                <img
                  src={teacherPatternPreview}
                  alt="pattern preview"
                  style={{
                    width: 140,
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    cursor: 'pointer'
                  }}
                  onClick={() => teacherPatternPreview && window.open(teacherPatternPreview)}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    onClick={removeTeacherPatternFile}
                    className="translator-btn"
                    style={{ ...styles.clear, padding: "6px 8px" }}
                  >
                    Close
                  </button>
                  <button
                    onClick={() => teacherPatternPreview && window.open(teacherPatternPreview)}
                    className="translator-btn"
                    style={{ ...styles.teacher, padding: "6px 8px" }}
                  >
                    Open
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
        <AnimatedButton onClick={handleSolveTeacher} className="translator-btn" disabled={teacherLoading} style={{ ...styles.teacher }}>
          {teacherLoading ? "Solving (teacher)..." : "Follow Teacher's Method"}
        </AnimatedButton>

        <AnimatedButton onClick={handleSolveAlt} className="translator-btn" disabled={altLoading} style={{ ...styles.alternative }}>
          {altLoading ? "Solving (alternative)..." : "Alternative Method"}
        </AnimatedButton>

        <AnimatedButton onClick={handleSimilar} className="translator-btn" style={{ ...styles.similarBtn }}>
          🔄 Similar Questions
        </AnimatedButton>
      </div>

      {/* Solutions & similar output */}
      <div id="teacher-solution-anchor" style={{ marginTop: 18 }}>
        <div className="ai-output">
          <h4>📊 Step-by-Step Solution (Teacher's Method)</h4>
          <div className="scroll-box" style={{ padding: 12, border: "1px solid #eee", borderRadius: 6, minHeight: 80 }}>
            {teacherLoading ? <p>Solving (teacher)...</p> : (teacherSolution ? teacherSolution.split("\n").map((l,i)=>(<p key={i}>{l}</p>)) : <p style={{ color: "#999" }}>⚠️ No teacher solution generated. Click "Follow Teacher's Method".</p>)}
          </div>
          {teacherSolution && <AnimatedButton onClick={() => downloadPDF("Math Solution (Teacher)", teacherSolution)} className="translator-btn" style={{ marginTop: 8, ...styles.download }}>⬇ Download Solution PDF</AnimatedButton>}
        </div>
      </div>




      <div id="alt-solution-anchor" style={{ marginTop: 18 }}>
        <div className="ai-output">
          <h4>🔁 Alternative Method</h4>
          <div className="scroll-box" style={{ padding: 12, border: "1px solid #eee", borderRadius: 6, minHeight: 80 }}>
            {altLoading ? <p>Solving (alternative)...</p> : (altSolution ? altSolution.split("\n").map((l,i)=>(<p key={i}>{l}</p>)) : <p style={{ color: "#999" }}>⚠️ No alternative solution generated. Click "Alternative Method".</p>)}
          </div>
          {altSolution && <AnimatedButton onClick={() => downloadPDF("Math Solution (Alternative)", altSolution)} className="translator-btn" style={{ marginTop: 8, ...styles.download }}>⬇ Download Alternative PDF</AnimatedButton>}
        </div>
      </div>

      {similar && (
        <div style={{ marginTop: 18 }}>
          <h4>🔄 Similar Practice Problems</h4>
          <div className="scroll-box" style={{ padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
            {similar.split("\n").map((line, i) => <p key={i}>{line}</p>)}
          </div>
          <AnimatedButton onClick={() => downloadPDF("Similar Questions", similar)} className="translator-btn" style={{ marginTop: 8, ...styles.download }}>⬇ Download Questions PDF</AnimatedButton>
        </div>
      )}
    </div>
  );
}