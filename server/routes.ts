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

      const transcribeParams: any = {
        file: file,
        model: "gpt-4o-mini-transcribe",
        prompt: prompt,
        temperature: temperature,
      };

      if (language !== "auto") {
        transcribeParams.language = language;
      }

      const response = await openai.audio.transcriptions.create(transcribeParams);

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

  app.post("/api/clarify", async (req, res) => {
    try {
      const { text, language } = req.body;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "No text provided" });
      }

      const langHint = language && language !== "auto" ? ` The text is in ${language} language.` : "";

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a text editor that fixes grammar, punctuation, and logical errors in transcribed speech. Keep the original meaning and language intact. Do not add new information or change the intent. Only fix grammar, spelling, punctuation, and sentence structure to make the text more readable.${langHint} Return only the corrected text without any explanation or extra commentary.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      });

      const clarified = response.choices[0]?.message?.content?.trim() || text;
      console.log(`[Clarify] Input: "${text.slice(0, 100)}..." -> Output: "${clarified.slice(0, 100)}..."`);
      res.json({ text: clarified });

    } catch (error: any) {
      console.error("[Clarify] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Clarification failed" });
    }
  });

  app.post("/api/summarize", async (req, res) => {
    try {
      const { text, language } = req.body;

      if (!text || typeof text !== "string" || text.trim().length < 20) {
        return res.status(400).json({ message: "Not enough transcript text to summarize" });
      }

      const langHint = language && language !== "auto" ? ` Respond in ${language} language.` : "";

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional meeting assistant. Analyze the provided meeting transcript and generate a structured report in markdown format. The report must contain the following sections:

## Summary
A concise overview of the entire meeting (2-4 sentences).

## Key Points
A bullet list of the most important topics discussed and decisions made.

## Goals
A bullet list of goals or objectives mentioned during the meeting.

## Action Items
A bullet list of specific tasks, assignments, or next steps to be taken. Include who is responsible if mentioned.

If a section has no relevant content, write "None identified." Keep the language professional and clear.${langHint}`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const summary = response.choices[0]?.message?.content?.trim() || "";
      console.log(`[Summarize] Generated summary for ${text.length} chars of transcript`);
      res.json({ summary });

    } catch (error: any) {
      console.error("[Summarize] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Summary generation failed" });
    }
  });

  return httpServer;
}
