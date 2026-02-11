import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import fs from "fs";
import OpenAI, { toFile } from "openai";

const defaultOpenai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
});

function getOpenAI(req: { headers: Record<string, any> }): OpenAI {
  const userKey = req.headers["x-openai-key"];
  if (userKey && typeof userKey === "string" && userKey.trim()) {
    return new OpenAI({ apiKey: userKey.trim() });
  }
  return defaultOpenai;
}

async function readUploadedAudio(file: Express.Multer.File) {
  const buffer = await fs.promises.readFile(file.path);
  const name = file.originalname || "audio.wav";
  const mime = file.mimetype || "audio/wav";
  const ext = name.includes(".") ? name.split(".").pop() : (mime.includes("webm") ? "webm" : "wav");
  const type = mime.startsWith("audio/") ? mime : "audio/wav";
  return toFile(buffer, `audio.${ext}`, { type });
}

function cleanupTempFile(path?: string) {
  if (path) fs.unlink(path, () => {});
}

async function chatCompletion(openai: OpenAI, systemPrompt: string, userText: string, options?: { temperature?: number; max_tokens?: number }) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText },
    ],
    temperature: options?.temperature ?? 0.3,
    ...(options?.max_tokens ? { max_tokens: options.max_tokens } : {}),
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/transcribe", upload.single("file"), async (req, res) => {
    const tempFilePath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const prompt = req.body.prompt || "";
      const language = req.body.language || "pl";
      const temperature = req.body.temperature !== undefined ? parseFloat(req.body.temperature) : 0;
      const model = req.body.model || "gpt-4o-mini-transcribe";

      console.log(`[Transcribe] Chunk received: ${req.file.size} bytes, lang=${language}, temp=${temperature}, model=${model}, prompt=${prompt ? `"${prompt.slice(0, 80)}..."` : "(none)"}`);

      const file = await readUploadedAudio(req.file);
      const transcribeParams: any = { file, model, prompt, temperature };
      if (language !== "auto") transcribeParams.language = language;

      const openai = getOpenAI(req);
      const response = await openai.audio.transcriptions.create(transcribeParams);

      console.log(`[Transcribe] Result: "${response.text}"`);
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("[Transcribe] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Transcription failed" });
    } finally {
      cleanupTempFile(tempFilePath);
    }
  });

  app.post("/api/transcribe-diarize", upload.single("file"), async (req, res) => {
    const tempFilePath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const language = req.body.language || "pl";
      console.log(`[Diarize] Chunk received: ${req.file.size} bytes, lang=${language}`);

      const file = await readUploadedAudio(req.file);
      const transcribeParams: any = {
        file,
        model: "gpt-4o-transcribe-diarize",
        response_format: "diarized_json",
        chunking_strategy: "auto",
      };
      if (language !== "auto") transcribeParams.language = language;

      const openai = getOpenAI(req);
      const response: any = await openai.audio.transcriptions.create(transcribeParams);

      type DiarizedSegment = { speaker: string; text: string; start: number; end: number };
      const diarizedSegments: DiarizedSegment[] = [];

      for (const seg of response.segments || []) {
        const text = (seg.text || "").trim();
        if (text) {
          diarizedSegments.push({
            speaker: seg.speaker || "A",
            text,
            start: seg.start || 0,
            end: seg.end || 0,
          });
        }
      }

      if (diarizedSegments.length === 0 && response.text) {
        diarizedSegments.push({ speaker: "A", text: response.text.trim(), start: 0, end: 0 });
      }

      const plainText = diarizedSegments.map((s) => s.text).join(" ");
      console.log(`[Diarize] Result: ${diarizedSegments.length} segments, text: "${plainText.slice(0, 100)}..."`);
      res.json({ segments: diarizedSegments, text: plainText });
    } catch (error: any) {
      console.error("[Diarize] Error:", error.message || error);
      const msg = error.message || "Diarized transcription failed";
      if (msg.includes("404") || msg.includes("deployment") || msg.includes("does not exist")) {
        res.status(422).json({
          message: "The speaker diarization model (gpt-4o-transcribe-diarize) is not available through the current API provider. Please disable diarization in settings.",
          code: "MODEL_NOT_AVAILABLE",
        });
      } else {
        res.status(500).json({ message: msg });
      }
    } finally {
      cleanupTempFile(tempFilePath);
    }
  });

  app.post("/api/clarify", async (req, res) => {
    try {
      const { text, language } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "No text provided" });
      }

      const langHint = language && language !== "auto" ? ` The text is in ${language} language.` : "";
      const systemPrompt = `You are a text editor that fixes grammar, punctuation, and logical errors in transcribed speech. Keep the original meaning and language intact. Do not add new information or change the intent. Only fix grammar, spelling, punctuation, and sentence structure to make the text more readable.${langHint} Return only the corrected text without any explanation or extra commentary.`;

      const openai = getOpenAI(req);
      const clarified = await chatCompletion(openai, systemPrompt, text) || text;

      console.log(`[Clarify] Input: "${text.slice(0, 100)}..." -> Output: "${clarified.slice(0, 100)}..."`);
      res.json({ text: clarified });
    } catch (error: any) {
      console.error("[Clarify] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Clarification failed" });
    }
  });

  app.post("/api/translate", async (req, res) => {
    try {
      const { text, targetLanguage, sourceLanguage } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "No text provided" });
      }
      if (!targetLanguage || typeof targetLanguage !== "string") {
        return res.status(400).json({ message: "No target language provided" });
      }

      const sourceLangHint = sourceLanguage && sourceLanguage !== "auto" ? ` The source text is in ${sourceLanguage}.` : "";
      const systemPrompt = `You are a professional translator. Translate the following text to ${targetLanguage}.${sourceLangHint} Preserve the original meaning, tone, and formatting. Return only the translated text without any explanation, commentary, or notes.`;

      const openai = getOpenAI(req);
      const translated = await chatCompletion(openai, systemPrompt, text) || text;

      console.log(`[Translate] "${text.slice(0, 60)}..." -> "${translated.slice(0, 60)}..." (to ${targetLanguage})`);
      res.json({ text: translated });
    } catch (error: any) {
      console.error("[Translate] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Translation failed" });
    }
  });

  app.post("/api/summarize", async (req, res) => {
    try {
      const { text, language, customPrompt } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 20) {
        return res.status(400).json({ message: "Not enough transcript text to summarize" });
      }

      const langHint = language && language !== "auto" ? ` Respond in ${language} language.` : "";
      const defaultPrompt = `You are a professional meeting assistant. Analyze the provided meeting transcript and generate a structured report in markdown format. The report must contain the following sections:

## Summary
A concise overview of the entire meeting (2-4 sentences).

## Key Points
A bullet list of the most important topics discussed and decisions made.

## Goals
A bullet list of goals or objectives mentioned during the meeting.

## Action Items
A bullet list of specific tasks, assignments, or next steps to be taken. Include who is responsible if mentioned.

If a section has no relevant content, write "None identified." Keep the language professional and clear.`;

      const systemPrompt = (customPrompt && typeof customPrompt === "string" && customPrompt.trim())
        ? customPrompt.trim() + langHint
        : defaultPrompt + langHint;

      const openai = getOpenAI(req);
      const summary = await chatCompletion(openai, systemPrompt, text, { max_tokens: 2000 });

      console.log(`[Summarize] Generated summary for ${text.length} chars of transcript`);
      res.json({ summary });
    } catch (error: any) {
      console.error("[Summarize] Error:", error.message || error);
      res.status(500).json({ message: error.message || "Summary generation failed" });
    }
  });

  return httpServer;
}
