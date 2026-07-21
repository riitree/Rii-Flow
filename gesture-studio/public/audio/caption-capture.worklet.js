class CaptionCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.targetRate = 16000;
    this.step = sampleRate / this.targetRate;
    this.cursor = 0;
    this.pending = [];
    this.port.onmessage = (event) => {
      if (event.data?.type !== "stop") return;
      this.flush();
      this.active = false;
      this.port.postMessage({ type: "stopped" });
    };
  }

  flush() {
    if (!this.pending.length) return;
    const chunk = new Int16Array(this.pending);
    this.pending = [];
    this.port.postMessage({ type: "chunk", samples: chunk.buffer }, [chunk.buffer]);
  }

  process(inputs) {
    if (!this.active) return false;
    const input = inputs[0]?.[0];
    if (!input?.length) return true;
    while (this.cursor < input.length) {
      const index = Math.min(input.length - 1, Math.floor(this.cursor));
      const sample = Math.max(-1, Math.min(1, input[index]));
      this.pending.push(sample < 0 ? sample * 32768 : sample * 32767);
      this.cursor += this.step;
    }
    this.cursor -= input.length;
    if (this.pending.length >= 4096) this.flush();
    return true;
  }
}

registerProcessor("rii-flow-caption-capture", CaptionCaptureProcessor);
