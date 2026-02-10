import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

// We define the input type manually since it's FormData
type TranscribeInput = {
  audioBlob: Blob;
  prompt?: string;
};

// Response schema from routes manifest
const transcribeResponseSchema = api.transcribe.process.responses[200];

export function useTranscribeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, prompt }: TranscribeInput) => {
      const formData = new FormData();
      // Send as 'file' to match backend expectation
      formData.append("file", audioBlob, "chunk.webm");
      
      if (prompt) {
        formData.append("prompt", prompt);
      }

      const res = await fetch(api.transcribe.process.path, {
        method: api.transcribe.process.method,
        body: formData,
        // No Content-Type header needed; fetch sets multipart/form-data boundary automatically
      });

      if (!res.ok) {
        let errorMessage = "Transcription failed";
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // ignore json parse error
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      return transcribeResponseSchema.parse(data);
    },
  });
}
