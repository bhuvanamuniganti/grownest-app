import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../../api";
import "./index.css";

const LANGUAGES = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi", "Odia", "Urdu"];

export default function LessonVideoGenerator() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const timerRef = useRef(null);
  const audioUrlRef = useRef(null);
  const profile = location.state || JSON.parse(localStorage.getItem("child_profile") || "{}");
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [topic, setTopic] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [language, setLanguage] = useState(profile.childLanguages?.[0] || "English");
  const [storyboard, setStoryboard] = useState(null);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [activeScene, setActiveScene] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState("");

  const age = profile.age || "";
  const grade = String(profile.classLevel || "").replace(/^Class\s*/i, "");
  const parentLanguage = profile.parentLanguage || "English";
  const rendererPayload = useMemo(() => storyboard && ({
    format: "grownest-lesson-video/v1",
    lesson: storyboard,
    renderSettings: { language, narrationVoice: "alloy", sceneDurationSeconds: 20, transition: "fade" },
  }), [storyboard, language]);

  useEffect(() => () => {
    window.clearInterval(timerRef.current);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, [imagePreview]);

  const stopPreview = () => {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPreviewing(false);
  };

  const chooseImage = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setFile(selected);
    setImagePreview(URL.createObjectURL(selected));
    setError("");
  };

  const extractOcrText = async () => {
    if (!file) return setError("Choose a textbook image first.");
    setLoadingOcr(true); setError("");

    try {
      const form = new FormData();
      form.append("file", file, file.name);

      const response = await fetch(`${API_BASE}/api/learning/analyze`, {
        method: "POST",
        body: form,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not extract text from this image.");
      }

      setExtractedText(data.result || "");
    } catch (err) {
      setError(err.message || "Could not extract text from this image.");
    } finally {
      setLoadingOcr(false);
    }
  };

  const generateStoryboard = async () => {
    if (!topic.trim() && !extractedText.trim()) {
      return setError("Enter a topic or extract text from a textbook image first.");
    }

    if (!age) {
      return setError("Child age is missing. Complete the child profile first.");
    }

    setGenerating(true);
    setError("");
    setStoryboard(null);
    stopPreview();

    try {
      const response = await fetch(`${API_BASE}/api/learning/video-storyboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          extractedText: extractedText.trim(),
          language,
          age: Number(age),
          grade,
          parentLanguage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not generate the storyboard.");
      }

      setStoryboard(data);
      setActiveScene(0);
    } catch (err) {
      setError(err.message || "Could not generate the storyboard.");
    } finally {
      setGenerating(false);
    }
  };

  const startPreview = () => {
    if (!storyboard?.scenes?.length) return;

    stopPreview();
    setActiveScene(0);
    setPreviewing(true);

    timerRef.current = window.setInterval(() => {
      setActiveScene((current) => {
        if (current >= storyboard.scenes.length - 1) {
          stopPreview();
          return current;
        }

        return current + 1;
      });
    }, 6000);
  };

  const playNarration = async (narration) => {
    setAudioLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/learning/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: narration }),
      });

      if (!response.ok) throw new Error("Narration audio is unavailable.");

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);

      audioUrlRef.current = URL.createObjectURL(await response.blob());
      await new Audio(audioUrlRef.current).play();
    } catch (err) {
      setError(err.message || "Narration audio is unavailable.");
    } finally {
      setAudioLoading(false);
    }
  };

  const reset = () => {
    stopPreview();
    setStoryboard(null);
    setTopic("");
    setExtractedText("");
    setError("");
    setFile(null);

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="lesson-video-page">
      <div className="lesson-video-header">
        <button
          className="back-btn"
          onClick={() => navigate("/practice", { state: profile })}
        >
          Back
        </button>

        <div>
          <h2>🎬 AI Lesson Storyboard</h2>
          <p>Turn a textbook page into an engaging, AI-generated lesson storyboard with narration and parent guidance.</p>
        </div>
      </div>

      <section className="lesson-video-panel">
        <div className="lesson-video-profile">
          <span>Age: {age || "Not set"}</span>
          <span>Class: {profile.classLevel || "Not set"}</span>
          <span>Parent language: {parentLanguage}</span>
        </div>

        <div className="lesson-video-grid">
          <div className="lesson-video-input-group">
            <label>1. Upload a textbook image (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={chooseImage}
            />

            {imagePreview && (
              <img
                className="lesson-image-preview"
                src={imagePreview}
                alt="Selected textbook page"
              />
            )}

            <button
              className="lesson-secondary-btn"
              onClick={extractOcrText}
              disabled={!file || loadingOcr}
            >
              {loadingOcr ? "Extracting text..." : "Extract Text from Image"}
            </button>
          </div>

          <div className="lesson-video-input-group">
            <label>Lesson language</label>

            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <label>2. Learning topic (optional if text is extracted)</label>

            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="For example: How plants make food"
            />
          </div>
        </div>

        <label>3. Extracted or pasted textbook text</label>

        <textarea
          value={extractedText}
          onChange={(event) => setExtractedText(event.target.value)}
          placeholder="Text extracted from the image will appear here. You can also paste study content."
          rows="7"
        />

        {error && <p className="lesson-error">{error}</p>}

        <div className="lesson-video-actions">
          <button
            className="lesson-primary-btn"
            onClick={generateStoryboard}
            disabled={generating}
          >
            {generating ? "Creating Lesson..." : "Generate Storyboard"}
          </button>

          <button className="lesson-reset-btn" onClick={reset}>
            Clear
          </button>
        </div>
      </section>

      {storyboard && (
        <section className="lesson-storyboard">
          <div className="lesson-storyboard-title-row">
            <div>
              <h2>{storyboard.title}</h2>
              <p>{storyboard.learningObjective}</p>
            </div>

            <button
              className="lesson-preview-btn"
              onClick={previewing ? stopPreview : startPreview}
            >
              {previewing ? "Stop Preview" : "▶ Preview Lesson"}
            </button>
          </div>

          <div className="lesson-meta">
            <span>⏱ {storyboard.estimatedDuration}</span>
            <span>📘 {storyboard.difficulty}</span>
          </div>

          {previewing && storyboard.scenes[activeScene] && (
            <div className="lesson-preview-stage">
              <small>
                Previewing scene {activeScene + 1} of {storyboard.scenes.length}
              </small>
              <h3>{storyboard.scenes[activeScene].title}</h3>
              <p className="lesson-preview-narration">
                {storyboard.scenes[activeScene].narration}
              </p>
              <p className="lesson-preview-onscreen">
                {storyboard.scenes[activeScene].onscreenText}
              </p>
            </div>
          )}

          <div className="lesson-scene-list">
            {storyboard.scenes.map((scene, index) => (
              <article
                className={`lesson-scene-card ${index === activeScene ? "is-active" : ""}`}
                key={scene.scene}
              >
                <div className="lesson-scene-number">{scene.scene}</div>

                <div className="lesson-scene-content">
                  <h3>{scene.title}</h3>
                  <p><strong>Visual:</strong> {scene.visualDescription}</p>
                  <p><strong>Narration:</strong> {scene.narration}</p>
                  <p className="lesson-onscreen-text">{scene.onscreenText}</p>
                  <p><strong>Parent guidance:</strong> {scene.parentGuidance}</p>

                  <button
                    className="lesson-listen-btn"
                    onClick={() => playNarration(scene.narration)}
                    disabled={audioLoading}
                  >
                    {audioLoading ? "Loading audio..." : "🔊 Listen to narration"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="lesson-footer-card">
            <p><strong>Lesson summary:</strong> {storyboard.summary}</p>

            <div className="lesson-keywords">
              {storyboard.keywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>

          

      
          
          </div>
        </section>
      )}
    </div>
  );
}