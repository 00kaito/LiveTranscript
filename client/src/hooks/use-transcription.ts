import { useMutation } from "@tanstack/react-query";

type TranscribeInput = {
  audioBlob: Blob;
  prompt?: string;
  language?: string;
  temperature?: number;
  apiKey?: string;
  model?: string;
};

type TranscribeResult = {
  text: string;
};

export type DiarizedSegment = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

type DiarizeInput = {
  audioBlob: Blob;
  language?: string;
  apiKey?: string;
};

type DiarizeResult = {
  segments: DiarizedSegment[];
  text: string;
};

export function useTranscribeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, prompt, language, temperature, apiKey, model }: TranscribeInput): Promise<TranscribeResult> => {
      const formData = new FormData();
      const ext = audioBlob.type.includes("webm") ? "webm" : "wav";
      formData.append("file", audioBlob, `audio.${ext}`);
      
      if (prompt) {
        formData.append("prompt", prompt);
      }
      if (language) {
        formData.append("language", language);
      }
      if (temperature !== undefined) {
        formData.append("temperature", String(temperature));
      }
      if (model) {
        formData.append("model", model);
      }

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-OpenAI-Key"] = apiKey;
      }

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Transcription failed";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      return data as TranscribeResult;
    },
  });
}

export class DiarizeModelError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export function useDiarizeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, language, apiKey }: DiarizeInput): Promise<DiarizeResult> => {
      const formData = new FormData();
      const dExt = audioBlob.type.includes("webm") ? "webm" : "wav";
      formData.append("file", audioBlob, `audio.${dExt}`);

      if (language) {
        formData.append("language", language);
      }

      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["X-OpenAI-Key"] = apiKey;
      }

      const res = await fetch("/api/transcribe-diarize", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Diarized transcription failed";
        let errorCode = "";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
          errorCode = errorData.code || "";
        } catch {}
        if (errorCode === "MODEL_NOT_AVAILABLE") {
          throw new DiarizeModelError(errorMessage, errorCode);
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      return data as DiarizeResult;
    },
  });
}
