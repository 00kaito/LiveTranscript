import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import OpenAI, { toFile } from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    let tempFilePath: string | undefined;
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      tempFilePath = req.file.path;
      const prompt = req.body.prompt || "";
      const language = req.body.language || "pl";
      const temperature = req.body.temperature !== undefined
        ? parseFloat(req.body.temperature)
        : 0;
      console.log(`[Transcribe] Chunk received: ${req.file.size} bytes, lang=${language}, temp=${temperature}`);

      const buffer = await fs.promises.readFile(tempFilePath);
      const file = await toFile(buffer, "audio.wav", { type: "audio/wav" });

      const response = await openai.audio.transcriptions.create({
        file: file,
        model: "gpt-4o-mini-transcribe",
        prompt: prompt,
        language: language,
        temperature: temperature,
      });

      console.log(`[Transcribe] Result: "${response.text}"`);
      res.json({ text: response.text });

    } catch (error: any) {
      console.error("[Transcribe] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Transcription failed" });
    } finally {
      if (tempFilePath) {
        fs.unlink(tempFilePath, () => {});
      }
    }
  });

  return httpServer;
}
