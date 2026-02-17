
const express = require("express");
const router = express.Router();
const OpenAI = require("openai");
require("dotenv").config();

const fs = require("fs");
const path = require("path");


const OPENAI_KEY = process.env.OPENAI_API_KEY || "";
const openai = new OpenAI({ apiKey: OPENAI_KEY });


function slug(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function normalizeWords(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
function levenshtein(a = "", b = "") {
  const m = a.length,
    n = b.length;
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

// parent language mapper
function getParentLanguageName(code = "hi") {
  const map = {
    hi: "Hindi",
    ta: "Tamil",
    te: "Telugu",
    en: "English",
    bn: "Bengali",
    ml: "Malayalam",
  };
  return map[String(code || "").toLowerCase()] || "Hindi";
}

router.get("/_ping_openai", async (req, res) => {
  try {
    if (!OPENAI_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY not set on server" });
    }
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say hi" }],
      max_tokens: 5,
    });
    const example = r?.choices?.[0]?.message?.content || "ok";
    return res.json({ ok: true, example: example.slice(0, 120) });
  } catch (err) {
    console.error("ping_openai error:", err);
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
});


// POST /api/speaking/guidance
router.post("/guidance", async (req, res) => {
  try {
    const topic = String(req.body?.topic || "My Daily Routine").trim();
    const level = String(req.body?.level || "basic").toLowerCase();

    if (!OPENAI_KEY) {
      const modelLine =
        level === "basic"
          ? `I will talk about ${topic}. First, I will say what it is. Then, I will give one example.`
          : `I will talk about ${topic}. I will give a short example and one closing line.`;
      return res.json({
        topic,
        level,
        guidance: {
          modelLine,
          openers: [modelLine],
          warmups: [`Why is ${topic} useful for you?`, `Can you share one example about ${topic}?`],
          outline:
            level === "advanced"
              ? ["Start: State the topic in one line.", "Middle: Give a real example or story.", "End: Say one benefit or learning."]
              : ["Start: Say your topic.", "Middle: One example.", "End: One simple closing line."],
          parentTip: "Listen, smile, and encourage short clear sentences.",
        },
        suggestions: [topic, "Helping at home", "My best friend", "A happy memory", "How I save water", "My favourite food"],
      });
    }

    const prompt = `
You are a friendly assistant that creates short speaking guidance for young children.
Topic: "${topic}"
Level: "${level}"

Produce JSON ONLY with these keys:
{
  "modelLine": "a single short model opening line",
  "openers": ["3 short opener options"],
  "warmups": ["2 short warmup questions (parent asks)"],
  "outline": ["3 short steps: start, middle, end"],
  "parentTip": "one short parent tip"
}
Keep text simple, kid-friendly and short.
`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 450,
      response_format: { type: "json_object" },
    });

    let guidance = null;
    if (r?.choices?.[0]?.message?.content) {
      try {
        guidance =
          typeof r.choices[0].message.content === "object"
            ? r.choices[0].message.content
            : JSON.parse(r.choices[0].message.content);
      } catch (e) {
        console.warn("Failed to JSON-parse guidance, using fallback text", e);
      }
    }

    if (!guidance) {
      guidance = {
        modelLine: `I will talk about ${topic}. First, I will say what it is. Then, I will give one example.`,
        openers: [`I will talk about ${topic}.`],
        warmups: [`Why is ${topic} useful for you?`, `Can you share one example about ${topic}?`],
        outline: ["Start: Say your topic.", "Middle: One example.", "End: One simple closing line."],
        parentTip: "Listen and encourage short sentences.",
      };
    }

    return res.json({
      topic,
      level,
      guidance,
      suggestions: [topic, "Helping at home", "My best friend", "A happy memory", "How I save water", "My favourite food"],
    });
  } catch (err) {
    console.error("guidance error:", err);
    return res.status(500).json({ error: "Failed to build guidance", detail: err?.message || String(err) });
  }
});


// POST /api/speaking/example
router.post("/example", async (req, res) => {
  try {
    const topic = String(req.body?.topic || "My Daily Routine");
    const level = String(req.body?.level || "basic").toLowerCase();

    if (!OPENAI_KEY) {
      return res.json({
        exampleText:
          level === "basic"
            ? `I will talk about ${topic}. First, I will say what it is. Then, I will give one example.`
            : `Today I will talk about ${topic}. I will give a short story and end with a lesson.`,
        pitchHint: 1.2,
        rateHint: 0.95,
      });
    }

    const prompt = `Write a short 1-3 sentence example speech for a child about "${topic}" at ${level} level. Keep it simple and friendly.`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.6,
    });

    const exampleText = (r?.choices?.[0]?.message?.content || "").trim();

    res.json({
      exampleText: exampleText || `I will talk about ${topic}.`,
      pitchHint: 1.2,
      rateHint: 0.95,
    });
  } catch (err) {
    console.error("example error:", err);
    res.status(500).json({ error: "Failed to build example", detail: err?.message || String(err) });
  }
});


// POST /api/speaking/score
router.post("/score", async (req, res) => {
  try {
    const ref = String(req.body?.referenceText || "").trim();
    const spoken = String(req.body?.transcript || "").trim();
    const topic = String(req.body?.topic || "General");
    const parentLang = String(
  req.body?.parentLang ||
  req.body?.parentLangFromPractice ||
  "hi"
);

    const parentLanguageName = getParentLanguageName(parentLang);

    if (!spoken) return res.json({ error: "Transcript missing" });

    //  Better order-safe matching for wordMatch
    const exp = normalizeWords(ref);
    const sp = normalizeWords(spoken);

    let ok = 0;
    const used = new Set();

    for (let i = 0; i < exp.length; i++) {
      const e = exp[i];
      let bestJ = -1;
      let bestNorm = 999;

      for (let j = 0; j < sp.length; j++) {
        if (used.has(j)) continue;
        const d = levenshtein(e, sp[j]);
        const norm = e.length ? d / e.length : 1;
        if (norm < bestNorm) {
          bestNorm = norm;
          bestJ = j;
        }
      }

      if (bestJ !== -1 && bestNorm <= 0.34) {
        ok++;
        used.add(bestJ);
      }
    }

    const wordMatch = Math.round((ok / Math.max(exp.length, 1)) * 100);

    // Scores derived from wordMatch (simple but stable)
    const pronunciation = Math.min(100, Math.round(wordMatch * 0.9 + 10));
    const fluency = Math.min(100, Math.round(wordMatch * 0.85 + 12));

    //  AI Feedback in Parent Language
    let aiFeedback = {
      pronunciation_tips: [],
      grammar_tips: [],
      relevance_comment: "",
      suggested_correction: "",
      relevance_score: 0,
    };

    if (OPENAI_KEY) {
      const prompt = `
You are a supportive speaking coach for children (6–12 years).
Parents may not be educated, so keep feedback very simple.

IMPORTANT: Write feedback in ${parentLanguageName} language.
But "suggested_correction" must be in simple English.

Model sentence: "${ref || "I will talk about my daily routine."}"
Child said: "${spoken}"

Return JSON only:
{
  "pronunciation_tips": ["max 3 short tips"],
  "grammar_tips": ["max 3 short tips"],
  "relevance_comment": "1 short line",
  "suggested_correction": "corrected version in simple English",
  "relevance_score": 0-100
}

Rules:
- Be kind and motivating.
- If pronunciation issue is unclear from text, give general tip.
- Keep it short.
`;

      try {
        const result = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          response_format: { type: "json_object" },
          max_tokens: 500,
        });
        aiFeedback = JSON.parse(result.choices[0].message.content);
      } catch (err) {
        console.warn("AI feedback skipped:", err.message);
      }
    }

    //  Final score
    const finalScore = Math.round(
      0.55 * wordMatch + 0.2 * pronunciation + 0.15 * fluency + 0.1 * (aiFeedback.relevance_score || 0)
    );

    res.json({
      topic,
      score: Math.max(0, Math.min(100, finalScore)),
      breakdown: {
        pronunciation,
        wordMatch,
        fluency,
        relevance: aiFeedback.relevance_score || 0,
      },
      feedback: aiFeedback,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "AI scoring failed" });
  }
});


// POST /api/speaking/correct
router.post("/correct", async (req, res) => {
  try {
    const referenceText = String(req.body?.referenceText || "");
    const transcript = String(req.body?.transcript || "");
    const parentLang = String(
  req.body?.parentLang ||
  req.body?.parentLangFromPractice ||
  "hi"
);

    const parentLanguageName = getParentLanguageName(parentLang);

    function postProcessCorrected(text = "") {
      let s = String(text || "").trim();
      s = s.replace(/\s+/g, " ");
      s = s.replace(/([.!?]\s*|^)([a-z])/g, (m, p1, ch) => `${p1}${ch.toUpperCase()}`);
      if (s && !/[.!?]$/.test(s)) s = s + ".";
      return s;
    }

    if (!OPENAI_KEY) {
      const suggested = referenceText ? referenceText : transcript;
      return res.json({
        corrected: postProcessCorrected(suggested),
        diffs: [],
        grammarHints: [],
        pronunciationTips: [],
      });
    }

    const prompt = `
You are a parent-friendly speaking coach.

Write grammarHints and pronunciationTips in ${parentLanguageName}.
But keep "corrected" in simple English (1-2 sentences).

Return JSON ONLY:
{
  "corrected": "1-2 simple correct sentences in English",
  "diffs": [
    { "expected":"", "actual":"", "matchPct": 0 }
  ],
  "grammarHints": ["max 3 tips in ${parentLanguageName}"],
  "pronunciationTips": ["max 3 tips in ${parentLanguageName}"]
}

Reference: """${referenceText}"""
Child: """${transcript}"""

Rules:
- Be encouraging.
- Keep tips short.
- If expected vs actual is unclear, keep diffs empty.
`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    let data = null;
    if (r?.choices?.[0]?.message?.content) {
      try {
        data =
          typeof r.choices[0].message.content === "object"
            ? r.choices[0].message.content
            : JSON.parse(r.choices[0].message.content);
      } catch (e) {
        console.warn("Failed to parse correction JSON", e);
      }
    }

    if (!data || typeof data.corrected !== "string") {
      const fallbackCorrected = referenceText || transcript || "";
      data = {
        corrected: postProcessCorrected(fallbackCorrected),
        diffs: [],
        grammarHints: [],
        pronunciationTips: [],
      };
    } else {
      data.corrected = postProcessCorrected(data.corrected);
    }

    return res.json(data);
  } catch (err) {
    console.error("correct error:", err);
    return res.status(500).json({ error: "Correction failed", detail: err?.message || String(err) });
  }
});

/* ----------------- Translate Forward ----------------- */
router.post("/translate/forward", async (req, res) => {
  try {
    let text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Missing text" });

    const rawTo = String(req.body?.to || req.body?.targetLang || "Hindi").trim();
    const codeToName = { hi: "Hindi", ta: "Tamil", te: "Telugu", en: "English", bn: "Bengali", ml: "Malayalam" };
    const to = codeToName[rawTo.toLowerCase()] || rawTo;

    if (!OPENAI_KEY) {
      console.warn("translate/forward: OPENAI_KEY missing on server");
      return res.status(500).json({ error: "Server: OPENAI_API_KEY not configured" });
    }

    const prompt = `Translate the following text into ${to}. Return only the translated text with no commentary:\n\n${text}`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.2,
    });

    const translatedRaw = (r?.choices?.[0]?.message?.content || "").trim();

    if (!translatedRaw) {
      console.error("translate/forward: empty result from provider", JSON.stringify(r?.choices || r?.error || r));
      return res.status(502).json({ error: "Empty translation from provider", provider: r });
    }

    return res.json({ translated: translatedRaw, detected: "auto", to });
  } catch (err) {
    console.error("translate/forward error:", err && err.message ? err.message : err);
    return res.status(500).json({
      error: "Translation API failed",
      detail: err?.message || String(err),
      provider: err?.response || null,
    });
  }
});

/* ----------------- TTS (OpenAI Audio) ----------------- */
// POST /api/learning/tts
router.post("/learning/tts", async (req, res) => {
  try {
    const text = String(req.body?.text || "");
    const lang = String(req.body?.lang || "en-IN");
    const pitch = Number(req.body?.pitch || 1);

    if (!text) return res.status(400).json({ error: "Missing text" });
    if (!OPENAI_KEY) {
      return res.status(501).json({
        error: "TTS not configured on server. Set OPENAI_API_KEY or use browser speechSynthesis.",
      });
    }

    try {
      const speechResp = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
      });

      const buffer = Buffer.from(await speechResp.arrayBuffer());
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", buffer.length);
      return res.send(buffer);
    } catch (err) {
      console.error("openai TTS call failed:", err);
      return res.status(502).json({ error: "TTS provider failed", detail: err?.message || String(err) });
    }
  } catch (err) {
    console.error("tts handler error:", err);
    return res.status(500).json({ error: "TTS failed", detail: err?.message || String(err) });
  }
});



// POST /api/speaking/practice-image/transcribe
router.post("/practice-image/transcribe", async (req, res) => {
  try {
    if (!req.files?.audio) {
      return res.status(400).json({ error: "Audio file missing" });
    }

    const audioFile = req.files.audio;

    // 1. save temp file
    const tempPath = path.join(
      __dirname,
      "..",
      "tmp_" + Date.now() + ".webm"
    );

    await audioFile.mv(tempPath);

    // 2. send file stream to Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
    });

    // 3. cleanup
    fs.unlink(tempPath, () => {});

    res.json({ text: transcription.text });
  } catch (err) {
    console.error("transcribe error:", err);
    res.status(500).json({ error: "Transcription failed" });
  }
});



module.exports = router;