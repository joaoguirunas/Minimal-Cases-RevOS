/**
 * AudioWorklet processor source — captures PCM16 chunks from mic stream
 * and posts them to the main thread.
 *
 * Loaded via Blob URL to avoid separate file bundling.
 */
const PROCESSOR_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._chunkSamples = 512; // ~32ms @ 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    for (let i = 0; i < channel.length; i++) {
      this._buffer.push(channel[i]);
    }

    while (this._buffer.length >= this._chunkSamples) {
      const chunk = this._buffer.splice(0, this._chunkSamples);
      const int16 = new Int16Array(this._chunkSamples);
      for (let i = 0; i < this._chunkSamples; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage({ pcm16: int16.buffer }, [int16.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
`;

let cachedBlobUrl: string | null = null;

/** Returns a stable Blob URL for the AudioWorklet processor. */
export function createWorkletBlobUrl(): string {
  if (!cachedBlobUrl) {
    const blob = new Blob([PROCESSOR_SOURCE], { type: 'application/javascript' });
    cachedBlobUrl = URL.createObjectURL(blob);
  }
  return cachedBlobUrl;
}
