const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const fetch = require("node-fetch");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Simple post-processor to remove LaTeX delimiters and convert simple \frac{a}{b} to "a/b (decimal)"
function cleanMathOutput(text) {
  if (!text) return text;
  // remove common LaTeX delimiters
  text = text.replace(/\\\(|\\\)|\\\[|\\\]|\\\$/g, "");
  text = text.replace(/\$\$/g, "");
  // remove remaining backslashes
  text = text.replace(/\\+/g, "");
  // convert simple \frac{a}{b} to "a/b (decimal)"
  text = text.replace(/\\frac\s*\{\s*([+-]?\d+(?:\.\d+)?)\s*\}\s*\{\s*([+-]?\d+(?:\.\d+)?)\s*\}/g, (m, a, b) => {
    try {
      const num = parseFloat(a), den = parseFloat(b);
      if (isFinite(num) && isFinite(den) && den !== 0) {
        const dec = num / den;
        const decStr = Number.isInteger(dec) ? String(dec) : dec.toFixed(6).replace(/\.?0+$/, "");
        return `${a}/${b} (${decStr})`;
      }
    } catch (e) {}
    return `${a}/${b}`;
  });
  // strip environments and leftover single-dollar wrappers
  text = text.replace(/\\begin\{.*?\}[\s\S]*?\\end\{.*?\}/g, "");
  text = text.replace(/\$\s*([\s\S]*?)\s*\$/g, "$1");
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

// Simple word-level Jaccard similarity for checking overlap
function wordSimilarity(a = "", b = "") {
  const normalize = (s) =>
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  const A = new Set(normalize(a));
  const B = new Set(normalize(b));
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}


// === Generate Q&A ===
router.post("/qa", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Generate question-answer pairs." },
        { role: "user", content: text }
      ],
    });
    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Fill in the Blanks ===
router.post("/fill-blanks", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Convert text into fill-in-the-blanks." },
        { role: "user", content: text }
      ],
    });
    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === MCQs ===
router.post("/mcq", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Generate 3 MCQs with options + correct answers." },
        { role: "user", content: text }
      ],
    });
    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Summarize ===
router.post("/summary", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Summarize this text clearly." },
        { role: "user", content: text }
      ],
    });
    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Highlight Key Terms ===
router.post("/highlight", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Extract and highlight important keywords from this text." },
        { role: "user", content: text }
      ],
    });
    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Analyze Uploaded Image===
router.post("/analyze",  async (req, res) => {
  try {
    const fs = require("fs");
    if (!req.files || !req.files.file) {
  return res.status(400).json({ error: "No file uploaded." });
}

const uploadedFile = req.files.file;
const filePath = uploadedFile.tempFilePath;

    const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Vision-capable
      messages: [
        {
          role: "system",
          content:
            "You are an OCR assistant. Extract only the plain text from the image. Do not add explanations, do not say 'Here is the text', do not add bullets. Just return the raw text exactly as seen, in readable paragraphs."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract and return only the plain text from this image:" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
          ]
        }
      ]
    });

    res.json({ result: response.choices[0].message.content?.trim() || "No text detected." });
  } catch (err) {
    console.error("❌ Image analyze error:", err);
    res.status(500).json({ error: err.message });
  }
});



// === Generate Similar Questions ===
router.post("/similar", async (req, res) => {
  try {
    const { text } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Given a question, generate 3 to 5 similar practice questions without answers." },
        { role: "user", content: text }
      ],
    });
    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Translation ===
router.post("/translate", async (req, res) => {
  try {
    const { text, targetLang } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful translator. Translate the following text into ${targetLang}. Return only the translated text without explanations.`
        },
        { role: "user", content: text }
      ],
    });

    res.json({ result: response.choices[0].message.content });
  } catch (err) {
    console.error("❌ Translation error:", err);
    res.status(500).json({ error: err.message });
  }
});
// === Text-to-Speech ===
router.post("/tts", async (req, res) => {
  try {
    const { text } = req.body;

    const response = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",  // options: alloy, verse, coral, sage
      input: text,
    });

    // Convert response to audio buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    console.error("❌ TTS error:", err);
    res.status(500).json({ error: err.message });
  }
});
// === AI-Powered Book Recommendations with OpenLibrary cover lookup ===
router.post("/recommend-books", async (req, res) => {
  try {
    const { text = "", maxResults = 6 } = req.body;
    if (!text || !text.trim()) return res.json({ result: [] });

    console.log(">>> AI Book Recommendation - starting");

    // Build prompt for OpenAI
    const prompt = `
You are an educational book recommender for parents and learners.
Based on the following text, suggest up to ${maxResults} relevant books.
For each book return JSON with: title, authors (array), description (short), reason (1 line).
Return STRICT JSON array only.

Text:
"""${text.slice(0, 1000)}"""
    `;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful book recommendation assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    let raw = completion.choices?.[0]?.message?.content || "[]";
    let booksArr = [];

    // Try to parse JSON from the model output
    try {
      booksArr = JSON.parse(raw);
    } catch (err) {
      console.warn("AI output not strict JSON. Attempting to extract JSON array...");
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          booksArr = JSON.parse(match[0]);
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e);
          booksArr = [];
        }
      } else {
        booksArr = [];
      }
    }

    if (!Array.isArray(booksArr)) booksArr = [];

    // Normalize shape
    const normalized = booksArr.slice(0, Math.min(Number(maxResults) || 6, 20)).map((b) => ({
      title: (b.title || "").trim(),
      authors: Array.isArray(b.authors) ? b.authors : (b.authors ? [b.authors] : []),
      description: b.description || b.reason || "",
      reason: b.reason || "",
      thumbnail: null, // will attempt to fill below
      infoLink: b.infoLink || null,
    }));

    // Helper: try OpenLibrary to find a cover id by title+author
    const findOpenLibraryCover = async (title, authors = []) => {
      try {
        const q = encodeURIComponent(`${title} ${authors.join(" ")}`.trim());
        const url = `https://openlibrary.org/search.json?q=${q}&limit=1`;
        const r = await fetch(url);
        if (!r.ok) return null;
        const j = await r.json();
        if (Array.isArray(j.docs) && j.docs.length > 0 && j.docs[0].cover_i) {
          return `https://covers.openlibrary.org/b/id/${j.docs[0].cover_i}-M.jpg`;
        }
        return null;
      } catch (err) {
        console.warn("OpenLibrary cover lookup error:", err);
        return null;
      }
    };

    // For each normalized book, try to get a thumbnail from OpenLibrary in parallel
    const withCovers = await Promise.all(
      normalized.map(async (bk) => {
        if (!bk.title) return { ...bk, thumbnail: null };
        const cover = await findOpenLibraryCover(bk.title, bk.authors || []);
        return { ...bk, thumbnail: cover || null };
      })
    );

    // Final result: keep thumbnail null if not found (frontend will use placeholder)
    console.log(`>>> /recommend-books returning ${withCovers.length} items (covers attempted)`);
    res.json({ result: withCovers });
  } catch (err) {
    console.error("recommend-books error:", err);
    res.status(500).json({ error: "Failed to generate book suggestions" });
  }
});


// === Flashcards Quiz Mode (Memory-oriented, JSON output) ===
router.post("/flashcards", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "⚠️ Please provide some input text." });
    }

    const systemPrompt = `
You are a flashcard and memory coach. From the given text, create EXACTLY 10 flashcards in a STRICT JSON array.
Each flashcard must be an object with these keys:
{
  "type": "mcq" | "fill" | "qa",
  "question": string,
  "options"?: [string, string, string, string],  // only for mcq
  "answer": string,
  "keywords": [string, ...],    // 1-3 short keywords to aid memory practice (required)
  "hint"?: string               // optional one-line mnemonic or hint (max 10-12 words)
}

Rules:
- For MCQs include 4 options with exactly one correct answer.
- For Fill cards, use a clear blank '_____' in the question.
- For QA, keep the answer short (1-2 sentences).
- Keywords must be short single words or short phrases (no more than 3 words each).
- Hints should be extremely short (max 12 words) and aimed for quick recall.
- Return ONLY a valid JSON array (no markdown, no explanations, no extra text).
- If any card cannot include keywords naturally, still include the best 1 keyword possible.
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      temperature: 0.6,
    });

    let raw = response.choices?.[0]?.message?.content || "[]";
    let cards = [];

    // Try to parse JSON strictly; if it fails, extract the first JSON array substring.
    try {
      cards = JSON.parse(raw);
    } catch (err) {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          cards = JSON.parse(match[0]);
        } catch (e) {
          console.error("Failed to parse extracted JSON:", e);
          return res.status(500).json({ error: "Invalid JSON from model" });
        }
      } else {
        return res.status(500).json({ error: "Model did not return JSON array" });
      }
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(500).json({ error: "Model did not return flashcards" });
    }

    // Normalize & enforce schema for safety
    const normalized = cards.slice(0, 10).map((c, idx) => ({
      type: c.type === "mcq" || c.type === "fill" || c.type === "qa" ? c.type : "qa",
      question: (c.question || "").toString().trim(),
      options: Array.isArray(c.options) ? c.options.slice(0, 4).map(String) : undefined,
      answer: (c.answer || "").toString().trim(),
      keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 3).map(String) : [],
      hint: c.hint ? c.hint.toString().trim() : undefined,
      _sourceIndex: idx // optional for tracing
    }));

    // Minimal validation: each card must have question, answer, and at least one keyword
    const invalid = normalized.find((c) => !c.question || !c.answer || !Array.isArray(c.keywords) || c.keywords.length === 0);
    if (invalid) {
      // Return what we have but warn
      console.warn("Some flashcards missing required fields; returning best-effort output.");
    }

    res.json({ result: normalized });
  } catch (err) {
    console.error("❌ Flashcards API error:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Math section OCR analyze (separate route to avoid touching other sections) ===
router.post("/analyze-math", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }
const uploadedFile = req.files.file;
    const filePath = uploadedFile.tempFilePath;
    const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });

    // Use the same model call you already use for OCR
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an OCR assistant. Extract only the plain text from the image. Return only the raw readable text (no commentary)."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract and return only the plain text from this image:" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
          ]
        }
      ],
      temperature: 0,
      max_tokens: 1200,
    });

    const extracted = response.choices?.[0]?.message?.content?.trim() || "";

    // cleanup uploaded temp file
    try { fs.unlinkSync(filePath); } catch (e) {}

    return res.json({ result: extracted || "No text detected." });
  } catch (err) {
    console.error("❌ Math analyze error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// -------------------- Math Tutor (supports teacher pattern as text or image) --------------------
router.post("/math-tutor",async (req, res) => {
  try {
    const text = (req.body && req.body.text) ? req.body.text : "";
    const modeNormalized = (req.body && req.body.mode) ? req.body.mode : "alternative"; // "teacher" or "alternative"
    let teacherPattern = (req.body && req.body.teacherPattern) ? req.body.teacherPattern : "";

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "⚠️ Please provide a math problem." });
    }

    // If teacher pattern image was uploaded in this request, OCR it and append
   // REPLACE THIS BLOCK COMPLETELY
if (req.files && req.files.file) {
  const uploadedFile = req.files.file;
  const filePath = uploadedFile.tempFilePath;

  const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });

  const analyzeResp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are an OCR assistant. Extract only the plain text (teacher pattern) from the image."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract teacher pattern text from this image:" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
        ]
      }
    ],
    temperature: 0,
    max_tokens: 1200
  });

  const extracted = analyzeResp.choices?.[0]?.message?.content?.trim() || "";
  if (extracted) {
    teacherPattern = `${teacherPattern}\n${extracted}`.trim();
  }
}


    // If teacher mode is requested, teacherPattern must exist
    if (modeNormalized === "teacher") {
      if (!teacherPattern || !teacherPattern.trim()) {
        return res.status(400).json({ error: "⚠️ Teacher pattern required for mode 'teacher'." });
      }

      // teacher system prompt (follows exactly)
      const systemPrompt = `
You are a math tutor who MUST follow the TEACHER PATTERN exactly.
The user-provided TEACHER PATTERN below defines the step order, numbering, and phrasing.
When solving in teacher mode:
- Follow the teacher's step headings, order, numbering and level of detail.
- Use the same structure and notation where possible.
- Do NOT introduce alternate methods or additional sections.
- Use plain text and this format:
Step 1: ...
Step 2: ...
Final Answer: ...
Return only the solution text (no extra commentary).

Teacher Pattern:
"""${teacherPattern.trim()}"""
`.trim();

      const chatResp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text }
        ],
        temperature: 0.2,
        max_tokens: 900,
      });

      let resultText = chatResp.choices?.[0]?.message?.content || "";
      resultText = resultText.trim();
      if (!resultText) return res.status(500).json({ error: "Model did not return a solution." });

      // Optionally clean LaTeX from teacher too if desired:
      // resultText = cleanMathOutput(resultText);

      return res.json({ result: resultText });
    }

    // --------- Alternative mode (strict, do NOT copy teacher) ----------
    // Build a strict alternative prompt WITHOUT the teacherPattern reference
    const altSystemPrompt = `
You are a math tutor who must provide an ALTERNATIVE solution method.
The user provided a teacher's pattern separately — DO NOT follow, quote, or copy it.
Give a clear, different approach with 3-8 numbered steps.

MANDATORY:
- Do NOT use LaTeX, math delimiters, code blocks, or markdown.
- Do NOT output any of these tokens: "\\(", "\\)", "\\[", "\\]", "$$", "\\frac".
- Use only plain readable text. Use "Step 1: ...", "Step 2: ..." and finish with "Final Answer: ...".
- For fractions, write them as "15/4" or as a decimal "3.75".
- Do NOT reuse the teacher's phrasing, numbering, or step order. Use a different method or re-order steps.
- Return only the solution text (no commentary, no headings).
`.trim();

    // helper to call model
    const makeChatCall = async (systemContent, temperature = 0.6) => {
      const chatResp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: text }
        ],
        temperature,
        max_tokens: 900,
      });
      return (chatResp.choices?.[0]?.message?.content || "").trim();
    };

    // First attempt
    let altResult = await makeChatCall(altSystemPrompt, 0.6);
    if (!altResult) return res.status(500).json({ error: "Model did not return a solution." });

    // Clean output
    altResult = cleanMathOutput(altResult);

    // If teacher pattern exists check similarity (avoid copying teacher pattern)
    const simThreshold = 0.45; // tune as needed
    let similarityScore = 0;
    if (teacherPattern) {
      similarityScore = wordSimilarity(teacherPattern, altResult);
    }

    // If too similar, retry once with stronger regeneration instructions
    if (similarityScore > simThreshold) {
      console.warn(`Alternative too similar (score=${similarityScore}). Regenerating with stronger prompt.`);
      const strongerAlt = altSystemPrompt + "\n\nREGENERATE: The previous answer was too similar to the teacher's method. Now produce a completely different method. Do NOT reuse teacher wording or step order.";
      let alt2 = await makeChatCall(strongerAlt, 0.9);
      alt2 = cleanMathOutput(alt2);
      altResult = alt2 || altResult;
    }

    altResult = (altResult || "").trim();
    if (!altResult) return res.status(500).json({ error: "Model did not return an alternative solution." });

    return res.json({ result: altResult });
  } catch (err) {
    console.error("❌ Math tutor error:", err);
    return res.status(500).json({ error: err.message });
  }
});


// === Math Tutor: Generate Similar Questions ===
router.post("/math-similar", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "⚠️ Please provide a math problem." });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a math practice generator. From the given math problem, generate 5 similar problems of the same type. " +
            "Only return the problems, numbered 1 to 5. Do not include solutions, explanations, or extra text."
        },
        { role: "user", content: text },
      ],
      temperature: 0.7,
    });

    res.json({ result: response.choices[0].message.content.trim() });
  } catch (err) {
    console.error("❌ Math similar error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Typed explain — stricter "same language" and non-story enforcement
router.post("/explain", async (req, res) => {
  try {
    const { text, style = "simple", targetLang = "English" } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "⚠️ Please provide input text to explain." });
    }

    // Make style explicit (examples: "simple", "bullet", "summary", "technical")
    // Default is "simple" so we don't accidentally ask for a story.
    const prompt = `
You are a friendly teacher and an explanation-only assistant.
Follow ALL rules below exactly:

1) LANGUAGE: Write ONLY in ${targetLang}. Use the native script of ${targetLang} (no transliteration).
2) TONE & CONTENT: Explain the user's text in plain, simple, factual language. Do NOT create a story, narrative, fictional example, or anecdote unless the user explicitly asked for an example.
3) STYLE: Produce a ${style} explanation — short, clear, and practical.
4) FORMAT: Return exactly 3–6 short paragraphs. Each paragraph should be 1–2 short sentences. Do NOT include headings, bullet lists, metadata, extra commentary, or translation notes.
5) LENGTH: Keep it concise and focused on understanding (no long introductions).
6) OUTPUT: Return ONLY the explanation text (no labels like "Explanation:" and no additional JSON).

DO NOT break these rules. If the user's text is already short, still follow the paragraph and sentence limits.
`.trim();

    // Debug: log prompt and user text (remove or reduce in production)
    console.debug("Explain prompt:", prompt);
    console.debug("User text:", text);

    const chatResp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
      temperature: 0.2,   // lower temperature => less creative/storylike answers
      max_tokens: 800,
    });

    const explanation = (chatResp.choices?.[0]?.message?.content || "").trim();
    console.debug("Model explanation:", explanation);

    if (!explanation) return res.status(500).json({ error: "Model did not return an explanation." });

    const ttsResp = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: explanation,
    });
    const audioBase64 = Buffer.from(await ttsResp.arrayBuffer()).toString("base64");

    res.json({ result: { text: explanation, audio: audioBase64 } });
  } catch (err) {
    console.error("❌ Explain error:", err);
    res.status(500).json({ error: err.message });
  }
});




module.exports = router;