import { useState, useRef, useEffect } from "react";
import { useTranscribeChunk } from "@/hooks/use-transcription";
import { Button } from "@/components/Button";
import { LiveIndicator } from "@/components/LiveIndicator";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Copy, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CHUNK_DURATION_MS = 3000; // 3 seconds per chunk

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptRef = useRef(""); 
  const isRecordingRef = useRef(false);
  
  const { toast } = useToast();
  const transcribeMutation = useTranscribeChunk();

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(audioStream);

      const processNextChunk = () => {
        if (!audioStream.active || !isRecordingRef.current) {
          console.log("Stream not active or recording stopped, skipping chunk");
          return;
        }
        
        console.log("Starting new chunk recorder...");
        const recorder = new MediaRecorder(audioStream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = async (event) => {
          console.log("Data available:", event.data.size, "bytes");
          if (event.data.size > 0 && isRecordingRef.current) {
            const chunkBlob = event.data;
            const prompt = transcriptRef.current.slice(-200);

            try {
              console.log("Sending chunk to backend...");
              const result = await transcribeMutation.mutateAsync({
                audioBlob: chunkBlob,
                prompt
              });

              console.log("Received transcription result:", result.text);
              if (result.text) {
                setTranscript(prev => {
                  const needsSpace = prev.length > 0 && !prev.endsWith(' ') && !result.text.startsWith(' ');
                  return prev + (needsSpace ? " " : "") + result.text;
                });
              }
            } catch (error) {
              console.error("Transcription error", error);
            }
          }
        };

        recorder.onstop = () => {
          console.log("Recorder stopped");
          if (isRecordingRef.current) {
            console.log("Starting next chunk...");
            processNextChunk();
          }
        };

        recorder.start();

        setTimeout(() => {
          if (recorder.state === "recording") {
            console.log("Stopping current chunk recorder for rotation...");
            recorder.stop();
          }
        }, CHUNK_DURATION_MS);
      };

      setIsRecording(true);
      isRecordingRef.current = true;
      processNextChunk();
      
      toast({
        title: "Microphone Active",
        description: "Transcription started. Speak clearly.",
      });

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use this app.",
      });
    }
  };

  const stopRecording = () => {
    console.log("Stopping recording...");
    setIsRecording(false);
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    mediaRecorderRef.current = null;
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
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Mic className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">LiveScribe</h1>
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

      {/* Main Content */}
      <main className="pt-24 pb-32 max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Transcript Area */}
        <div className="relative min-h-[60vh] bg-white rounded-3xl border border-border shadow-sm p-8 md:p-12 mb-8 transition-shadow hover:shadow-md">
          {transcript ? (
            <div className="prose prose-lg max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
              {transcript}
              {isRecording && (
                <span className="inline-block w-2 h-5 ml-1 bg-primary align-middle animate-cursor-blink" />
              )}
              <div ref={transcriptEndRef} />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Mic className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">Ready to transcribe</p>
              <p className="text-sm opacity-70 mt-2">Click the microphone button to start recording</p>
            </div>
          )}

          {/* Action buttons (copy/clear) - only show if there is content */}
          {transcript && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button 
                onClick={copyToClipboard}
                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                <Copy className="w-5 h-5" />
              </button>
              <button 
                onClick={clearTranscript}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-colors"
                title="Clear transcript"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Status Messages */}
        {transcribeMutation.isError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive mb-8"
          >
            <AlertCircle className="w-5 h-5" />
            <p className="font-medium">Connection issue. Some audio chunks may have been lost.</p>
          </motion.div>
        )}

      </main>

      {/* Floating Control Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pb-8">
        <div className="max-w-xl mx-auto">
          <div className="relative flex items-center justify-center gap-6 p-2 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/5 ring-1 ring-black/5">
            
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/50 to-white/10 pointer-events-none" />

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
                      {/* Spacer to match height of visualizer */}
                      <AudioVisualizer isRecording={false} />
                    </div>
                    <Button 
                      onClick={startRecording} 
                      size="lg"
                      className="rounded-full w-16 h-16 p-0 flex items-center justify-center bg-gradient-to-br from-primary to-blue-600 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-transform"
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
