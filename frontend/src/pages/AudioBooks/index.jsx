import { useState, useRef, useEffect } from "react";
import { API_BASE } from '../../api';
import { useLocation, useNavigate } from "react-router-dom";
import "./index.css";

export default function TranslatorSection() {
  const [text, setText] = useState("");
  const [translated, setTranslated] = useState("");
const fileInputRef = useRef(null);


  const location = useLocation();
  const navigate = useNavigate();

 const childLanguages = location.state?.childLanguages || [];
const parentLanguage = location.state?.parentLanguage || "English";
// Combine + remove duplicates
const availableLanguages = Array.from(
  new Set([...childLanguages, parentLanguage])
);

const [lang, setLang] = useState(
  availableLanguages[0] || "English"
);


  // NEW: detected input language
  const [detectedLang, setDetectedLang] = useState("English");

  // split loading flags so only relevant button shows working...
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const [explanation, setExplanation] = useState("");
  const [explainAudioUrl, setExplainAudioUrl] = useState(null);

  // books state and loader
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(false);

  const audioRef = useRef(null);

  // === Camera state & refs ===
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  // manual facing toggle (user/environment)
  const [facingMode, setFacingMode] = useState(() => {
    const w = window.innerWidth || document.documentElement.clientWidth;
    return w >= 1024 ? "user" : "environment";
  });

  // === Helpers ===
  const base64ToBlobUrl = (base64, mime = "audio/mpeg") => {
    try {
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("base64 to blob error:", e);
      return null;
    }
  };

  // NEW: detect language from text using Unicode script ranges (fast, client-side)
  const detectLanguageFromText = (inputText) => {
    if (!inputText || !inputText.trim()) return "English";

    // trim and pick a slice to be faster
    const sample = inputText.trim().slice(0, 400);

    // Unicode regexes for common Indian scripts + Latin
    const patterns = [
      { lang: "Hindi", re: /[\u0900-\u097F]/ }, // Devanagari (Hindi, Marathi, Nepali, etc.)
      { lang: "Telugu", re: /[\u0C00-\u0C7F]/ }, // Telugu
      { lang: "Tamil", re: /[\u0B80-\u0BFF]/ }, // Tamil
      { lang: "Kannada", re: /[\u0C80-\u0CFF]/ }, // Kannada
      { lang: "Malayalam", re: /[\u0D00-\u0D7F]/ }, // Malayalam
      // You can add more checks here if needed (e.g., Gujarati, Bengali, etc.)
    ];

    for (const p of patterns) {
      if (p.re.test(sample)) return p.lang;
    }

    const nonWhitespace = sample.replace(/\s/g, "");
    const asciiLetters = (nonWhitespace.match(/[A-Za-z]/g) || []).length;
    const nonAscii = nonWhitespace.length - asciiLetters;

    if (asciiLetters > Math.max(5, nonAscii)) return "English";
    return "English";
  };

  // === Book recommendations (only called after Analyze) ===
  const fetchRecommendedBooks = async (inputText) => {
    setBooksLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/recommend-books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, maxResults: 6 }),
      });
      const data = await res.json();
      setBooks(Array.isArray(data.result) ? data.result : []);
    } catch (err) {
      console.error("Books fetch error:", err);
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  };

  // === API wrappers ===
  // Analyze (image upload)
  const handleAnalyze = async () => {
    if (!file) {
      alert("Please choose an image to analyze.");
      return;
    }
    setAnalyzeLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/ai/analyze`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      // support both formats: { result: "text" } or { result: "text", books: [...] }
      const extracted = (data?.result) || "";
      setText(extracted);

      // NEW: detect language from extracted text
      const detected = detectLanguageFromText(extracted);
      setDetectedLang(detected);

      // If server returned books inline (Option B), use them.
      if (Array.isArray(data?.books) && data.books.length > 0) {
        setBooks(data.books);
      } else {
        // otherwise fetch recommended books using separate endpoint
        if (extracted && extracted.trim()) {
          fetchRecommendedBooks(extracted);
        } else {
          setBooks([]); // no text -> clear suggestions
        }
      }
    } catch (err) {
      console.error("Analyze error:", err);
      alert("Error analyzing image. See console.");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Translate (does NOT touch books)
  const handleTranslate = async () => {
    if (!text || !text.trim()) {
      alert("Please enter or analyze some text to translate.");
      return;
    }
    setTranslateLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang: lang }),
      });
      const data = await res.json();
      setTranslated(data.result || "");
      // DO NOT clear or overwrite `books`
    } catch (err) {
      console.error("Translate error:", err);
      alert("Translate failed. See console.");
    } finally {
      setTranslateLoading(false);
    }
  };

  // Explain (does NOT touch books)
  const handleExplain = async () => {
    if (!text || !text.trim()) {
      alert("Please enter or analyze some text first.");
      return;
    }
    setExplainLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, style: "story", targetLang: lang }),
      });
      const data = await res.json();

      if (data?.result) {
        const { text: explText = "", audio: audioBase64 = null } = data.result;
        setExplanation(explText);

        // cleanup previous audio url
        if (explainAudioUrl) {
          URL.revokeObjectURL(explainAudioUrl);
          setExplainAudioUrl(null);
        }

        if (audioBase64) {
          const url = base64ToBlobUrl(audioBase64, "audio/mpeg");
          if (url) {
            setExplainAudioUrl(url);
            try {
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
              }
              audioRef.current = new Audio(url);
              audioRef.current.play().catch((e) => console.warn("Autoplay blocked:", e));
            } catch (e) {
              console.warn("Audio play error after explain:", e);
            }
          }
        }
      } else {
        alert("No explanation returned from server.");
      }
    } catch (err) {
      console.error("Explain fetch error:", err);
      alert("Error generating explanation. Check console.");
    } finally {
      setExplainLoading(false);
    }
  };

  // === Play / Pause / Stop / Download Audio ===
  const playAudio = async (content) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      audioRef.current = new Audio(url);
      audioRef.current.play();
    } catch (err) {
      console.error("Audio play error:", err);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) audioRef.current.pause();
  };
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const downloadAudio = async (content, filename) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "tts_audio.mp3";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Audio download error:", err);
    }
  };

  // Clear everything (explicit user action)
  const clearAll = () => {
    setText("");
    setFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setTranslated("");
    setExplanation("");
    setBooks([]);
    setDetectedLang("English"); // reset detected language
    if (explainAudioUrl) {
      URL.revokeObjectURL(explainAudioUrl);
      setExplainAudioUrl(null);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // keep cleanup on unmount
  useEffect(() => {
    return () => {
      if (explainAudioUrl) URL.revokeObjectURL(explainAudioUrl);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (preview) URL.revokeObjectURL(preview);
      // stop camera stream if active on unmount
      if (streamRef.current) {
        try {
          streamRef.current.getTracks().forEach((t) => t.stop());
        } catch (e) {
          // ignore
        }
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NEW: when user types or pastes text, update detected language live
  const handleTextChange = (val) => {
    setText(val);
    const detected = detectLanguageFromText(val);
    setDetectedLang(detected);
    // don't clear books (user might want to keep suggestions)
    setTranslated("");
    setExplanation("");
  };

  /* ================= Camera functions ================= */
  // stop camera stream safely
  const stopCameraStream = () => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch (e) {
        // ignore
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch (e) {}
    }
  };

  // open camera with current facingMode
  const openCamera = async (mode = null) => {
    const chosen = mode || facingMode;
    const constraints = { video: { facingMode: { ideal: chosen }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      }
      setCameraOpen(true);
    } catch (err) {
      console.error("Camera open error:", err);
      alert("Unable to access camera. Make sure you've granted permission and that your site is served over HTTPS.");
    }
  };

  const closeCamera = () => {
    setCameraOpen(false);
    stopCameraStream();
  };

  // flip between user/environment while modal open
  const flipCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    stopCameraStream();
    setTimeout(() => openCamera(next), 200);
  };

  const captureFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    // mirror for user-facing cameras so captured image looks natural
    const facing = facingMode;
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // reset transform
    if (facing === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // convert to blob and set file + preview
    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Capture failed.');
        return;
      }
      const capturedFile = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      setFile(capturedFile);
      const url = URL.createObjectURL(blob);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(url);
      // clear text fields like when choosing image
      setText('');
      setTranslated('');
      setExplanation('');
      setDetectedLang('English');
      // stop camera after capture
      closeCamera();
    }, 'image/jpeg', 0.92);
  };

  /* ================= Render ================= */
  return (
    <div className="translator-container">
          <button
        className="back-btn"  style={{
    marginBottom: "12px",
    alignSelf: "flex-start"
  }}
        onClick={() => navigate("/practice", { state: location.state })}
      >
        Back
      </button>
      <h2 className="translator-title">Audio Books</h2>

      <div style={{ position: "relative" }}>
        <textarea
          className="translator-textarea"
          rows="6"
          placeholder="Paste text here or upload an image..."
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            minHeight: "140px",
            resize: "vertical",
            boxSizing: "border-box",
            background: "#fff",
          }}
        />

        {preview && (
          <div className="image-overlay" role="group" aria-label="Image preview">
            <img src={preview} alt="preview" style={{ width: 90, height: 66, objectFit: 'cover', borderRadius: 6 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button
                type="button"
                className="tiny-btn open"
                onClick={(e) => {
                  // open preview in a new tab (full view)
                  e.preventDefault();
                  if (preview) {
                    window.open(preview, "_blank");
                  }
                }}
                title="Open full view"
              >
                Open
              </button>
<button
  type="button"
  className="tiny-btn close"
  onClick={() => {
    setFile(null);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setBooks([]);

    // ⭐ IMPORTANT LINE
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }}
>
  ✖
</button>

            </div>
          </div>
        )}
      </div>

      <div className="controls-row" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: "12px", flexWrap: "wrap", padding: 0 }}>
        <div className="controls-left">
          <label className="translator-btn choose">
            📂 Choose Image
       <input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={(e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(selectedFile));

    setText("");
    setTranslated("");
    setExplanation("");
    setDetectedLang("English");
  }}
/>
          </label>

          {/* Camera open button (orange) */}
          <button onClick={() => openCamera()} className="translator-btn camera">📷 Camera</button>

          <button onClick={handleAnalyze} className="translator-btn analyze" disabled={analyzeLoading}>
            {analyzeLoading ? "Working..." : "📸 Analyze"}
          </button>
        </div>

        <div className="translator-controls">
 <label className="translator-label">Language:</label>

<select
  className="translator-select"
  value={lang}
  onChange={(e) => setLang(e.target.value)}
>
  {availableLanguages.map((language) => (
    <option key={language} value={language}>
      {language}
    </option>
  ))}
</select>


          {/* Translate + Explain side-by-side (explain next to translate) */}
          <button onClick={handleTranslate} className="translator-btn primary" disabled={translateLoading}>
            {translateLoading ? "Translating..." : " Translate"}
          </button>

          <button onClick={handleExplain} className="translator-btn explain" disabled={explainLoading}>
            {explainLoading ? "Working..." : "Explain"}
          </button>
        </div>

        <button onClick={clearAll} className="translator-btn danger">❌ Clear</button>
      </div>

      {/* Camera modal */}
      {cameraOpen && (
        <div className="camera-modal" role="dialog" aria-modal="true" aria-label="Camera capture">
          <div className="camera-inner">
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />

            <div className="camera-controls" style={{ justifyContent: "space-between" }}>
              {/* left side: Close and Flip (Close left-aligned) */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={closeCamera} className="translator-btn modal-close">✖ Close</button>
                <button onClick={flipCamera} className="translator-btn flip">🔁 Flip</button>
              </div>

              {/* right side: Capture */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={captureFromCamera} className="translator-btn capture">📸 Capture</button>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      )}

      {/* English Input */}
      {text && (
        <div className="translator-output">
          <h4>📝 Input ({detectedLang}):</h4>
          <p>{text}</p>
          <div>
            <button onClick={() => playAudio(text)} className="translator-btn play">▶️ Play</button>
            <button onClick={pauseAudio} className="translator-btn pause">⏸ Pause</button>
            <button onClick={stopAudio} className="translator-btn stop">⏹ Stop</button>
            <button onClick={() => downloadAudio(text, "Input_audio.mp3")} className="translator-btn download">⬇️ Download</button>
          </div>
        </div>
      )}

      {/* Translated Output */}
      {translated && (
        <div className="translator-output">
          <h4>🔄 Translated Output ({lang}):</h4>
          <p>{translated}</p>
          <div>
            <button onClick={() => playAudio(translated)} className="translator-btn play">▶️ Play</button>
            <button onClick={pauseAudio} className="translator-btn pause">⏸ Pause</button>
            <button onClick={stopAudio} className="translator-btn stop">⏹ Stop</button>
            <button onClick={() => downloadAudio(translated, `${lang}_translation.mp3`)} className="translator-btn download">⬇️ Download</button>
          </div>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div className="translator-output">
          <h4>💡 Explanation ({lang}):</h4>
          <p>{explanation}</p>
          <div>
            <button onClick={() => {
              if (explainAudioUrl) {
                if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
                audioRef.current = new Audio(explainAudioUrl);
                audioRef.current.play().catch((e) => console.warn(e));
              } else {
                playAudio(explanation);
              }
            }} className="translator-btn play">▶️ Play</button>

            <button onClick={pauseAudio} className="translator-btn pause">⏸ Pause</button>
            <button onClick={stopAudio} className="translator-btn stop">⏹ Stop</button>

            <button onClick={() => {
              if (explainAudioUrl) {
                const a = document.createElement("a");
                a.href = explainAudioUrl;
                a.download = `${lang}_explanation.mp3`;
                a.click();
              } else {
                downloadAudio(explanation, `${lang}_explanation.mp3`);
              }
            }} className="translator-btn download">⬇️ Download</button>
          </div>
        </div>
      )}

      {/* Book Recommendations */}
      <div style={{ marginTop: 16 }}>
        <h4>📚 Suggested Books</h4>
        {booksLoading && <p>Looking for relevant books...</p>}
        {!booksLoading && books.length === 0 && <p style={{ color: "#666" }}>No suggestions yet — analyze to get recommendations.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 8 }}>
          {books.map((b, i) => (
            <div key={i} style={{ border: "1px solid #e5e7eb", padding: 10, borderRadius: 8, background: "#fff", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <img src={b.thumbnail || "/book-placeholder.png"} alt={b.title} style={{ width: 64, height: 96, objectFit: "cover", borderRadius: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{b.title}</div>
                <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>{(b.authors || []).join(", ")}</div>
                <div style={{ fontSize: 12, color: "#666", height: 40, overflow: "hidden" }}>{b.description || ""}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  {b.infoLink && <a href={b.infoLink} target="_blank" rel="noreferrer" className="translator-btn play" style={{ padding: "6px 8px", fontSize: 13 }}>View</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}