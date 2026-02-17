
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { API_BASE } from "../../api";
import "./index.css";

function cls(...xs) { return xs.filter(Boolean).join(" "); }
function slug(s = "") { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function downloadBlob(blob, filename) {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}


function MiniRecorder({ onStop, onStart, disabled, showWaveform = true }) {
  const [state, setState] = useState("idle");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const rafRef = useRef(null);
  const canvasRef = useRef(null);

  async function start() {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onStop?.(blob);
        cleanupAudio();
        setState("idle");
      };

      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      src.connect(analyserRef.current);
      const bufferLength = analyserRef.current.fftSize;
      dataArrayRef.current = new Uint8Array(bufferLength);

      rec.start();
      setState("recording");
      onStart?.();

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext?.("2d");
      function draw() {
        if (!analyserRef.current || !ctx || !canvas) return;
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const grad = ctx.createLinearGradient(0,0,canvas.width,0);
        grad.addColorStop(0, "#06b6d4");
        grad.addColorStop(1, "#10b981");
        ctx.lineWidth = 2;
        ctx.strokeStyle = grad;
        ctx.beginPath();
        const sliceWidth = canvas.width / dataArrayRef.current.length;
        let x = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const v = dataArrayRef.current[i] / 128.0;
          const y = (v * canvas.height) / 2;
          if (i === 0) ctx.moveTo(x,y);
          else ctx.lineTo(x,y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height/2);
        ctx.stroke();
        rafRef.current = requestAnimationFrame(draw);
      }
      rafRef.current = requestAnimationFrame(draw);
    } catch (err) {
      console.error("recorder start failed", err);
      alert("Please allow microphone access.");
    }
  }

  function stop() {
    try { mediaRef.current?.stop?.(); setState("idle"); } catch (e) { console.warn(e); setState("idle"); }
  }

  function cleanupAudio() {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
      analyserRef.current = null;
    } catch (e) { console.warn(e); }
  }

  useEffect(() => {
    return () => {
      cleanupAudio();
      try { streamRef.current?.getTracks().forEach(t=>t.stop()); } catch {}
    };
  }, []);

  return (
    <div className="mini-recorder">
      <div className="mini-controls">
        {state !== "recording" ? (
          <button className="btn btn-record" onClick={start} disabled={disabled}>🎙️ Start</button>
        ) : (
          <button className="btn btn-stop" onClick={stop}>⏹ Stop</button>
        )}
        <div className="rec-indicator">
          <span className={cls("dot", state==="recording" ? "dot-on" : "dot-off")} />
          <span className="rec-label">{state==="recording" ? "Recording…" : "Idle"}</span>
        </div>
      </div>
      {showWaveform && <canvas ref={canvasRef} className="wave-canvas" width="600" height="64" />}
    </div>
  );
}


const TopicView = React.memo(function TopicView({
  topic, setTopic, level, setLevel, suggestions, loading, buildGuidance,
}) {
  const inputRef = useRef(null);
  const valueRef = useRef(topic);
  const debounceRef = useRef(null);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    if (document.activeElement === node) return;
    node.value = topic || "";
    valueRef.current = topic || "";
  }, [topic]);

  function scheduleCommit(delay = 300) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const val = valueRef.current ?? "";
      if (val !== topic) setTopic(val);
      debounceRef.current = null;
    }, delay);
  }

  function onInput(e) {
    valueRef.current = e.target.value;
    scheduleCommit(250);
  }

  function onBlur() {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    const val = inputRef.current?.value ?? "";
    if (val !== topic) setTopic(val);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      const val = inputRef.current?.value ?? "";
      if (val !== topic) setTopic(val);
    }
  }

  function chooseSuggestion(s) {
    valueRef.current = s;
    if (inputRef.current) {
      inputRef.current.value = s;
      try { inputRef.current.focus(); const len = s?.length || 0; inputRef.current.setSelectionRange(len, len); } catch {}
    }
    setTopic(s);
  }

  return (
    <section className="cs-card">
      <header className="cs-header">
        <h1 className="cs-title">🗣️ Confident Speaker</h1>
        <p className="cs-sub">AI suggestions shown below — pick one or type your own topic.</p>
      </header>

      <div className="cs-suggestions">
        {suggestions.map((s) => (
          <button key={s} type="button" className={cls("chip", topic === s && "chip-active")} onClick={() => chooseSuggestion(s)}>{s}</button>
        ))}
      </div>

      <div className="cs-row">
        <input ref={inputRef} className="cs-input" placeholder="Or type your topic…" defaultValue={topic} onInput={onInput} onBlur={onBlur} onKeyDown={onKeyDown} autoComplete="off" spellCheck={false} />
        <select className="cs-select" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="basic">Basic</option>
          <option value="medium">Medium</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div className="cs-actions">
        <button type="button" className="btn btn-primary" disabled={!String(topic||"").trim() || loading} onClick={() => buildGuidance()}>{loading ? "Preparing…" : "Next"}</button>
        <button type="button" className="btn btn-muted" onClick={() => { if (inputRef.current) inputRef.current.value = ""; valueRef.current = ""; setTopic(""); setLevel("basic"); }}>Reset</button>
      </div>
    </section>
  );
});



export default function ConfidentSpeakerSection() {
  const [stage, setStage] = useState("topic");
  const [level, setLevel] = useState("basic");
  const [topic, setTopic] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [guidance, setGuidance] = useState(null);

  const [recordingBlobs, setRecordingBlobs] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [translated, setTranslated] = useState("");
  
  const [score, setScore] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);

  const [exampleText, setExampleText] = useState("");
  const [examplePitch, setExamplePitch] = useState(1.3);
  const [exampleRate, setExampleRate] = useState(0.95);

  const [correctionData, setCorrectionData] = useState(null);
  const audioRef = useRef(null);
  const utterRef = useRef(null);
  const voicesRef = useRef([]);
  const [, setIsPlaying] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

const parentLangFromPractice =
  location.state?.parentLangFromPractice ||
  location.state?.language ||
  "hi";


  useEffect(() => {
    async function fetchSuggestions() {
      try {
        setLoading(true);
        const r = await fetch(`${API_BASE}/api/speaking/guidance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "", level: "basic" }),
        });
        const data = await r.json();
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
      } catch (e) {
        console.warn("Could not load suggestions", e);
        setSuggestions(["Helping at home", "My best friend", "A happy memory", "How I save water", "My favourite food"]);
      } finally { setLoading(false); }
    }

    fetchSuggestions();

    function loadVoices() {
      voicesRef.current = window.speechSynthesis?.getVoices() || [];
    }
    if ("speechSynthesis" in window) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  async function buildGuidance(selectedTopic) {
    const body = { topic: selectedTopic || topic, level };
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/speaking/guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      setTopic(data.topic || body.topic);
      setGuidance(data.guidance || null);
      setSuggestions(data.suggestions || suggestions);
      setStage("guide");

      try {
        const ex = await fetch(`${API_BASE}/api/speaking/example`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: data.topic || body.topic, level }),
        });
        if (ex.ok) {
          const ed = await ex.json();
          if (ed?.exampleText) setExampleText(ed.exampleText);
          if (ed?.pitchHint) setExamplePitch(Number(ed.pitchHint) || 1.3);
          if (ed?.rateHint) setExampleRate(Number(ed.rateHint) || 0.95);
        } else {
          setExampleText(data.guidance?.modelLine || `I will talk about ${body.topic}`);
        }
      } catch (err) {
        console.warn("example fetch failed", err);
        setExampleText(data.guidance?.modelLine || `I will talk about ${body.topic}`);
      }
    } catch (e) {
      console.error(e);
      alert("Could not create guidance. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function transcribeBlob(blob, name, itemId = null) {
    const form = new FormData();
    form.append("audio", new File([blob], name, { type: blob.type || "audio/webm" }));

    try {
      const r = await fetch(`${API_BASE}/api/speaking/practice-image/transcribe`, { method: "POST", body: form });
      if (!r.ok) {
        const err = await r.text().catch(()=>null);
        console.error("transcribe failed response:", err);
        throw new Error("transcription failed");
      }
      const data = await r.json();
      const text = data?.text || "";

      setTranscript(text);

      if (itemId) {
        setRecordingBlobs((prev) => prev.map((it) => it.id === itemId ? { ...it, transcribed: true, transcriptText: text } : it));
      }

      return text;
    } catch (err) {
      console.error("transcribe error", err);
      alert("Transcription failed. See console.");
      return "";
    }
  }

  function handleStopRecording(blob) {
    const id = `${Date.now()}`;
    const url = URL.createObjectURL(blob);
    const name = `take_${slug(topic||"topic")}_${today()}.webm`;
    const item = { id, blob, url, name, createdAt: Date.now(), transcribed: false, transcriptText: null };

    setRecordingBlobs((prev) => {
      const next = [item, ...prev].slice(0, 3);
      if (prev.length >= 3) try { URL.revokeObjectURL(prev[prev.length-1].url); } catch {}
      return next;
    });

    transcribeBlob(blob, name, id).then((text) => {
      console.log("Auto-transcribed text for take:", id, text);
    });
  }

  async function doTranscribe(recId = null) {
    const rec = recId ? recordingBlobs.find(r => r.id === recId) : recordingBlobs[0];
    if (!rec) return alert("Please record first.");
    setLoading(true);
    try {
      await transcribeBlob(rec.blob, rec.name, rec.id);
    } finally {
      setLoading(false);
    }
  }


  async function getScore() {
    const referenceText = guidance?.modelLine || `I will talk about ${topic}`;
    if (!transcript) return alert("Please transcribe or edit transcript before submitting.");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/speaking/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceText, transcript, parentLangFromPractice
}),
      });
      const data = await r.json();
      setScore(data.score);
      setBreakdown(data.breakdown);

      try {
        const cr = await fetch(`${API_BASE}/api/speaking/correct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceText, transcript, parentLangFromPractice
 }),
        });
        if (cr.ok) {
          const cd = await cr.json();
          setCorrectionData(cd || null);
          if (cd?.corrected) setTranslated(cd.corrected);
        } else {
          setCorrectionData(null);
        }
      } catch (err) {
        console.warn("correction fetch failed", err);
        setCorrectionData(null);
      }

      setStage("feedback");
    } catch (e) {
      console.error(e);
      alert("Scoring failed");
    } finally {
      setLoading(false);
    }
  }

  async function translateForParent() {
    if (!transcript) return alert("Transcribe first.");
    setLoading(true);
    try {
      const langMap = { hi: "Hindi", ta: "Tamil", te: "Telugu", en: "English", bn: "Bengali", ml: "Malayalam" };
      const to = langMap[parentLangFromPractice
] || parentLangFromPractice
 || "Hindi";

      const r = await fetch(`${API_BASE}/api/speaking/translate/forward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, to }),
      });

      let data = null;
      try { data = await r.json(); } catch (e) {
        const txt = await r.text().catch(()=>null);
        data = txt ? { translated: txt } : null;
      }

      if (!r.ok) {
        const serverMsg = data && (data.error || data.detail || data.translated)
          ? (data.error || data.detail || data.translated)
          : `status ${r.status}`;
        console.error("translateForParent failed:", r.status, data);
        alert(`Translation failed. ${serverMsg}`);
        return;
      }

      if (!data || typeof data.translated !== "string") {
        console.error("translateForParent: unexpected response", data);
        alert("Translation failed: provider returned unexpected response. See console for details.");
        return;
      }

      setTranslated(data.translated);
    } catch (e) {
      console.error("translateForParent error:", e);
      alert("Translation failed. Network or server error - see console.");
    } finally {
      setLoading(false);
    }
  }

  function playBlob(url) {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    } catch {}
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => { try { URL.revokeObjectURL(url); } catch {}; audioRef.current = null; setIsPlaying(false); };
    a.play().catch(e => console.error(e));
    setIsPlaying(true);
  }

  function downloadTake(b) { downloadBlob(b.blob, b.name); }
  function deleteTake(id) {
    setRecordingBlobs(prev => {
      const found = prev.find(p => p.id === id);
      if (found) try { URL.revokeObjectURL(found.url); } catch {}
      return prev.filter(p => p.id !== id);
    });
  }

  function stopAllTts() {
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch {}
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } } catch {}
    if (utterRef.current) { utterRef.current = null; }
    setIsPlaying(false);
  }

  function playTextBrowser(text, { pitch = 1.2, rate = 1, lang = "en-IN" } = {}) {
    if (!("speechSynthesis" in window)) return false;
    try {
      stopAllTts();
      const utter = new SpeechSynthesisUtterance(text);
      utter.pitch = pitch;
      utter.rate = rate;
      utter.lang = lang;
      const voices = voicesRef.current || [];
      const pref = (lang || "en").split("-")[0];
      const v = voices.find(x => (x.lang || "").toLowerCase().startsWith(pref));
      if (v) utter.voice = v;
      utter.onend = () => { setIsPlaying(false); utterRef.current = null; };
      utter.onerror = () => { setIsPlaying(false); utterRef.current = null; };
      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
      setIsPlaying(true);
      return true;
    } catch (err) {
      console.warn("browser TTS failed", err);
      return false;
    }
  }

  async function playTextServer(text, { lang = "en-IN", pitch = 1 } = {}) {
    try {
      stopAllTts();
      const r = await fetch(`${API_BASE}/api/learning/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, pitch }),
      });
      if (!r.ok) {
        const json = await r.json().catch(()=>null);
        console.warn("server tts not ok", json);
        return false;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => { setIsPlaying(false); try { URL.revokeObjectURL(url); } catch {} audioRef.current = null; };
      await audioRef.current.play();
      setIsPlaying(true);
      return true;
    } catch (err) {
      console.error("server TTS failed", err);
      return false;
    }
  }

  async function playExampleWithPitch(text, opts = { pitch: 1.2, rate: 0.95, lang: "en-IN" }) {
    if (!text) return;
    const ok = playTextBrowser(text, opts);
    if (!ok) await playTextServer(text, { lang: opts.lang, pitch: opts.pitch });
  }

  function pauseExample() {
    try {
      if ("speechSynthesis" in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setIsPlaying(false);
        return;
      }
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } catch (e) { console.warn(e); }
  }

  function resumeExample() {
    try {
      if ("speechSynthesis" in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setIsPlaying(true);
        return;
      }
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(()=>{});
        setIsPlaying(true);
      }
    } catch (e) { console.warn(e); }
  }

  function stopExample() {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; }
    } catch (e) { console.warn(e); }
    utterRef.current = null;
    setIsPlaying(false);
  }

  function GuidanceView() {
    if (!guidance) return null;
    const opener = exampleText || guidance.modelLine || `I will talk about ${topic}`;
    return (
      <section className="cs-card">
        <h2 className="cs-heading">Get ready</h2>
        <div className="cs-kv" style={{fontWeight:"bold"}}>Topic: {topic}</div>
        <p></p>
        <div className="cs-box">
          <div className="label">Model opening</div>
          <div className="bigline">{opener}</div>

          <div className="example-controls">
            <div className="left">
              <label className="small-label">Pitch</label>
              <input
                type="range"
                className="pitch-range"
                min="0.6"
                max="2.0"
                step="0.1"
                value={examplePitch}
                onChange={(e) => setExamplePitch(Number(e.target.value))}
                id="examplePitch"
              />
            </div>
            <div className="right">
              <button className="btn btn-play"
                onClick={() => playExampleWithPitch(opener, { pitch: examplePitch, rate: exampleRate, lang: "en-IN" })}
                style={{marginRight:"3px"}}
              >▶ Play</button>
              <button className="btn btn-pause" onClick={pauseExample} style={{marginRight:"3px"}}>⏸ Pause</button>
              <button className="btn btn-resume" onClick={resumeExample} style={{marginRight:"3px"}}>▶ Resume</button>
              <button className="btn btn-stop" onClick={stopExample}>⏹ Stop</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <button className="btn btn-record" onClick={() => setStage("record")}>Start recording</button>
          </div>
        </div>

        <div className="cs-grid">
          <div className="cs-box">
            <div className="label">Warm-up</div>
            <ul className="cs-list">{(guidance.warmups || []).map((w,i)=>(<li key={i}>{w}</li>))}</ul>
            <p className="cs-hint">Ask the child to answer these before recording — short sentences are best.</p>
          </div>
          <div className="cs-box">
            <div className="label">Outline</div>
            <ol className="cs-list">{(guidance.outline || []).map((o,i)=>(<li key={i}>{o}</li>))}</ol>
          </div>
        </div>
      </section>
    );
  }

  function RecordView() {
    return (
      <section className="cs-card">
        <h2 className="cs-heading">Record</h2>

        <div className="cs-box">
          <MiniRecorder onStop={handleStopRecording} onStart={() => {}} showWaveform={true} />
          
        </div>

        <div className="cs-box">
          <div className="label">Last 3 takes</div>
          <div className="takes">
            {recordingBlobs.length === 0 && <div className="cs-hint">No recordings yet — press Start.</div>}
            {recordingBlobs.map(t => (
              <div key={t.id} className="take">
                <div className="take-meta">
                  <div className="take-name">{t.name}</div>
                  <div className="take-actions">
                    <button className="btn btn-play" onClick={() => playBlob(t.url)}>▶ Play</button>
                    {!t.transcribed && (
                      <button className="btn btn-transcribe" onClick={() => doTranscribe(t.id)}>📝 Transcribe</button>
                    )}
                    {t.transcribed && (
                      <button className="btn btn-muted" disabled title="Auto-transcribed">✓ Transcribed</button>
                    )}
                    <button className="btn btn-download" onClick={() => downloadTake(t)}>⬇️</button>
                    <button className="btn btn-danger" onClick={() => deleteTake(t.id)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cs-box">
          <div className="label">Transcript (editable)</div>
          <textarea className="cs-textarea" rows={4} value={transcript} onChange={(e)=>setTranscript(e.target.value)} />
          <div className="cs-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" disabled={!transcript || loading}
                onClick={getScore}>{loading ? "Scoring…" : "Submit"}</button>
              <button className="btn btn-muted" onClick={() => setTranscript("")}>Clear</button>
              <button className="btn btn-translate"
                onClick={translateForParent} disabled={!transcript || loading}>🌐 Translate → Parent</button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label className="small-label">Parent language</label>
              
            </div>
          </div>
        </div>

        {translated ? (
          <div className="cs-box">
            <div className="label">Translated to parent language (editable)</div>
            <textarea className="cs-textarea" rows={3} value={translated} onChange={(e)=>setTranslated(e.target.value)} />
          </div>
        ) : null}
      </section>
    );
  }

  function buildSimpleDiffs(original = "", corrected = "") {
  const oWords = original.toLowerCase().split(/\s+/);
  const cWords = corrected.toLowerCase().split(/\s+/);

  const result = [];

  for (let i = 0; i < Math.max(oWords.length, cWords.length); i++) {
    const o = oWords[i];
    const c = cWords[i];

    if (o && c && o !== c) {
      result.push({
        actual: o,
        expected: c,
        matchPct: 0
      });
    }
  }

  return result.slice(0, 5); // limit to 5 differences
}


  function FeedbackView() {
    if (score == null) return null;
    const emoji = score >= 85 ? "😄" : score >= 60 ? "🙂" : "😐";
    const diffs =
  correctionData?.diffs?.length > 0
    ? correctionData.diffs
    : buildSimpleDiffs(transcript, correctionData?.corrected || "");

    const grammarHints = correctionData?.grammarHints || [];
    const pronTips = correctionData?.pronunciationTips || [];

    return (
      <section className="cs-card">
        <h2 className="cs-heading">Feedback</h2>
        <div className="cs-center">
          <div className="cs-emoji">{emoji}</div>
          <div className="cs-bigscore">{score}%</div>
        </div>

        <div className="cs-bar"><div className="cs-barfill" style={{ width:`${Math.max(4, score)}%` }} /></div>

        <div className="cs-grid3">
          <div className="metric"><div className="mname">Pronunciation</div><div className="mval">{breakdown?.pronunciation ?? "—"}%</div></div>
          <div className="metric"><div className="mname">Word Match</div><div className="mval">{breakdown?.wordMatch ?? "—"}%</div></div>
          <div className="metric"><div className="mname">Fluency</div><div className="mval">{breakdown?.fluency ?? "—"}%</div></div>
        </div>

        <div className="cs-box">
  <div className="label">Pronunciation Improvements</div>

  {diffs.length === 0 ? (
    <div className="cs-hint">
      Very good 👍 No major word mismatches found.
    </div>
  ) : (
    <ul className="pron-diff">
      {diffs.map((d, i) => (
        <li key={i}>
          <div>
            <span className="bad">❌ {d.actual}</span>
            <span className="arrow"> → </span>
            <span className="good">✅ {d.expected}</span>
          </div>
          <div className="cs-hint">
            Try saying the word slowly and clearly.
          </div>
        </li>
      ))}
    </ul>
  )}
</div>


        {grammarHints.length > 0 && (
          <div className="cs-box">
            <div className="label">Grammar tips</div>
            <ul className="cs-list">
              {grammarHints.map((g, i) => (<li key={i}>{g}</li>))}
            </ul>
          </div>
        )}

        {pronTips.length > 0 && (
          <div className="cs-box">
            <div className="label">Pronunciation tips</div>
            <ul className="cs-list">
              {pronTips.map((p, i) => (<li key={i}>{p}</li>))}
            </ul>
          </div>
        )}

        <div className="cs-box">
          <div className="label">Suggested corrected transcript</div>
          <div className="bigline">{correctionData?.corrected || translated || "—"}</div>
          <p className="cs-hint">You can edit the suggested transcript and re-submit as the final transcript.</p>
        </div>

        <div className="cs-actions">
          <button className="btn btn-pause" onClick={() => { setStage("record"); setScore(null); }}>Reattempt</button>
          <button className="btn btn-next" onClick={() => { setStage("topic"); setScore(null); setTranscript(""); setTranslated(""); setCorrectionData(null); }}>Next topic</button>
        </div>
      </section>
    );
  }

  return (  
      
  
    <div className="confident-root">
      <button
        className="back-btn"  style={{
    marginBottom: "12px",
    alignSelf: "flex-start"
  }}
        onClick={() => navigate("/practice", { state: location.state })}
      >
        Back
      </button>
      {stage === "topic" && (
        <TopicView
          topic={topic}
          setTopic={setTopic}
          level={level}
          setLevel={setLevel}
          suggestions={suggestions}
          loading={loading}
          buildGuidance={buildGuidance}
        />
      )}
      {stage === "guide" && <GuidanceView />}
      {stage === "record" && <RecordView />}
      {stage === "feedback" && <FeedbackView />}
    </div>  );


}