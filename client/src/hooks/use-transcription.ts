import { useMutation } from "@tanstack/react-query";

type TranscribeInput = {
  audioBlob: Blob;
  prompt?: string;
};

type TranscribeResult = {
  text: string;
};

export function useTranscribeChunk() {
  return useMutation({
    mutationFn: async ({ audioBlob, prompt }: TranscribeInput): Promise<TranscribeResult> => {
      const formData = new FormData();
      formData.append("file", audioBlob, "chunk.wav");
      
      if (prompt) {
        formData.append("prompt", prompt);
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
          // ignore
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      return data as TranscribeResult;
    },
  });
}
