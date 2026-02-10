import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import fs from "fs";
import OpenAI from "openai";
import { storage } from "./storage";

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
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
        return res.status(400).json({ message: "No file uploaded" });
      }

      const prompt = req.body.prompt || "";
      console.log(`Transcribing chunk. Prompt length: ${prompt.length}`);

      // We need to ensure the file has a recognizable extension for OpenAI API
      // Multer saves it without extension. We can rename it or just pass it as is if OpenAI accepts it.
      // OpenAI usually requires a filename with extension in the 'file' object.
      // Let's create a read stream with a mocked path.
      
      const fileStream = fs.createReadStream(req.file.path);

      try {
        const response = await openai.audio.transcriptions.create({
          file: fileStream,
          model: "gpt-4o-mini-transcribe",
          prompt: prompt, // Context to help with cut words
          language: "pl", // Assume Polish based on user prompt language, or let it auto-detect
        });

        // Clean up file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting temp file:", err);
        });

        const text = response.text;
        
        // Log it (optional)
        // await storage.logTranscription({ content: text });

        res.json({ text });
      } catch (openaiError: any) {
        console.error("OpenAI Error:", openaiError);
        res.status(500).json({ message: openaiError.message || "Transcription failed" });
      }

    } catch (error: any) {
      console.error("Server Error:", error);
      res.status(500).json({ message: error.message || "Internal Server Error" });
    }
  });

  return httpServer;
}
