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

function getAudioFileName(blob: Blob): string {
  const ext = blob.type.includes("webm") ? "webm" : "wav";
  return `audio.${ext}`;
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (apiKey) headers["X-OpenAI-Key"] = apiKey;
  return headers;
}

async function fetchWithError<T>(url: string, options: RequestInit, fallbackMessage: string): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    let errorMessage = fallbackMessage;
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

  return res.json() as Promise<T>;
}

export class DiarizeModelError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export function useTranscribeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, prompt, language, temperature, apiKey, model }: TranscribeInput): Promise<TranscribeResult> => {
      const formData = new FormData();
      formData.append("file", audioBlob, getAudioFileName(audioBlob));
      if (prompt) formData.append("prompt", prompt);
      if (language) formData.append("language", language);
      if (temperature !== undefined) formData.append("temperature", String(temperature));
      if (model) formData.append("model", model);

      return fetchWithError<TranscribeResult>(
        "/api/transcribe",
        { method: "POST", headers: buildHeaders(apiKey), body: formData },
        "Transcription failed",
      );
    },
  });
}

export function useDiarizeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, language, apiKey }: DiarizeInput): Promise<DiarizeResult> => {
      const formData = new FormData();
      formData.append("file", audioBlob, getAudioFileName(audioBlob));
      if (language) formData.append("language", language);

      return fetchWithError<DiarizeResult>(
        "/api/transcribe-diarize",
        { method: "POST", headers: buildHeaders(apiKey), body: formData },
        "Diarized transcription failed",
      );
    },
  });
}
