const express = require("express");
const dotenv = require("dotenv");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(express.json());

// Init Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const visionModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const documentModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const GEMINI_MODEL = "gemini-2.5-flash";

// Multer memory storage supaya bisa ambil buffer
const upload = multer({ storage: multer.memoryStorage() });

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Gemini API server is running at http://localhost:${PORT}`);
});

//1. Generate text
app.post("/generate-text", async (req, res) => {
  const { prompt } = req.body;
  try {
    const result = await textModel.generateContent(prompt);
    res.json({ output: result.response.text() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

//2. Generate from image
app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  try {
    const { prompt } = req.body;
    const imageBase64 = req.file.buffer.toString("base64");

    const result = await visionModel.generateContent([{ text: prompt }, { inlineData: { mimeType: req.file.mimetype, data: imageBase64 } }]);

    res.json({ output: result.response.text() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

//3. Generate From Document
app.post("/generate-from-document", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Dokumen tidak ditemukan" });
    }

    const { prompt } = req.body;
    const docBase64 = req.file.buffer.toString("base64");

    // Panggil Gemini API
    const result = await textModel.generateContent([{ text: prompt || "Ringkas dokumen berikut:" }, { inlineData: { mimeType: req.file.mimetype, data: docBase64 } }]);

    res.json({ result: result.response.text() });
  } catch (err) {
    console.error("🔥 ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

//4.Generate From Audio
function extractText(resp) {
  return resp?.candidates?.[0]?.content?.parts?.[0]?.text || "No result";
}

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  try {
    const { prompt } = req.body;
    const audioBase64 = req.file.buffer.toString("base64");

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const resp = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: prompt || "Transkrip audio berikut:" }] },
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: audioBase64,
              },
            },
          ],
        },
      ],
    });

    res.json({ result: extractText(resp.response) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
