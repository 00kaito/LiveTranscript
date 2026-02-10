import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import { storage } from "./storage";

// Configure OpenAI
// This uses Replit AI Integrations which don't require a manual API key.
// The environment variables AI_INTEGRATIONS_OPENAI_API_KEY and AI_INTEGRATIONS_OPENAI_BASE_URL
// are automatically provided by the integration.
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Configure Multer for temporary file storage
const upload = multer({ dest: "uploads/" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        console.error("No file in request");
        return res.status(400).json({ message: "No file uploaded" });
      }

      const prompt = req.body.prompt || "";
      console.log(`Transcribing chunk: ${req.file.path}, size: ${req.file.size} bytes`);

      // Create a read stream from the temporary file
      const fileStream = fs.createReadStream(req.file.path);

      try {
        const response = await openai.audio.transcriptions.create({
          file: fileStream,
          model: "gpt-4o-mini-transcribe",
          prompt: prompt,
          language: "pl",
        });

        // Clean up temp file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });

        res.json({ text: response.text });
      } catch (openaiError: any) {
        console.error("OpenAI Transcription Error:", openaiError);
        // Clean up temp file even on error
        fs.unlink(req.file.path, () => {});
        res.status(500).json({ message: openaiError.message || "Transcription failed" });
      }

    } catch (error: any) {
      console.error("Server Transcription Route Error:", error);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });

  return httpServer;
}
