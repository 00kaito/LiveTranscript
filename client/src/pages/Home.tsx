import { useState, useRef, useEffect } from "react";
import { useTranscribeChunk } from "@/hooks/use-transcription";
import { Button } from "@/components/Button";
import { LiveIndicator } from "@/components/LiveIndicator";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { ChunkedAudioRecorder } from "@/lib/audio-recorder";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Copy, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef("");
  const recorderRef = useRef<ChunkedAudioRecorder | null>(null);

  const { toast } = useToast();
  const transcribeMutation = useTranscribeChunk();
  const handleChunkRef = useRef<(wavBlob: Blob) => void>(() => {});

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    handleChunkRef.current = async (wavBlob: Blob) => {
      const prompt = transcriptRef.current.slice(-200);
      try {
        setError(null);
        const result = await transcribeMutation.mutateAsync({
          audioBlob: wavBlob,
          prompt,
        });
        if (result.text && result.text.trim()) {
          setTranscript((prev) => {
            const needsSpace =
              prev.length > 0 &&
              !prev.endsWith(" ") &&
              !result.text.startsWith(" ");
            return prev + (needsSpace ? " " : "") + result.text;
          });
        }
      } catch (err: any) {
        console.error("Transcription chunk error:", err);
        setError("Connection issue. Some audio may have been lost.");
      }
    };
  });

  const startRecording = async () => {
    try {
      setError(null);
      const recorder = new ChunkedAudioRecorder(
        (blob) => handleChunkRef.current(blob),
        3000
      );
      await recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);

      toast({
        title: "Microphone Active",
        description: "Transcription started. Speak clearly.",
      });
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use this app.",
      });
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    setIsRecording(false);
  };

  const clearTranscript = () => {
    if (confirm("Are you sure you want to clear the transcript?")) {
      setTranscript("");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(transcript);
    toast({
      title: "Copied!",
      description: "Transcript copied to clipboard.",
    });
  };

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="min-h-screen bg-background text-foreground font-body selection:bg-primary/20">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Mic className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground" data-testid="text-app-title">LiveScribe</h1>
          </div>
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <LiveIndicator />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="pt-24 pb-32 max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative min-h-[60vh] bg-white dark:bg-card rounded-3xl border border-border shadow-sm p-8 md:p-12 mb-8 transition-shadow hover:shadow-md">
          {transcript ? (
            <div className="prose prose-lg max-w-none text-foreground leading-relaxed whitespace-pre-wrap" data-testid="text-transcript">
              {transcript}
              {isRecording && (
                <span className="inline-block w-2 h-5 ml-1 bg-primary align-middle animate-cursor-blink" />
              )}
              <div ref={transcriptEndRef} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20" data-testid="text-placeholder">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Mic className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">Ready to transcribe</p>
              <p className="text-sm opacity-70 mt-2">Click the microphone button to start recording</p>
            </div>
          )}

          {transcript && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={copyToClipboard}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                title="Copy to clipboard"
                data-testid="button-copy"
              >
                <Copy className="w-5 h-5" />
              </button>
              <button
                onClick={clearTranscript}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                title="Clear transcript"
                data-testid="button-clear"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive mb-8"
            data-testid="text-error"
          >
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">{error}</p>
          </motion.div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pb-8">
        <div className="max-w-xl mx-auto">
          <div className="relative flex items-center justify-center gap-6 p-2 rounded-2xl bg-white/80 dark:bg-card/80 backdrop-blur-xl border border-white/20 dark:border-border/20 shadow-2xl shadow-black/5 ring-1 ring-black/5">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/50 to-white/10 dark:from-card/50 dark:to-card/10 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center w-full py-2">
              <AnimatePresence mode="wait">
                {isRecording ? (
                  <motion.div
                    key="stop"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center gap-3 w-full"
                  >
                    <div className="w-full px-8">
                      <AudioVisualizer isRecording={isRecording} />
                    </div>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                      className="rounded-full w-16 h-16 p-0 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                      data-testid="button-stop"
                    >
                      <Square className="w-6 h-6 fill-current" />
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">Tap to stop</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="start"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="h-8 flex items-center justify-center opacity-0">
                      <AudioVisualizer isRecording={false} />
                    </div>
                    <Button
                      onClick={startRecording}
                      size="lg"
                      className="rounded-full w-16 h-16 p-0 flex items-center justify-center bg-gradient-to-br from-primary to-blue-600 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-transform"
                      data-testid="button-start"
                    >
                      <Mic className="w-7 h-7" />
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">Tap to record</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
