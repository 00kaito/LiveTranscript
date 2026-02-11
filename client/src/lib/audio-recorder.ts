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

function mergePcmBuffers(buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((acc, c) => acc + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    merged.set(buf, offset);
    offset += buf.length;
  }
  return merged;
}

function computeRms(samples: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSquares += samples[i] * samples[i];
  }
  return Math.sqrt(sumSquares / samples.length);
}

async function requestMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: SAMPLE_RATE,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

function releaseAudioResources(resources: {
  processor?: ScriptProcessorNode | null;
  workletNode?: AudioWorkletNode | null;
  source?: MediaStreamAudioSourceNode | null;
  audioContext?: AudioContext | null;
  stream?: MediaStream | null;
}) {
  resources.processor?.disconnect();
  resources.workletNode?.disconnect();
  resources.source?.disconnect();
  resources.audioContext?.close();
  resources.stream?.getTracks().forEach((t) => t.stop());
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
    this.stream = await requestMicrophone();
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (!this.isActive) return;
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.isActive = true;

    this.intervalId = window.setInterval(() => this.flush(), this.chunkDurationMs);
  }

  private flush() {
    if (this.chunks.length === 0) return;

    const merged = mergePcmBuffers(this.chunks);
    this.chunks = [];

    const rms = computeRms(merged);
    const isSilent = rms < this.silenceThreshold;

    if (this.onSilenceChange && this.lastSilentState !== isSilent) {
      this.lastSilentState = isSilent;
      this.onSilenceChange(isSilent);
    }

    if (isSilent) return;

    this.onChunk(encodeWav(merged, this.audioContext?.sampleRate ?? SAMPLE_RATE));
  }

  stop() {
    this.isActive = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.flush();
    releaseAudioResources({
      processor: this.processor,
      source: this.source,
      audioContext: this.audioContext,
      stream: this.stream,
    });
    this.processor = null;
    this.source = null;
    this.audioContext = null;
    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }
}

export class FullRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private pcmBuffers: Float32Array[] = [];
  private isActive = false;
  private onSegment: AudioRecorderCallback;
  private onSilenceChange: SilenceCallback | null;
  private silenceThreshold: number;
  private segmentDurationMs: number;
  private segmentIntervalId: number | null = null;
  private startTime = 0;
  private lastSilentState: boolean | null = null;
  private sampleRate = SAMPLE_RATE;

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
    this.pcmBuffers = [];
    this.stream = await requestMicrophone();
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    this.sampleRate = this.audioContext.sampleRate;
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    const onSamples = (samples: Float32Array) => {
      if (!this.isActive) return;
      this.pcmBuffers.push(samples);
      this.updateSilence(samples);
    };

    try {
      const workletCode = `
        class PCMCapture extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input && input[0] && input[0].length > 0) {
              this.port.postMessage(new Float32Array(input[0]));
            }
            return true;
          }
        }
        registerProcessor('pcm-capture', PCMCapture);
      `;
      const blob = new Blob([workletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await this.audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      this.workletNode = new AudioWorkletNode(this.audioContext, "pcm-capture");
      this.workletNode.port.onmessage = (e: MessageEvent) => onSamples(e.data as Float32Array);
      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      console.log("[FullRecorder] Using AudioWorklet for capture");
    } catch {
      console.log("[FullRecorder] AudioWorklet unavailable, using ScriptProcessor fallback");
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => onSamples(new Float32Array(e.inputBuffer.getChannelData(0)));
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    }

    this.isActive = true;
    this.startTime = Date.now();
    this.segmentIntervalId = window.setInterval(() => this.flushSegment(), this.segmentDurationMs);
  }

  private updateSilence(samples: Float32Array) {
    const rms = computeRms(samples);
    const isSilent = rms < this.silenceThreshold;

    if (this.onSilenceChange && this.lastSilentState !== isSilent) {
      this.lastSilentState = isSilent;
      this.onSilenceChange(isSilent);
    }
  }

  private flushSegment() {
    if (this.pcmBuffers.length === 0) return;

    const merged = mergePcmBuffers(this.pcmBuffers);
    this.pcmBuffers = [];

    const durationSec = (merged.length / this.sampleRate).toFixed(1);
    const wavBlob = encodeWav(merged, this.sampleRate);
    console.log(`[FullRecorder] Segment: ${durationSec}s, ${merged.length} samples, WAV ${(wavBlob.size / 1024).toFixed(0)} KB`);
    this.onSegment(wavBlob);
  }

  stop() {
    this.isActive = false;

    if (this.segmentIntervalId !== null) {
      clearInterval(this.segmentIntervalId);
      this.segmentIntervalId = null;
    }

    this.flushSegment();
    releaseAudioResources({
      workletNode: this.workletNode,
      processor: this.processor,
      source: this.source,
      audioContext: this.audioContext,
      stream: this.stream,
    });
    this.workletNode = null;
    this.processor = null;
    this.source = null;
    this.audioContext = null;
    this.stream = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  getDurationSeconds(): number {
    if (!this.isActive) return 0;
    return (Date.now() - this.startTime) / 1000;
  }
}
