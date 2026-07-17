const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------
// Ensure uploads dir exists
// ---------------------------
const uploadsDir = path.join(__dirname, "..", "uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Created uploads dir at", uploadsDir);
  }
} catch (e) {
  console.error("Could not ensure uploads dir:", e);
}



// Small router-level logger (temporary / safe)
router.use((req, res, next) => {
  console.log("[practiceImage router] ", new Date().toISOString(), req.method, req.originalUrl);
  next();
});

// -------------------- Helpers --------------------
function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}
function stripHtml(s) { return s.replace(/<[^>\n]+>/g, ""); }
function cleanLine(s) {
  let t = decodeEntities(stripHtml(s)).replace(/\r/g, "").trim();
  t = t.replace(/^(?:[>›]+\s*)+/, "");
  t = t.replace(/^\s*[\*\-•–—]\s+/, "");
  t = t.replace(/^\s*\d+\s*[\)\.:\-–]\s+/, "");
  t = t.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ");
  t = t.replace(/[>:\-–—\s]+$/g, "").trim();
  return t;
}
function cleanBlock(s) {
  return decodeEntities(stripHtml(String(s)))
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(cleanLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function sanitizeQA(q) {
  const question = cleanLine(q.question || "");
  const answer = cleanBlock(q.answer || "");
  return { id: q.id, question, answer };
}

// -------------------- Improved quickParseQA --------------------
function quickParseQA(raw) {
  const text = cleanBlock(String(raw || ""));
  if (!text) return [];

  // Try regex block parse
  const qaBlocks = [];
  const blockRe =
    /(?:(?:^|\n)\s*(?:\d+\s*[\)\.:–-]\s*|Q(?:uestion)?\s*[:.\-]?\s*)?)?(.{5,}?[\?\:])\s*(?:\n|\s)*((?:Ans(?:wer)?|A|Answer|A\.)\s*[:.\-]?\s*)([\s\S]*?)(?=(?:\n\s*(?:\d+\s*[\)\.:–-]|\nQ(?:uestion)?[:.\-]|\nAns(?:wer)?[:.\-]?|\nA[:.\-]?|$)))/gi;

  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const qRaw = m[1] || "";
    const aRaw = (m[3] || "").trim();
    const q = cleanLine(qRaw);
    const a = cleanBlock(aRaw);
    if (q && a) qaBlocks.push({ id: qaBlocks.length + 1, question: q, answer: a });
  }
  if (qaBlocks.length >= 2) return qaBlocks.map(sanitizeQA);

  // Line-by-line fallback
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    const sameLineMatch = line.match(/^(.+?[\?\:])\s*(?:Ans(?:wer)?|A|Answer|A\.)\s*[:.\-]?\s*(.+)$/i);
    if (sameLineMatch) {
      const q = cleanLine(sameLineMatch[1]);
      const a = cleanBlock(sameLineMatch[2]);
      if (q && a) out.push({ id: out.length + 1, question: q, answer: a });
      i++;
      continue;
    }
    const qMatch = line.match(/^(?:\d+\s*[\)\.:–-]\s*)?(?:Q(?:uestion)?\s*[:.\-]?\s*)?(.+?[\?\:])$/i);
    if (qMatch) {
      let qText = cleanLine(qMatch[1]);
      let j = i + 1, answerCandidate = "";
      if (j < lines.length) {
        const ansLineMatch = lines[j].match(/^(?:Ans(?:wer)?|A|Answer|A\.)\s*[:.\-]?\s*(.+)$/i);
        if (ansLineMatch) {
          answerCandidate = ansLineMatch[1].trim();
          j++;
          while (j < lines.length && !/^(?:\d+\s*[\)\.:–-]|\s*Q(?:uestion)?[:.\-]?)/i.test(lines[j])) {
            answerCandidate += "\n" + lines[j];
            j++;
          }
        }
      }
      if (answerCandidate) {
        out.push({ id: out.length + 1, question: qText, answer: cleanBlock(answerCandidate) });
        i = j;
        continue;
      }
    }
    i++;
  }
  if (out.length >= 1) return out.map(sanitizeQA);

  return [];
}

// -------------------- OCR Helpers --------------------
async function loadAndDownscale(filePath) {
  const buf = await sharp(filePath)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .png({ quality: 80, compressionLevel: 9 })
    .toBuffer();
  return buf;
}
async function ocrWithOpenAIVision(pngBuffer) {
  const b64 = pngBuffer.toString("base64");
  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are an OCR assistant. Return ONLY the raw text, no explanations." },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract plain text from this image:" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
    temperature: 0.0,
  });
  return (r.choices?.[0]?.message?.content || "").trim();
}
async function ocrWithTesseract(pngBuffer) {
  const { data } = await Tesseract.recognize(pngBuffer, "eng", { logger: () => {} });
  return (data.text || "").trim();
}

// -------------------- Routes --------------------

// Analyze
router.post("/practice-image/analyze", async (req, res) => {
  try {
    let extractedText = (req.body?.text || "").toString().trim();

    if (!extractedText && req.files?.file) {
      try {
        const pngBuffer = await loadAndDownscale(req.files.file.tempFilePath);
        let txt = "";
        try { txt = await ocrWithTesseract(pngBuffer); } catch {}
        if (!txt) try { txt = await ocrWithOpenAIVision(pngBuffer); } catch {}
        extractedText = txt || "";
      } finally {
        try { fs.unlink(filePath, () => {}); } catch {}
      }
    }

    console.log("[practiceImage router] --- extractedText START ---");
    console.log((extractedText || "").slice(0, 500));
    console.log("[practiceImage router] --- extractedText END ---");

    if (!extractedText) {
      return res.status(400).json({ error: "No text found in request (provide text or an image)." });
    }

    let qas = quickParseQA(extractedText);

    // Emergency: pair every "Ans" with previous Q if only 1 found
    if (qas.length <= 1 && /Ans/i.test(extractedText)) {
      const lines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const pairs = [];
      let lastQ = null;
      for (let L of lines) {
        if (/[\?\:]$/.test(L)) { lastQ = L; continue; }
        const m = L.match(/^Ans.*?\s*(.*)$/i);
        if (m && lastQ) {
          pairs.push({ id: pairs.length + 1, question: cleanLine(lastQ), answer: cleanBlock(m[1]) });
          lastQ = null;
        }
      }
      if (pairs.length) qas = pairs;
    }

    if (!qas.length){
      // Fallback: if no Q&A found, ask OpenAI to generate them
  try {
    const prompt = `
Generate 5 simple Q&A pairs based on the following text. 
Return STRICT JSON { "questions":[{id,question,answer}] }.

Text:
${extractedText.slice(0, 1500)}
    `;
    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a Q&A generator. Return STRICT JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    let parsed = {};
    try { parsed = JSON.parse(r.choices?.[0]?.message?.content || "{}"); } catch {}
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map((q, i) => sanitizeQA({
          id: q?.id ?? i + 1,
          question: q?.question || "",
          answer: q?.answer || "",
        }))
      : [];
    if (questions.length) {
      return res.json({ type: "qa", source_text: extractedText, questions });
    }
  } catch (e) {
    console.error("fallback generation failed:", e);
  }
  return res.status(400).json({ error: "Could not create questions, even with AI fallback." });
}

    

    const questions = qas.map((q, i) => ({ id: i + 1, question: q.question, answer: q.answer }));

    console.log("[practiceImage router] parsed QAs count:", questions.length);
    return res.json({ type: "qa", source_text: extractedText, questions });
  } catch (err) {
    console.error("analyze error:", err);
    res.status(500).json({ error: err.message || "Server error during analyze" });
  }
});


// Grade written answers (batch)
router.post("/practice-image/grade", async (req, res) => {
  try {
    const { questions = [], userAnswers = [] } = req.body || {};
    if (!Array.isArray(questions) || !Array.isArray(userAnswers)) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // Build a compact grading prompt for each question
    // We'll send a single request with all Q&A pairs to reduce calls
    const payload = {
      model: "gpt-5.6-terra",

    messages: [
  {
    role: "system",
    content: `You are an intelligent educational examiner.

Evaluate each student's answer based on the QUESTION itself, not only the expected answer.

Rules:
- The expected answer is only a reference.
- Determine whether the student's answer is factually correct in general.
- Accept alternative correct answers, synonyms, equivalent wording, and different valid examples.
- If the question allows multiple valid answers (examples: states, countries, fruits, animals, programming languages, examples, uses, advantages), accept any factually correct answer.
- Only mark an answer incorrect if it is factually wrong, irrelevant, or does not answer the question.
- Give partial credit when the answer is partially correct.
- Return STRICT JSON only.`
  },
  {
    role: "user",
    content:
      "Grade the following responses. Return STRICT JSON only: { \"results\": [ { id, correct, percent, feedback } ] }\n\n" +
      "Data:\n" +
      JSON.stringify({
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          expected: q.answer
        })),
        userAnswers
      })
  }
],
      response_format: { type: "json_object" },
    };

    const r = await client.chat.completions.create(payload);
    const raw = r.choices?.[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }

    // Normalize results
    const results = Array.isArray(parsed.results)
      ? parsed.results.map((r) => ({
          id: r.id,
          correct: !!r.correct,
          percent: Number.isFinite(r.percent) ? Number(r.percent) : (r.correct ? 100 : 0),
          feedback: String(r.feedback || "").trim(),
        }))
      : [];

    return res.json({ results });
  } catch (err) {
    console.error("grading error:", err);
    res.status(500).json({ error: err.message || "Grading failed" });
  }
});



// -------------------- Transcribe --------------------
router.post("/practice-image/transcribe", async (req, res) => {
  if (!req.files?.audio) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  const originalPath = req.files.audio.tempFilePath;
  const wavPath = path.join(
    path.dirname(originalPath),
    path.basename(originalPath) + ".wav"
  );

  function convertToWav() {
    return new Promise((resolve, reject) => {
      const args = [
        "-y",
        "-i",
        originalPath,
        "-ar",
        "16000",
        "-ac",
        "1",
        wavPath,
      ];

      const proc = spawn(ffmpegPath, args);

      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve(wavPath);
        else reject(new Error("ffmpeg failed, exit code " + code));
      });
    });
  }

  try {
    // Convert webm -> wav
    await convertToWav();

    // Convert speech from any language directly to English
    const response = await client.audio.translations.create({
      file: fs.createReadStream(wavPath),
      model: "whisper-1",
    });

    const englishText = response.text || "";

    // Cleanup
    try {
      fs.unlinkSync(originalPath);
    } catch {}

    try {
      fs.unlinkSync(wavPath);
    } catch {}

    return res.json({
      text: englishText,
    });
  } catch (err) {
    console.error("Transcription error:", err);

    try {
      fs.unlinkSync(originalPath);
    } catch {}

    try {
      fs.unlinkSync(wavPath);
    } catch {}

    return res.status(500).json({
      error:
        "Transcription failed: " + (err.message || "unknown error"),
    });
  }
});



// Grade a single oral answer (transcript) against expected answer
router.post("/practice/oral-grade", async (req, res) => {
  try {
    const { question = "", transcript = "", expected = "" } = req.body || {};
    if (!question) return res.status(400).json({ error: "Missing question" });
const prompt = `
You are an intelligent educational examiner.

Evaluate the student's transcript based on the QUESTION itself, not only the expected answer.

The expected answer is only a reference.

Rules:
- Determine whether the student's answer is factually correct in general.
- Accept alternative correct answers, synonyms, equivalent wording, and different valid examples.
- If the question allows multiple valid answers, accept any factually correct response.
- Only mark incorrect if the answer is factually wrong, irrelevant, or does not answer the question.
- Give partial credit when the answer is partially correct.

Return STRICT JSON:
{
  "correct": true|false,
  "percent": 0-100,
  "feedback": "short text"
}

Question: ${question}

Expected answer:
${expected}

Student transcript:
${transcript}
`;
    const r = await client.chat.completions.create({
      model: "gpt-5.6-terra",
      messages: [
        { role: "system", content: "You are a concise grader returning strict JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    let parsed = {};
    try { parsed = JSON.parse(r.choices?.[0]?.message?.content || "{}"); } catch (e) { parsed = {}; }

    const out = {
      correct: !!parsed.correct,
      percent: Number.isFinite(parsed.percent) ? Number(parsed.percent) : (parsed.correct ? 100 : 0),
      feedback: String(parsed.feedback || "").trim(),
    };

    return res.json(out);
  } catch (err) {
    console.error("oral-grade error:", err);
    return res.status(500).json({ error: err.message || "Oral grading failed" });
  }
});



// Similar
router.post("/practice-image/similar", async (req, res) => {
  try {
    const { baseText = "", prevQuestions = [], count = 8 } = req.body || {};
    const prompt = `
Generate ${count} new practice Q&A pairs similar in style to the given examples.
Return STRICT JSON { "questions":[{id,question,answer}] }.

Examples:
${JSON.stringify(prevQuestions)}

Base material (optional):
${baseText.slice(0, 2000)}
`;
    const r = await client.chat.completions.create({
      model: "gpt-5.6-terra",
      messages: [
        { role: "system", content: "Return STRICT JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    let parsed = {};
    try { parsed = JSON.parse(r.choices?.[0]?.message?.content || "{}"); } catch {}
    const questions = Array.isArray(parsed.questions) ? parsed.questions.map((q, i) => sanitizeQA({
      id: q?.id ?? i + 1,
      question: q?.question || "",
      answer: q?.answer || "",
    })) : [];
    return res.json({ questions });
  } catch (e) {
    console.error("similar error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;