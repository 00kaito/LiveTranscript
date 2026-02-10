import { useMutation } from "@tanstack/react-query";

type TranscribeInput = {
  audioBlob: Blob;
  prompt?: string;
  language?: string;
  temperature?: number;
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
};

type DiarizeResult = {
  segments: DiarizedSegment[];
  text: string;
};

export function useTranscribeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, prompt, language, temperature }: TranscribeInput): Promise<TranscribeResult> => {
      const formData = new FormData();
      formData.append("file", audioBlob, "chunk.wav");
      
      if (prompt) {
        formData.append("prompt", prompt);
      }
      if (language) {
        formData.append("language", language);
      }
      if (temperature !== undefined) {
        formData.append("temperature", String(temperature));
      }

      const res = await fetch("/api/transcribe", {
        method: "POST",
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

export function useDiarizeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, language }: DiarizeInput): Promise<DiarizeResult> => {
      const formData = new FormData();
      formData.append("file", audioBlob, "chunk.wav");

      if (language) {
        formData.append("language", language);
      }

      const res = await fetch("/api/transcribe-diarize", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "Diarized transcription failed";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      return data as DiarizeResult;
    },
  });
}
