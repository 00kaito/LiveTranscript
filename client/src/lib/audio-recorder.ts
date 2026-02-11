const SAMPLE_RATE = 16000;

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export type AudioRecorderCallback = (blob: Blob) => void;
export type SilenceCallback = (isSilent: boolean) => void;

export class ChunkedAudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private isActive = false;
  private intervalId: number | null = null;
  private onChunk: AudioRecorderCallback;
  private onSilenceChange: SilenceCallback | null;
  private chunkDurationMs: number;
  private silenceThreshold: number;
  private lastSilentState: boolean | null = null;

  constructor(
    onChunk: AudioRecorderCallback,
    chunkDurationMs = 3000,
    silenceThreshold = 0.005,
    onSilenceChange?: SilenceCallback,
  ) {
    this.onChunk = onChunk;
    this.chunkDurationMs = chunkDurationMs;
    this.silenceThreshold = silenceThreshold;
    this.onSilenceChange = onSilenceChange || null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    const bufferSize = 4096;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isActive) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inputData));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.isActive = true;

    this.intervalId = window.setInterval(() => {
      this.flush();
    }, this.chunkDurationMs);
  }

  private flush() {
    if (this.chunks.length === 0) return;

    const totalLength = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];

    let sumSquares = 0;
    for (let i = 0; i < merged.length; i++) {
      sumSquares += merged[i] * merged[i];
    }
    const rms = Math.sqrt(sumSquares / merged.length);
    const isSilent = rms < this.silenceThreshold;

    if (this.onSilenceChange && this.lastSilentState !== isSilent) {
      this.lastSilentState = isSilent;
      this.onSilenceChange(isSilent);
    }

    if (isSilent) return;

    const wavBlob = encodeWav(merged, this.audioContext?.sampleRate ?? SAMPLE_RATE);
    this.onChunk(wavBlob);
  }

  stop() {
    this.isActive = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.flush();

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}

export class FullRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isActive = false;
  private onSegment: AudioRecorderCallback;
  private onSilenceChange: SilenceCallback | null;
  private silenceThreshold: number;
  private segmentDurationMs: number;
  private segmentIntervalId: number | null = null;
  private startTime = 0;

  private analyserNode: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private silenceCheckId: number | null = null;
  private lastSilentState: boolean | null = null;

  constructor(
    onSegment: AudioRecorderCallback,
    silenceThreshold = 0.005,
    onSilenceChange?: SilenceCallback,
    segmentDurationMs = 60000,
  ) {
    this.onSegment = onSegment;
    this.silenceThreshold = silenceThreshold;
    this.onSilenceChange = onSilenceChange || null;
    this.segmentDurationMs = segmentDurationMs;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    source.connect(this.analyserNode);

    this.silenceCheckId = window.setInterval(() => {
      this.checkSilence();
    }, 250);

    this.startMediaRecorder();
    this.isActive = true;
    this.startTime = Date.now();

    this.segmentIntervalId = window.setInterval(() => {
      this.cycleRecorder();
    }, this.segmentDurationMs);
  }

  private startMediaRecorder() {
    if (!this.stream) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";

    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, {
      ...(mimeType ? { mimeType } : {}),
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(1000);
  }

  private cycleRecorder() {
    if (!this.isActive || !this.mediaRecorder) return;

    const currentRecorder = this.mediaRecorder;
    const currentChunks = this.recordedChunks;

    currentRecorder.onstop = () => {
      if (currentChunks.length > 0) {
        const blob = new Blob(currentChunks, { type: currentRecorder.mimeType || "audio/webm" });
        console.log(`[FullRecorder] Segment ready: ${(blob.size / 1024).toFixed(0)} KB, type=${blob.type}`);
        this.onSegment(blob);
      }
    };

    currentRecorder.stop();

    this.startMediaRecorder();
  }

  private checkSilence() {
    if (!this.analyserNode) return;
    const data = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(data);

    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      sumSquares += data[i] * data[i];
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const isSilent = rms < this.silenceThreshold;

    if (this.onSilenceChange && this.lastSilentState !== isSilent) {
      this.lastSilentState = isSilent;
      this.onSilenceChange(isSilent);
    }
  }

  stop() {
    this.isActive = false;

    if (this.segmentIntervalId !== null) {
      clearInterval(this.segmentIntervalId);
      this.segmentIntervalId = null;
    }
    if (this.silenceCheckId !== null) {
      clearInterval(this.silenceCheckId);
      this.silenceCheckId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      const finalChunks = this.recordedChunks;
      const finalRecorder = this.mediaRecorder;

      finalRecorder.onstop = () => {
        if (finalChunks.length > 0) {
          const blob = new Blob(finalChunks, { type: finalRecorder.mimeType || "audio/webm" });
          console.log(`[FullRecorder] Final segment: ${(blob.size / 1024).toFixed(0)} KB, type=${blob.type}`);
          this.onSegment(blob);
        }
      };

      finalRecorder.stop();
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getDurationSeconds(): number {
    if (!this.isActive) return 0;
    return (Date.now() - this.startTime) / 1000;
  }
}
