const express = require("express");

const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const pdfParse = require("pdf-parse");
const db = require("../../db");
const OpenAI = require("openai");

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });



// --- Auth middleware ---
function auth(req, res, next) {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}


// --- Helpers ---
async function ocrImageToText(absPath) {
  const b64 = fs.readFileSync(absPath, { encoding: "base64" });

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are an OCR assistant. Return ONLY the plain text content. No preamble, no bullets, no headings.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract plain text from this image:" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      },
    ],
  });

  return (resp.choices[0].message.content || "").trim();
}

// STRICT title extractor (vision)
async function extractExactTitleFromImage(absPath) {
  try {
    const b64 = fs.readFileSync(absPath, { encoding: "base64" });

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return ONLY JSON: {\"title\": string, \"subtitle\": string|null, \"is_confident\": boolean}. " +
            "Copy the exact printed book title from the cover/spine. If uncertain, use title:\"\".",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the exact printed book title from this image." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
    });

    const data = JSON.parse(resp.choices[0].message.content || "{}");
    return (data.title || "").trim();
  } catch {
    return "";
  }
}

async function generateMetadataFromText(text) {
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Return STRICT JSON: {\"title\": string, \"title_exact_from_text\": string, \"category\": string, \"description\": string, \"quality\": \"High\"|\"Medium\"|\"Low\"}. " +
          "title_exact_from_text must be verbatim from the input text.",
      },
      { role: "user", content: "Analyze:\n\n" + (text || "").slice(0, 8000) },
    ],
  });

  let json;
  try {
    json = JSON.parse(resp.choices[0].message.content);
  } catch {
    const raw = resp.choices[0].message.content || "{}";
    json = JSON.parse(raw.replace(/```json|```/g, ""));
  }

  return {
    title: json.title || "Untitled Resource",
    title_exact_from_text: json.title_exact_from_text || "",
    category: json.category || "General",
    description: json.description || "No description available.",
    quality: ["High", "Medium", "Low"].includes(json.quality) ? json.quality : "Medium",
  };
}

async function classifyEducationalWithModel({ title, category, description, extractedText }) {
  try {
    const promptSystem =
      `You are a strict classifier. Answer JSON: {"isEducational": boolean, "reason": string}. ` +
      `True only for clear study resources.`;

    const userContent =
      `title: ${title || ""}\ncategory: ${category || ""}\n` +
      `description: ${description || ""}\n\n` +
      `extractedText (first 2000 chars):\n${(extractedText || "").slice(0, 2000)}`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: promptSystem },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.0,
    });

    const raw = resp.choices[0].message.content;
    let json;
    try {
      json = typeof raw === "object" ? raw : JSON.parse(raw);
    } catch {
      return { ok: null, reason: "non_json_response", modelResult: raw };
    }

    if (typeof json.isEducational === "boolean") {
      return { ok: json.isEducational, reason: json.reason || "", modelResult: json };
    }

    return { ok: null, reason: "unexpected_format", modelResult: json };
  } catch (err) {
    return { ok: null, reason: "classifier_error", error: err?.message || String(err) };
  }
}

// --- AI-powered Upload Route (Cloudinary + express-fileupload) ---
router.post("/upload", async (req, res) => {
  let absPath = null;

  try {
    // ✅ 0) Check file exists
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imageFile = req.files.image;

    // ✅ 1) Prepare uploads directory
    const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const safeName = imageFile.name
      .replace(/\\/g, "")
      .replace(/\//g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");

    const filename = `${Date.now()}-${safeName}`;
    absPath = path.join(UPLOADS_DIR, filename);

    // ✅ 2) Move uploaded file
    await imageFile.mv(absPath);

    const mime = imageFile.mimetype;

    // ✅ 3) Extract text (OCR or PDF)
    let extractedText = "";
    let pdfInfoTitle = "";

    if (mime.startsWith("image/")) {
      extractedText = await ocrImageToText(absPath);
    } else if (mime === "application/pdf") {
      const dataBuffer = fs.readFileSync(absPath);
      const parsed = await pdfParse(dataBuffer);
      extractedText = (parsed.text || "").trim();
      pdfInfoTitle = parsed?.info?.Title
        ? String(parsed.info.Title).trim()
        : "";
    }

    // ✅ 4) Generate metadata
    const details = await generateMetadataFromText(extractedText || "");

    if (details.quality?.toLowerCase() === "low") {
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
      return res.status(400).json({
        error: "Low quality resource",
        reason: "low_quality",
      });
    }

    // ✅ 5) Determine final title
    let finalTitle = (details.title_exact_from_text || "").trim();

    if (!finalTitle && pdfInfoTitle) finalTitle = pdfInfoTitle;

    if (!finalTitle && mime.startsWith("image/")) {
      const fromImage = await extractExactTitleFromImage(absPath);
      if (fromImage) finalTitle = fromImage;
    }

    if (!finalTitle || finalTitle.length < 3 || finalTitle.length > 120) {
      finalTitle = (details.title || "Untitled Resource").trim();
    }

    // ✅ 6) Classify educational
    const classifier = await classifyEducationalWithModel({
      title: finalTitle,
      category: details.category,
      description: details.description,
      extractedText,
    });

    if (classifier.ok !== true) {
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);

      return res.status(400).json({
        error:
          classifier.ok === false
            ? "Uploaded image is not recognized as an educational item."
            : "Classifier failure or ambiguous result.",
        reason:
          classifier.reason ||
          (classifier.modelResult &&
            JSON.stringify(classifier.modelResult)) ||
          "classifier_error",
      });
    }
    ;

    const baseUrl =
  process.env.NODE_ENV === "production"
    ? "https://grownest-backend-j3ny.onrender.com"
    : "http://localhost:5000";

const imageUrl = `${baseUrl}/uploads/${filename}`;




    // ✅ 9) Save to DB
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO uploads 
        (user_id, filename, title, category, description, quality, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        1, // 🔥 hackathon mode (no auth user)
        imageUrl,
        finalTitle,
        details.category,
        details.description,
        details.quality,
        now
      );

    // ✅ 10) Respond
    res.json({
      success: true,
      id: info.lastInsertRowid,
      imageUrl,
      title: finalTitle,
      category: details.category,
      description: details.description,
      quality: details.quality,
      extractedText,
    });

  } catch (err) {
    console.error("❌ Upload AI error:", err);
    res.status(500).json({ error: err.message || "Upload failed" });
  } 
});





module.exports = router;