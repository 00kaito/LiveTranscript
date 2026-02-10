import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Settings, Eye, EyeOff } from "lucide-react";

export type TranscriptionSettings = {
  transcribeModel: string;
  chunkDuration: number;
  language: string;
  contextLength: number;
  temperature: number;
  silenceThreshold: number;
  clarifyEnabled: boolean;
  clarifySentenceCount: number;
  summaryPrompt: string;
  diarizeEnabled: boolean;
  translatorEnabled: boolean;
  translatorLanguage: string;
  openaiApiKey: string;
};

export const DEFAULT_SUMMARY_PROMPT = `You are a professional meeting assistant. Analyze the provided meeting transcript and generate a structured report in markdown format. The report must contain the following sections:

## Summary
A concise overview of the entire meeting (2-4 sentences).

## Key Points
A bullet list of the most important topics discussed and decisions made.

## Goals
A bullet list of goals or objectives mentioned during the meeting.

## Action Items
A bullet list of specific tasks, assignments, or next steps to be taken. Include who is responsible if mentioned.

If a section has no relevant content, write "None identified." Keep the language professional and clear.`;

export const DEFAULT_SETTINGS: TranscriptionSettings = {
  transcribeModel: "gpt-4o-mini-transcribe",
  chunkDuration: 3,
  language: "pl",
  contextLength: 200,
  temperature: 0,
  silenceThreshold: 0.005,
  clarifyEnabled: false,
  clarifySentenceCount: 3,
  summaryPrompt: "",
  diarizeEnabled: false,
  translatorEnabled: false,
  translatorLanguage: "en",
  openaiApiKey: "",
};

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Portugues" },
  { value: "nl", label: "Nederlands" },
  { value: "cs", label: "Cestina" },
  { value: "uk", label: "Ukrainska" },
  { value: "ru", label: "Russkij" },
  { value: "ja", label: "Nihongo" },
  { value: "zh", label: "Zhongwen" },
  { value: "ko", label: "Hangugeo" },
];

const TRANSLATOR_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "pl", label: "Polski" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Portugues" },
  { value: "nl", label: "Nederlands" },
  { value: "cs", label: "Cestina" },
  { value: "uk", label: "Ukrainska" },
  { value: "ru", label: "Russkij" },
  { value: "ja", label: "Nihongo" },
  { value: "zh", label: "Zhongwen" },
  { value: "ko", label: "Hangugeo" },
];

type Props = {
  settings: TranscriptionSettings;
  onChange: (settings: TranscriptionSettings) => void;
  disabled?: boolean;
};

export function SettingsDialog({ settings, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const update = (partial: Partial<TranscriptionSettings>) => {
    const next = { ...settings, ...partial };
    if (partial.translatorEnabled && !settings.translatorEnabled) {
      next.clarifyEnabled = true;
    }
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          disabled={disabled}
          data-testid="button-settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transcription Settings</DialogTitle>
          <DialogDescription>
            Configure audio recording and transcription parameters.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>OpenAI API Key</Label>
              <p className="text-xs text-muted-foreground">
                Your key is stored only in this browser and sent directly with each request. It is never saved on the server.
              </p>
            </div>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={settings.openaiApiKey}
                onChange={(e) => update({ openaiApiKey: e.target.value })}
                placeholder="sk-..."
                className="pr-10 font-mono text-sm"
                data-testid="input-api-key"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-api-key"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!settings.openaiApiKey && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No API key set. The app will use the server's default key if available.
              </p>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Chunk duration</Label>
              <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-chunk-value">
                {settings.chunkDuration}s
              </span>
            </div>
            <Slider
              value={[settings.chunkDuration]}
              onValueChange={([v]) => update({ chunkDuration: v })}
              min={1}
              max={10}
              step={1}
              data-testid="slider-chunk-duration"
            />
            <p className="text-xs text-muted-foreground">
              How often audio is sent for transcription. Shorter = more responsive, longer = more context per chunk.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Language</Label>
            <Select
              value={settings.language}
              onValueChange={(v) => update({ language: v })}
            >
              <SelectTrigger className="bg-background" data-testid="select-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value} data-testid={`option-lang-${lang.value}`}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Transcription model</Label>
            <Select
              value={settings.transcribeModel}
              onValueChange={(v) => update({ transcribeModel: v })}
            >
              <SelectTrigger className="bg-background" data-testid="select-transcribe-model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o-mini-transcribe" data-testid="option-model-mini">gpt-4o-mini-transcribe</SelectItem>
                <SelectItem value="gpt-4o-transcribe" data-testid="option-model-full">gpt-4o-transcribe</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Mini is faster and cheaper. Full model is more accurate, especially for complex audio.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <Label>Speaker diarization</Label>
                <p className="text-xs text-muted-foreground">
                  Identify who is speaking. Uses gpt-4o-transcribe-diarize model. Context prompt and temperature are not available in this mode.
                </p>
              </div>
              <Switch
                checked={settings.diarizeEnabled}
                onCheckedChange={(v) => update({ diarizeEnabled: v })}
                data-testid="switch-diarize"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Context length</Label>
              <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-context-value">
                {settings.contextLength} chars
              </span>
            </div>
            <Slider
              value={[settings.contextLength]}
              onValueChange={([v]) => update({ contextLength: v })}
              min={0}
              max={500}
              step={50}
              data-testid="slider-context-length"
            />
            <p className="text-xs text-muted-foreground">
              Amount of previous transcript sent as context. Helps maintain continuity between chunks.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-temperature-value">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <Slider
              value={[settings.temperature]}
              onValueChange={([v]) => update({ temperature: v })}
              min={0}
              max={1}
              step={0.1}
              data-testid="slider-temperature"
            />
            <p className="text-xs text-muted-foreground">
              Lower = more deterministic transcription. Higher = more creative interpretation.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Silence threshold</Label>
              <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-silence-value">
                {settings.silenceThreshold.toFixed(3)}
              </span>
            </div>
            <Slider
              value={[settings.silenceThreshold]}
              onValueChange={([v]) => update({ silenceThreshold: parseFloat(v.toFixed(3)) })}
              min={0.001}
              max={0.05}
              step={0.001}
              data-testid="slider-silence-threshold"
            />
            <p className="text-xs text-muted-foreground">
              Audio quieter than this level is skipped. Increase if you get phantom transcriptions during silence.
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <Label>Clarify transcription</Label>
                <p className="text-xs text-muted-foreground">
                  Use AI to improve grammar and logic of transcribed sentences.
                  {settings.translatorEnabled && (
                    <span className="text-primary"> (Required by translator)</span>
                  )}
                </p>
              </div>
              <Switch
                checked={settings.clarifyEnabled}
                onCheckedChange={(v) => update({ clarifyEnabled: v })}
                disabled={settings.translatorEnabled}
                data-testid="switch-clarify"
              />
            </div>

            {settings.clarifyEnabled && (
              <div className="space-y-3 pl-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">Sentences per batch</Label>
                  <span className="text-sm text-muted-foreground tabular-nums" data-testid="text-clarify-count">
                    {settings.clarifySentenceCount}
                  </span>
                </div>
                <Slider
                  value={[settings.clarifySentenceCount]}
                  onValueChange={([v]) => update({ clarifySentenceCount: v })}
                  min={1}
                  max={10}
                  step={1}
                  data-testid="slider-clarify-count"
                />
                <p className="text-xs text-muted-foreground">
                  How many sentences to collect before sending for grammar and logic correction.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <Label>Live translator</Label>
                <p className="text-xs text-muted-foreground">
                  Translate clarified text in real-time to another language. Shows a second panel with translations. Automatically enables text clarification.
                </p>
              </div>
              <Switch
                checked={settings.translatorEnabled}
                onCheckedChange={(v) => update({ translatorEnabled: v })}
                data-testid="switch-translator"
              />
            </div>

            {settings.translatorEnabled && (
              <div className="space-y-3 pl-1">
                <Label className="text-sm">Translate to</Label>
                <Select
                  value={settings.translatorLanguage}
                  onValueChange={(v) => update({ translatorLanguage: v })}
                >
                  <SelectTrigger className="bg-background" data-testid="select-translator-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSLATOR_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} data-testid={`option-translator-lang-${lang.value}`}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="space-y-1">
              <Label>Summary prompt</Label>
              <p className="text-xs text-muted-foreground">
                Custom instructions for AI when generating meeting summaries. Leave empty to use the default prompt.
              </p>
            </div>
            <textarea
              value={settings.summaryPrompt}
              onChange={(e) => update({ summaryPrompt: e.target.value })}
              placeholder={DEFAULT_SUMMARY_PROMPT}
              rows={5}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
              data-testid="textarea-summary-prompt"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
