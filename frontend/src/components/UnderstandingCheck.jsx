import { useState, useRef, useCallback } from "react";
import { API_BASE } from "../api";
import "./UnderstandingCheck.css";

// Reusable text + voice input used across sections 1, 3, 4
function VoiceTextField({ label, value, onChange, placeholder }) {
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef(null);

  const startRecording = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("Voice input isn't supported in this browser.");
      return;
    }

    setVoiceError("");
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        onChange((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onerror = () => {
      setVoiceError("Couldn't hear that clearly — please try again.");
      setRecording(false);
    };

    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="uc-field">
      {label && <label className="uc-field-label">{label}</label>}
      <div className="uc-field-row">
        <textarea
          className="uc-textarea"
          rows="2"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className={`uc-btn uc-mic ${recording ? "recording" : ""}`}
          onClick={recording ? stopRecording : startRecording}
          title={recording ? "Stop recording" : "Record your voice"}
        >
          {recording ? "⏹" : "🎤"}
        </button>
      </div>
      {voiceError && <p className="uc-voice-error">{voiceError}</p>}
    </div>
  );
}

const MAX_QUESTIONS = 10;
let qIdCounter = 0;
const makeId = () => `q_${Date.now()}_${qIdCounter++}`;

export default function UnderstandingCheck({
  onClose,
  uploadedImage,
  extractedText,
  translatedText,
  explanation,
  lessonLanguage,
  parentLanguage,
}) {
  // Section 1
  const [ownWords, setOwnWords] = useState("");

  // Section 2
  const [questions, setQuestions] = useState([
    { id: makeId(), question: "", answer: "" },
  ]);

  // Section 3
  const [curiosityQuestion, setCuriosityQuestion] = useState("");
  const [curiositySurprise, setCuriositySurprise] = useState("");
  const [curiosityNext, setCuriosityNext] = useState("");

  // Section 4
  const [realLifeExample, setRealLifeExample] = useState("");
  const [realLifeDaily, setRealLifeDaily] = useState("");

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [report, setReport] = useState(null);

  const addQuestion = () => {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [...prev, { id: makeId(), question: "", answer: "" }]);
  };

  const deleteQuestion = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const updateQuestion = (id, field, value) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const resetForm = useCallback(() => {
    setOwnWords("");
    setQuestions([{ id: makeId(), question: "", answer: "" }]);
    setCuriosityQuestion("");
    setCuriositySurprise("");
    setCuriosityNext("");
    setRealLifeExample("");
    setRealLifeDaily("");
    setReport(null);
    setSubmitError("");
  }, []);

  const handleClose = () => {
    onClose?.();
  };

  const handleSubmit = async () => {
    setSubmitError("");

    const cleanedQuestions = questions.filter(
      (q) => q.question.trim() || q.answer.trim()
    );

    if (!ownWords.trim() && cleanedQuestions.length === 0) {
      setSubmitError("Please answer at least one section before submitting.");
      return;
    }

    setSubmitting(true);
    setReport(null);

    try {
      const res = await fetch(`${API_BASE}/api/ai/audiobook-understanding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadedImage,
          extractedText,
          translatedText,
          explanation,
          lessonLanguage,
          parentLanguage,
          ownWords,
          questions: cleanedQuestions,
          curiosity: {
            question: curiosityQuestion,
            surprise: curiositySurprise,
            nextTopic: curiosityNext,
          },
          realLife: {
            example: realLifeExample,
            dailyLife: realLifeDaily,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Something went wrong. Please try again.");
      }

      const data = await res.json();
      setReport(data.result || null);
    } catch (err) {
      console.error("Understanding Check submit error:", err);
      setSubmitError(err.message || "Couldn't submit right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="uc-overlay" role="dialog" aria-modal="true" aria-label="Understanding Test">
      <div className="uc-modal">
        <div className="uc-header">
          <h3>🧠 Understanding Test</h3>
          <button className="uc-close" onClick={handleClose} aria-label="Close">✖</button>
        </div>

        {!report && (
          <div className="uc-body">
            {/* SECTION 1 */}
            <section className="uc-section">
              <h4>1️⃣ Explain in Your Own Words</h4>
              <VoiceTextField
                value={ownWords}
                onChange={setOwnWords}
                placeholder="Tell us what you learned, in your own words..."
              />
            </section>

            {/* SECTION 2 */}
            <section className="uc-section">
              <h4>2️⃣ Create & Answer Your Own Questions</h4>
              <p className="uc-hint">Make up to {MAX_QUESTIONS} questions about the lesson and answer them yourself.</p>

              {questions.map((q, idx) => (
                <div key={q.id} className="uc-qa-row">
                  <div className="uc-qa-inputs">
                    <input
                      type="text"
                      className="uc-input"
                      placeholder={`Question ${idx + 1}`}
                      value={q.question}
                      onChange={(e) => updateQuestion(q.id, "question", e.target.value)}
                    />
                    <input
                      type="text"
                      className="uc-input"
                      placeholder="Your answer"
                      value={q.answer}
                      onChange={(e) => updateQuestion(q.id, "answer", e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="uc-btn uc-delete-q"
                    onClick={() => deleteQuestion(q.id)}
                    disabled={questions.length === 1}
                    title="Delete question"
                  >
                    🗑️
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="uc-btn uc-add-q"
                onClick={addQuestion}
                disabled={questions.length >= MAX_QUESTIONS}
              >
                ➕ Add Question
              </button>
            </section>

            {/* SECTION 3 */}
            <section className="uc-section">
              <h4>3️⃣ Curiosity Reflection</h4>
              <VoiceTextField
                label="What question came to your mind while learning this lesson?"
                value={curiosityQuestion}
                onChange={setCuriosityQuestion}
                placeholder="Type or record your thought..."
              />
              <VoiceTextField
                label="What surprised you the most?"
                value={curiositySurprise}
                onChange={setCuriositySurprise}
                placeholder="Type or record your thought..."
              />
              <VoiceTextField
                label="What would you like to learn next?"
                value={curiosityNext}
                onChange={setCuriosityNext}
                placeholder="Type or record your thought..."
              />
            </section>

            {/* SECTION 4 */}
            <section className="uc-section">
              <h4>4️⃣ Real-Life Connection</h4>
              <VoiceTextField
                label="Can you think of a real-life example related to this lesson?"
                value={realLifeExample}
                onChange={setRealLifeExample}
                placeholder="Type or record your example..."
              />
              <VoiceTextField
                label="Where do you see this concept in your daily life?"
                value={realLifeDaily}
                onChange={setRealLifeDaily}
                placeholder="Type or record your thought..."
              />
            </section>

            {/* SECTION 5 */}
            <section className="uc-section uc-submit-section">
              {submitError && <p className="uc-error">⚠️ {submitError}</p>}
              <button
                type="button"
                className="uc-btn uc-submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Checking Understanding..." : "✅ Submit"}
              </button>
            </section>
          </div>
        )}

        {report && (
          <div className="uc-body">
            <div className="uc-report">
              <h4>🎉 Great Job!</h4>

              {report.understandingLevel && (
                <div className="uc-report-block">
                  <strong>Understanding Level:</strong> {report.understandingLevel}
                </div>
              )}
              {report.conceptsUnderstood && (
                <div className="uc-report-block">
                  <strong>✅ Concepts Understood:</strong>
                  <p>{report.conceptsUnderstood}</p>
                </div>
              )}
              {report.conceptsToRevisit && (
                <div className="uc-report-block">
                  <strong>🔁 Concepts to Revisit:</strong>
                  <p>{report.conceptsToRevisit}</p>
                </div>
              )}
              {report.accuracyOfOwnQuestions && (
                <div className="uc-report-block">
                  <strong>❓ Accuracy of Your Questions:</strong>
                  <p>{report.accuracyOfOwnQuestions}</p>
                </div>
              )}
              {report.qualityOfAnswers && (
                <div className="uc-report-block">
                  <strong>💬 Quality of Answers:</strong>
                  <p>{report.qualityOfAnswers}</p>
                </div>
              )}
              {report.curiosityLevel && (
                <div className="uc-report-block">
                  <strong>🌟 Curiosity Level:</strong> {report.curiosityLevel}
                </div>
              )}
              {report.confidenceLevel && (
                <div className="uc-report-block">
                  <strong>💪 Confidence Level:</strong> {report.confidenceLevel}
                </div>
              )}
              {report.personalizedFeedback && (
                <div className="uc-report-block">
                  <strong>📝 Feedback:</strong>
                  <p>{report.personalizedFeedback}</p>
                </div>
              )}
              {report.encouragement && (
                <div className="uc-report-block uc-encouragement">
                  <p>💚 {report.encouragement}</p>
                </div>
              )}
              {report.suggestedNextTopics && (
                <div className="uc-report-block">
                  <strong>➡️ Suggested Next Topics:</strong>
                  <p>{report.suggestedNextTopics}</p>
                </div>
              )}
            </div>

            <div className="uc-report-actions">
              <button className="uc-btn uc-retake" onClick={resetForm}>
                🔄 Take Again
              </button>
              <button className="uc-btn uc-done" onClick={handleClose}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}