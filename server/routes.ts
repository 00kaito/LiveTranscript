import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI, { toFile } from "openai";
import { storage } from "./storage";

// Configure OpenAI
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
    let tempFilePath: string | undefined;
    try {
      if (!req.file) {
        console.error("No file in request");
        return res.status(400).json({ message: "No file uploaded" });
      }

      tempFilePath = req.file.path;
      const prompt = req.body.prompt || "";
      console.log(`Transcribing chunk: ${tempFilePath}, size: ${req.file.size} bytes`);

      // OpenAI requires a filename with a supported extension (e.g., .webm, .wav, .mp3)
      // to correctly identify the file format. Multer's default temp filenames have no extension.
      const buffer = await fs.promises.readFile(tempFilePath);
      const file = await toFile(buffer, "audio.webm");

      try {
        const response = await openai.audio.transcriptions.create({
          file: file,
          model: "gpt-4o-mini-transcribe",
          prompt: prompt,
          language: "pl",
        });

        res.json({ text: response.text });
      } catch (openaiError: any) {
        console.error("OpenAI Transcription Error:", openaiError);
        res.status(500).json({ message: openaiError.message || "Transcription failed" });
      }

    } catch (error: any) {
      console.error("Server Transcription Route Error:", error);
      res.status(500).json({ message: error.message || "Internal Server Error" });
    } finally {
      // Clean up temp file in finally block to ensure it's always deleted
      if (tempFilePath) {
        fs.unlink(tempFilePath, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });
      }
    }
  });

  return httpServer;
}
