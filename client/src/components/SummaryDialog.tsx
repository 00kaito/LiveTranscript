import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/Button";
import { FileText, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  transcript: string;
  language: string;
  customPrompt?: string;
};

export function SummaryDialog({ transcript, language, customPrompt }: Props) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    setError(null);
    setSummary("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, language, customPrompt: customPrompt || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to generate summary");
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    generate();
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    toast({ title: "Copied!", description: "Summary copied to clipboard." });
  };

  const renderMarkdown = (md: string) => {
    const lines = md.split("\n");
    const elements: JSX.Element[] = [];
    let key = 0;

    for (const line of lines) {
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={key++} className="text-lg font-display font-bold text-foreground mt-6 mb-2 first:mt-0">
            {line.slice(3)}
          </h2>
        );
      } else if (line.startsWith("- ")) {
        elements.push(
          <li key={key++} className="ml-4 text-foreground/90 leading-relaxed list-disc">
            {line.slice(2)}
          </li>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={key++} className="h-2" />);
      } else {
        elements.push(
          <p key={key++} className="text-foreground/90 leading-relaxed">
            {line}
          </p>
        );
      }
    }
    return elements;
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={!transcript || transcript.trim().length < 20}
        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
        title="Generate meeting summary"
        data-testid="button-summarize"
      >
        <FileText className="w-5 h-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle>Meeting Summary</DialogTitle>
                <DialogDescription>
                  AI-generated report from your transcription
                </DialogDescription>
              </div>
              {summary && !loading && (
                <button
                  onClick={copySummary}
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors shrink-0"
                  title="Copy summary"
                  data-testid="button-copy-summary"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1" data-testid="container-summary">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Analyzing transcript...</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm" data-testid="text-summary-error">
                {error}
              </div>
            )}

            {summary && !loading && (
              <div className="space-y-1" data-testid="text-summary-content">
                {renderMarkdown(summary)}
              </div>
            )}
          </div>

          {summary && !loading && (
            <div className="pt-4 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => generate()} data-testid="button-regenerate">
                Regenerate
              </Button>
              <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
