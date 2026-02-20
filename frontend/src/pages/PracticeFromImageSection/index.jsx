import { useEffect, useRef, useState } from "react";
import { API_BASE } from '../../api';
import { useLocation, useNavigate } from "react-router-dom";


function OralRecorder({ onFinalBlob }) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);

  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  const audioUrlRef = useRef(null);
  const audioElRef = useRef(null);

  async function initAudio() {
    if (streamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    sourceRef.current = src;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    analyserRef.current = analyser;
    drawWave();
  }

  function drawWave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const analyser = analyserRef.current;
    const ctx2d = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const loop = () => {
      analyser.getByteTimeDomainData(dataArray);
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.fillStyle = "#f8fafc";
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      ctx2d.strokeStyle = "#e5e7eb";
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, canvas.height / 2);
      ctx2d.lineTo(canvas.width, canvas.height / 2);
      ctx2d.stroke();

      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = recording ? "#16a34a" : paused ? "#f59e0b" : "#64748b";
      ctx2d.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }
      ctx2d.stroke();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }

  function preferredMime() {
    if (typeof MediaRecorder === "undefined") return "";
    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) return "audio/ogg;codecs=opus";
    return "";
  }

  function makeRecorder(stream) {
    const mime = preferredMime();
    try {
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        const mimeType = preferredMime() || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        try {
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        } catch {}
        audioUrlRef.current = URL.createObjectURL(blob);
        if (audioElRef.current) audioElRef.current.src = audioUrlRef.current;
        // final blob callback
        onFinalBlob?.(blob);
      };

      // optional: handle pause/resume events if needed
      return rec;
    } catch (err) {
      console.error("MediaRecorder creation failed", err);
      return null;
    }
  }

  async function start() {
    chunksRef.current = [];
    try {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    } catch {}
    if (!streamRef.current) await initAudio();
    const rec = makeRecorder(streamRef.current);
    if (!rec) {
      alert("Recording not supported in this browser");
      return;
    }
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setPaused(false);
  }

  function pause() {
    try {
      if (recRef.current && recRef.current.state === "recording") {
        recRef.current.pause();
        setRecording(false);
        setPaused(true);
      }
    } catch (e) {
      console.warn("Pause failed", e);
    }
  }

  function resume() {
    try {
      if (recRef.current && recRef.current.state === "paused") {
        recRef.current.resume();
        setRecording(true);
        setPaused(false);
        return;
      }
      // if recorder isn't available (edge cases), create a new one but this is fallback
      if (!streamRef.current) initAudio().then(() => {
        const rec = makeRecorder(streamRef.current);
        recRef.current = rec;
        rec.start();
        setRecording(true);
        setPaused(false);
      });
    } catch (e) {
      console.warn("Resume failed", e);
    }
  }

  function stop() {
    try {
      if (recRef.current && (recRef.current.state === "recording" || recRef.current.state === "paused")) {
        recRef.current.stop();
      }
    } catch (e) {
      console.warn("Stop failed", e);
    } finally {
      setRecording(false);
      setPaused(false);
      recRef.current = null;
      // keep stream open so user can record again without re-requesting mic permission
    }
  }

  function clearAll() {
    setRecording(false);
    setPaused(false);
    try {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    } catch {}
    chunksRef.current = [];
    if (audioElRef.current) audioElRef.current.src = "";
    onFinalBlob?.(null);
  }

  useEffect(() => {
    return () => {
      try {
        cancelAnimationFrame(rafRef.current);
        audioCtxRef.current?.close();
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      } catch {}
    };
  }, []);

  function AnimatedButton({ children, onClick, style, disabled }) {
    const [pressed, setPressed] = useState(false);
    const [animClass, setAnimClass] = useState(false);
    const base = {
      borderRadius: 8,
      padding: "8px 12px",
      fontWeight: 700,
      color: "#fff",
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      userSelect: "none",
      transition: "transform 140ms cubic-bezier(.2,.9,.3,1), box-shadow 160ms ease, opacity 120ms ease",
      transform: pressed ? "translateY(-3px) scale(0.98)" : "translateY(0) scale(1)",
      boxShadow: pressed ? "0 8px 20px rgba(0,0,0,0.12)" : "0 6px 18px rgba(0,0,0,0.06)",
      outline: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    };
    function handleClick(e) {
      if (disabled) return;
      setAnimClass(true);
      setTimeout(() => setAnimClass(false), 220);
      onClick?.(e);
    }
    return (
      <button
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onClick={handleClick}
        style={{ ...base, ...style }}
        disabled={disabled}
        className={animClass ? "btn-pop" : ""}
      >
        {children}
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, background: "#fff" }}>
      <canvas ref={canvasRef} width={560} height={110} style={{ width: "100%", height: 110 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {!recording && !paused && <AnimatedButton onClick={start} style={{ background: "#16a34a" }}>▶ Start</AnimatedButton>}
        {recording && <AnimatedButton onClick={pause} style={{ background: "#f59e0b" }}>⏸ Pause</AnimatedButton>}
        {!recording && paused && <AnimatedButton onClick={resume} style={{ background: "#0ea5e9" }}>⏯ Resume</AnimatedButton>}
        {(recording || paused) && <AnimatedButton onClick={stop} style={{ background: "#1f2937" }}>⏹ Stop</AnimatedButton>}
        <AnimatedButton onClick={clearAll} style={{ background: "#ef4444" }}>❌ Delete</AnimatedButton>
      </div>
      <div style={{ marginTop: 8 }}>
        <audio ref={audioElRef} controls style={{ width: "100%" }} />
      </div>
    </div>
  );
}


export default function PracticeFromImageSection() {
  console.log("API_BASE:", API_BASE);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);
  
  const location = useLocation();
    const navigate = useNavigate();

  const [payload, setPayload] = useState(null); 
  const [mode, setMode] = useState("written"); // "written" | "oral"

  const [textInput, setTextInput] = useState("");

  const [writtenAnswers, setWrittenAnswers] = useState({});
  const [oralText, setOralText] = useState({});
  const [oralBlob, setOralBlob] = useState({});

  const [gradeMapWritten, setGradeMapWritten] = useState({});
  const [gradeMapOral, setGradeMapOral] = useState({});

  // New pronunciation / evaluation state
  const [pronLoading, setPronLoading] = useState(false);
  const [pronFeedbackMap, setPronFeedbackMap] = useState({}); // stores full feedback for each q.id
   
  useEffect(() => {
    return () => {
      try {
        if (preview) URL.revokeObjectURL(preview);
      } catch {}
    };
  }, [preview]);

  function resetAll() {
    if (preview) try {
      URL.revokeObjectURL(preview);
    } catch (e) {}
    setFile(null); setPreview(null);
    setPayload(null); setMode("written");
    setTextInput("");
    setWrittenAnswers({}); setOralText({}); setOralBlob({});
    setGradeMapWritten({}); setGradeMapOral({});
    // reset pron states
    setPronFeedbackMap({});
    setPronLoading(false);
  }

  function switchMode(next) {
    setMode(next);
    setGradeMapWritten({}); setGradeMapOral({}); setPronFeedbackMap({});
  }

  function onBlobCapture(qid, blob) { setOralBlob(prev => ({ ...prev, [qid]: blob || null })); }

  // Simple client-side Q&A generator (fallback)
  function generateQAFromText(text, maxQuestions = 6) {
    if (!text) return { source_text: text, questions: [] };
    // split into sentences and take first meaningful ones
    const sents = text.replace(/\n+/g, " ").split(/(?<=[.?!])\s+/).map(s => s.trim()).filter(Boolean);
    const q = [];
    let idCounter = 1;
    for (let i = 0; i < sents.length && q.length < maxQuestions; i++) {
      const sentence = sents[i];
      // create a simple short Q/A: ask to summarize or ask "What is ... ?"
      const question = sentence.length < 60 ? `Explain: ${sentence}` : `Summarize: ${sentence.substring(0, 80)}...`;
      q.push({
        id: `${Date.now()}-${idCounter++}`,
        question,
        answer: sentence,
        type: "short",
        options: null,
      });
    }
    // if not enough sentences, split by clause
    if (q.length === 0 && text.length) {
      q.push({ id: `${Date.now()}-1`, question: "Summarize the given passage.", answer: text.slice(0, 400), type: "short" });
    }
    return { source_text: text, questions: q };
  }

  async function analyze() {
    if (!file && !textInput.trim()) {
      alert("Please paste text or upload an image.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file, file.name);
      if (textInput.trim()) form.append("text", textInput.trim());

      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // update this URL to your deployed backend if needed
      const res = await fetch(`${API_BASE}/api/practice-image/analyze`, {
        method: "POST",
        body: form,
        headers,
        credentials: "include",
      });

      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("text/html")) {
        const text = await res.text().catch(() => "");
        console.error("Server returned HTML when expecting JSON:", text);
        alert("Analyze failed: the request returned an HTML error page (likely you hit the front-end dev server). Check the request URL / proxy / backend mount.");
        return;
      }

      const raw = await res.text().catch(() => "");
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }

      if (!res.ok) {
        console.error("Analyze failed body:", raw);
        const msg = data?.error || data?.message || raw || `Analyze failed (${res.status})`;
        alert(msg);
        return;
      }

      let parsed = data || null;

      // If server did not return questions, fallback to client-side generator
      if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        const source = parsed?.source_text || textInput || (file ? "(image uploaded)" : "");
        const qa = generateQAFromText(source, 8);
        parsed = { ...parsed, ...qa };
      }

      if (Array.isArray(parsed.questions) && parsed.questions.length) {
        setPayload(parsed);
        setWrittenAnswers({}); setOralText({}); setOralBlob({});
        setGradeMapWritten({}); setGradeMapOral({});
        setPronFeedbackMap({});
      } else {
        alert("Could not create questions from the provided input.");
      }
    } catch (err) {
      console.error("Analyze error:", err);
      alert("Analyze failed: network error or server error. Check backend logs and DevTools Network.");
    } finally {
      setLoading(false);
    }
  }

  async function transcribeOne(qid) {
    const blob = oralBlob[qid];
    if (!blob) { alert("Please record your answer first."); return; }
    const form = new FormData();
    // keep filename and mime consistent
    form.append("audio", new File([blob], "answer.webm", { type: blob.type || "audio/webm" }));
    const r = await fetch(`${API_BASE}/api/practice-image/transcribe`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Transcribe failed:", r.status, txt);
      alert("Transcription failed. Check backend logs and that the server accepts 'audio/webm'.");
      return;
    }
    const data = await r.json();
    const text = data?.text || "";
    setOralText(prev => ({ ...prev, [qid]: text }));
  }

  // --- New helpers for pronunciation evaluation (paste after transcribeOne) ---

  // Play correct pronunciation via your existing TTS endpoint
  async function playCorrectPronunciation(text) {
    if (!text) return;
    try {
      const res = await fetch(`${API_BASE}/api/learning/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.play();
      a.onended = () => { try { URL.revokeObjectURL(url); } catch (e) {} };
    } catch (err) {
      console.error("playCorrectPronunciation error", err);
    }
  }

  // Levenshtein distance (used by client-side fallback)
  function levenshtein(a = "", b = "") {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  // simple client-side per-word feedback (fallback)
  function clientSidePronFeedback(expectedText = "", spokenText = "") {
    const normalize = s => (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, "").trim();
    const expWords = normalize(expectedText).split(/\s+/).filter(Boolean);
    const spWords = normalize(spokenText).split(/\s+/).filter(Boolean);
    const words = [];
    let correct = 0;
    for (let i = 0; i < expWords.length; i++) {
      const e = expWords[i];
      const s = spWords[i] || "";
      const dist = levenshtein(e, s);
      const norm = e.length ? dist / e.length : 1;
      const mis = norm > 0.34; // threshold — tweak if needed
      if (!mis) correct++;
      words.push({
        index: i,
        expected: e,
        spoken: s,
        mispronounced: mis,
        suggestion: mis ? `Try saying: ${e}` : null,
        playText: e,
        confidence: mis ? Math.round((1 - norm) * 100) : 100
      });
    }
    const overallScore = Math.round((correct / Math.max(1, expWords.length)) * 100);
    return { overallScore, feedback: `${correct} of ${expWords.length} words OK`, words };
  }

  // Tries server-side pronunciation API first; falls back to client-side evaluation
  async function evaluatePronunciationOne(q) {
    const qid = q.id;
    const blob = oralBlob[qid];
    if (!blob) { alert("Please record your answer first."); return; }

    setPronLoading(true);
    try {
      // try server pronunciation endpoint (if available)
      const form = new FormData();
      form.append("audio", new File([blob], "answer.webm", { type: blob.type || "audio/webm" }));
      form.append("expected", q.answer || q.question || "");
      const r = await fetch(`${API_BASE}/api/practice-image/pronunciation`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (r.ok) {
        const data = await r.json();
        // expected server shape: { overallScore, feedback, words: [ {expected, spoken, mispronounced, playText, suggestion } ] }
        setPronFeedbackMap(prev => ({ ...prev, [qid]: data }));
        setPronLoading(false);
        return;
      } else {
        console.warn("Pron API not available or returned error; falling back to client-side");
      }
    } catch (err) {
      console.warn("Pron API error, using fallback:", err);
    }

    // fallback: transcribe if not yet transcribed, then evaluate client-side
    let transcript = oralText[qid] || "";
    if (!transcript) {
      await transcribeOne(qid);
      transcript = oralText[qid] || "";
    }
    const fb = clientSidePronFeedback(q.answer || q.question || "", transcript);
    setPronFeedbackMap(prev => ({ ...prev, [qid]: fb }));
    setPronLoading(false);
  }

  // --- end pronunciation helpers ---

  async function gradeWrittenAll() {
    if (!payload) return;
    const userAnswers = payload.questions.map(q => ({ id: q.id, value: writtenAnswers[q.id] || "" }));
    const r = await fetch(`${API_BASE}/api/practice-image/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ questions: payload.questions, userAnswers }),
    });
    const g = await r.json();
    const byId = {};
    (g.results || []).forEach(res => { if (res?.id != null) byId[res.id] = res; });
    setGradeMapWritten(byId);
  }

  async function gradeOralOne(q) {
    const transcript = oralText[q.id] || "";
    if (!transcript) { alert("Please transcribe or type your answer first."); return; }
    const r = await fetch(`${API_BASE}/api/practice/oral-grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ question: q.question, transcript, expected: q.answer }),
    });
    const g = await r.json();
    setGradeMapOral(prev => ({ ...prev, [q.id]: g }));
  }

  async function gradeOralAll() {
    if (!payload) return;
    for (const q of payload.questions) {
      if (!oralText[q.id] && oralBlob[q.id]) { await transcribeOne(q.id); }
    }
    setTimeout(async () => {
      for (const q of payload.questions) {
        if (oralText[q.id]) await gradeOralOne(q);
      }
    }, 200);
  }

  async function generateSimilar() {
    if (!payload) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/practice-image/similar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseText: payload.source_text || "",
          prevQuestions: payload.questions.map(q => ({ question: q.question, answer: q.answer, type: q.type, options: q.options })),
          count: 10,
        }),
      });
      const data = await r.json();
      if (Array.isArray(data?.questions) && data.questions.length) {
        setPayload(data); setWrittenAnswers({}); setOralText({}); setOralBlob({});
        setGradeMapWritten({}); setGradeMapOral({}); setPronFeedbackMap({});
      } else {
        alert("Could not generate a similar set.");
      }
    } catch (err) {
      console.error("Similar generation error:", err);
      alert("Similar generation failed. Check server or network.");
    } finally {
      setLoading(false);
    }
  }

  // Print a clean question paper (no answers)
  function printQuestionPaper() {
    if (!payload) return alert("No questions to print");
    const w = window.open("", "_blank", "width=900,height=800");
    if (!w) return alert("Popup blocked");
    const html = `
      <html><head><title>Question Paper</title>
      <style>
        body{font-family: Arial, sans-serif; padding: 24px; color:#111}
        h1{font-size:20px}
        .q{margin:18px 0; padding:12px; border-bottom:1px dashed #ddd}
        .num{font-weight:800; margin-right:8px}
      </style></head><body>
      <h1>Question Paper</h1>
      ${payload.questions.map((q, idx) => `<div class="q"><span class="num">${idx+1}.</span> ${escapeHtml(q.question)}</div>`).join("")}
      <script>window.onload=()=>setTimeout(()=>{window.print();},200);</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  // Print question paper with answers (for teacher)
  function printQuestionPaperWithAnswers() {
    if (!payload) return alert("No questions to print");
    const w = window.open("", "_blank", "width=900,height=800");
    if (!w) return alert("Popup blocked");
    const html = `
      <html><head><title>Question Paper & Answers</title>
      <style>
        body{font-family: Arial, sans-serif; padding:24px; color:#111}
        h1{font-size:20px}
        .q{margin:18px 0; padding:12px; border-bottom:1px dashed #ddd}
        .num{font-weight:800; margin-right:8px}
        .ans{margin-top:8px; color:#064e3b}
      </style></head><body>
      <h1>Question Paper — Answers</h1>
      ${payload.questions.map((q, idx) => `<div class="q"><div><span class="num">${idx+1}.</span> ${escapeHtml(q.question)}</div><div class="ans"><strong>Answer:</strong> ${escapeHtml(q.answer || "—")}</div></div>`).join("")}
      <script>window.onload=()=>setTimeout(()=>{window.print();},200);</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  // small helper to avoid XSS in print windows
  function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  function AnimatedButton({ children, onClick, style, disabled }) {
    const [pressed, setPressed] = useState(false);
    const [animClass, setAnimClass] = useState(false);
    const base = {
      borderRadius: 8,
      padding: "10px 16px",
      fontWeight: 700,
      color: "#fff",
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      userSelect: "none",
      transition: "transform 140ms cubic-bezier(.2,.9,.3,1), box-shadow 160ms ease, opacity 120ms ease",
      transform: pressed ? "translateY(-3px) scale(0.98)" : "translateY(0) scale(1)",
      boxShadow: pressed ? "0 8px 20px rgba(0,0,0,0.12)" : "0 6px 18px rgba(0,0,0,0.06)",
      outline: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    };
    function handleClick(e) {
      if (disabled) return;
      setAnimClass(true);
      setTimeout(() => setAnimClass(false), 220);
      onClick?.(e);
    }
    return (
      <button
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onClick={handleClick}
        style={{ ...base, ...style }}
        disabled={disabled}
        className={animClass ? "btn-pop" : ""}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="glass" style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      
            <button
        className="back-btn"  style={{
    marginBottom: "12px",
    alignSelf: "flex-start"
  }}
        onClick={() => navigate("/practice", { state: location.state })}
      >
        Back
      </button>
      <h2>📝 Practice from Text or Image — Written & Oral</h2>
      <p>Paste text or upload a picture. We extract questions (answers hidden). You can take a written or oral test. Use Print to get a question paper (no answers).</p>

      {/* Upload / Analyze */}
      {!payload && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, alignItems: "start" }}>
            <div style={{ position: "relative" }}>
              <textarea
                rows={6}
                placeholder="✍️ Paste your text here (optional if you upload an image)…"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  boxSizing: "border-box",
                  minHeight: 140,
                  resize: "vertical",
                  background: "#fff",
                }}
              />

              <div style={{
                position: "absolute",
                left: 14,
                bottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
                padding: 8,
                boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                minWidth: 120,
                maxWidth: 300
              }}>
                {preview ? (
                  <>
                    <img src={preview} alt="preview" style={{ width: 90, height: 66, objectFit: "cover", borderRadius: 6 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 80 }}>
                      <div style={{ fontSize: 13, color: "#111827", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {file?.name || "Selected image"}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <AnimatedButton onClick={() => { try { if (preview) URL.revokeObjectURL(preview); } catch (e) {} setPreview(null); setFile(null); }} style={{ background: "#ef4444", padding: "6px 8px" }}>
                          ✕
                        </AnimatedButton>
                        <AnimatedButton onClick={() => fileInputRef.current?.click()} style={{ background: "#3b82f6", padding: "6px 8px" }}>
                          ↺
                        </AnimatedButton>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>Preview (bottom-left)</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                ref={fileInputRef}
                id="imgUp"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (preview) try { URL.revokeObjectURL(preview); } catch (e) {}
                    setFile(f);
                    setPreview(URL.createObjectURL(f));
                  }
                }}
                style={{ display: "none" }}
              />
              <AnimatedButton onClick={() => fileInputRef.current?.click()} style={{ background: "#3b82f6" }}>
                📂 Choose Image
              </AnimatedButton>

              <div style={{ color: file ? "#111827" : "#6b7280", fontWeight: 600 }}>
                {file ? file.name : "Image optional"}
              </div>

              <AnimatedButton disabled={loading} onClick={analyze} style={{ background: "#10b981" }}>
                {loading ? "Analyzing…" : "Analyze & Create Test"}
              </AnimatedButton>

              {(file || textInput) && (<AnimatedButton onClick={resetAll} style={{ background: "#ef4444" }}>Clear</AnimatedButton>)}
            </div>
          </div>
        </>
      )}

      {/* Test UI */}
      {payload && (
        <>
          <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>Mode:</span>
              <button onClick={() => switchMode("written")} style={{ background: mode === "written" ? "#2563eb" : "#e5e7eb", color: mode === "written" ? "#fff" : "#111827", borderRadius: 8, padding: "8px 14px", fontWeight: 700 }}>✍️ Written</button>
              <button onClick={() => switchMode("oral")} style={{ background: mode === "oral" ? "#14b8a6" : "#e5e7eb", color: mode === "oral" ? "#fff" : "#111827", borderRadius: 8, padding: "8px 14px", fontWeight: 700 }}>🎙️ Oral</button>
              <div style={{ flex: 1 }} />
              <AnimatedButton onClick={generateSimilar} style={{ background: "#8b5cf6" }}>🔄 Generate Similar Questions</AnimatedButton>
              <AnimatedButton onClick={printQuestionPaper} style={{ background: "#0ea5e9" }}>🖨️ Print Paper</AnimatedButton>
              <AnimatedButton onClick={printQuestionPaperWithAnswers} style={{ background: "#f97316" }}>🖨️ Print With Answers</AnimatedButton>
              <AnimatedButton onClick={resetAll} style={{ background: "#6b7280" }}>Start Over</AnimatedButton>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            {payload.questions.map((q, idx) => {
              const graded = mode === "written" ? gradeMapWritten[q.id] : gradeMapOral[q.id];
              return (
                <div key={q.id} className="card glass" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{idx + 1}. {q.question}</div>

                  {mode === "written" ? (
                    <>
                      {q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0 && (
                        <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                          {q.options.map((opt, i) => (
                            <label key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input type="radio" name={`q-${q.id}`} value={opt}
                                checked={(writtenAnswers[q.id] || "") === opt}
                                onChange={(e) => setWrittenAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {(q.type === "short" || !q.type) && (
                        <input type="text" value={writtenAnswers[q.id] || ""} onChange={(e) => setWrittenAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} placeholder="Type your answer…" style={{ width: "100%", padding: 8, borderRadius: 8 }}
                          onPaste={(e) => { e.preventDefault(); alert("Pasting is disabled for this test. Please type your answer."); }}
                          onDrop={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}
                          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} title="Pasting disabled" />
                      )}
                    </>
                  ) : (
                    <>
                      <OralRecorder onFinalBlob={(blob) => onBlobCapture(q.id, blob)} />
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Your transcribed answer (editable):</div>
                        <textarea rows={3} style={{ width: "100%", padding: 10, borderRadius: 8 }} value={oralText[q.id] || ""} onChange={(e) => setOralText(prev => ({ ...prev, [q.id]: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        <AnimatedButton onClick={() => transcribeOne(q.id)} style={{ background: "#0ea5e9" }}>📝 Transcribe Recording</AnimatedButton>
                        <AnimatedButton onClick={() => gradeOralOne(q)} style={{ background: "#7c3aed" }}>✅ Grade This Answer</AnimatedButton>
                      </div>

                      {/* — Pronunciation feedback & actions (inserted) */}
                      <div style={{ marginTop: 12 }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <AnimatedButton onClick={() => evaluatePronunciationOne(q)} style={{ background: "#06b6d4" }} disabled={pronLoading}>
                            {pronLoading ? "Evaluating…" : "🔍 Check Pronunciation"}
                          </AnimatedButton>
                          <AnimatedButton onClick={() => playCorrectPronunciation(q.answer || q.question)} style={{ background: "#3b82f6" }}>
                            🔊 Hear Correct Answer
                          </AnimatedButton>
                        </div>

                        {pronFeedbackMap[q.id] && (
                          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fffbe6", border: "1px solid #fef3c7" }}>
                            <div style={{ fontWeight: 800, marginBottom: 8 }}>
                              Pronunciation — Score: {pronFeedbackMap[q.id].overallScore ?? pronFeedbackMap[q.id].score ?? "—"}%
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {(pronFeedbackMap[q.id].words || []).map(w => (
                                <div key={w.index} style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  background: w.mispronounced ? "#fee2e2" : "#ecfdf5",
                                  color: w.mispronounced ? "#991b1b" : "#065f46",
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                  minWidth: 120
                                }}>
                                  <div style={{ fontWeight: 800 }}>{w.expected}</div>
                                  <div style={{ fontSize: 13 }}>{w.mispronounced ? `you said: «${w.spoken || "—"}»` : "good"}</div>
                                  <button onClick={() => playCorrectPronunciation(w.playText || w.expected)} style={{ marginLeft: 6, padding: "6px 8px", borderRadius: 6 }}>
                                    🔊 Play
                                  </button>
                                </div>
                              ))}
                            </div>

                            {pronFeedbackMap[q.id].feedback && (
                              <div style={{ marginTop: 8, color: "#0f172a" }}>{pronFeedbackMap[q.id].feedback}</div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* — end pronunciation UI */}
                    </>
                  )}

                  {graded && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: graded.correct ? "#ecfdf5" : "#fef2f2", color: graded.correct ? "#065f46" : "#991b1b" }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>{graded.correct ? "Correct" : "Needs Improvement"} — {graded.percent}%</div>
                      <div>{graded.feedback}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {mode === "written" ? (
              <AnimatedButton onClick={gradeWrittenAll} style={{ background: "#22c55e" }}>🧮 Grade All (Written)</AnimatedButton>
            ) : (
              <AnimatedButton onClick={gradeOralAll} style={{ background: "#22c55e" }}>🧮 Grade All (Oral)</AnimatedButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}