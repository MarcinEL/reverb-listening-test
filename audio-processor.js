// ═══════════════════════════════════════════════════════════════
// AudioWorklet Processor — runs on dedicated audio thread
// 128-sample blocks (~2.7ms at 48kHz) for ultra-low latency
// ═══════════════════════════════════════════════════════════════

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = {};        // key → [Float32Array ch0, Float32Array ch1, ...]
    this.activeKey = null;
    this.position = 0;
    this.playing = false;

    // Crossfade state
    this.fadeState = 0;       // 0=none, 1=fade-out, 2=fade-in
    this.fadePos = 0;
    this.fadeMax = 240;       // ~5ms at 48kHz, updated via message
    this.fadeInKey = null;

    // Position reporting — every ~1024 samples (~21ms)
    this.reportCounter = 0;
    this.reportInterval = 1024;

    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'load':
        this.buffers[msg.key] = msg.data;
        break;

      case 'play':
        // Start playing a buffer (with fade-in)
        this.activeKey = msg.key;
        this.playing = true;
        this.fadeState = 2;
        this.fadePos = 0;
        break;

      case 'switch':
        // Crossfade from current buffer to new one (keeps position)
        this.fadeInKey = msg.key;
        this.fadeState = 1;
        this.fadePos = 0;
        break;

      case 'pause':
        this.playing = false;
        break;

      case 'resume':
        this.playing = true;
        break;

      case 'stop':
        this.playing = false;
        this.activeKey = null;
        this.fadeState = 0;
        this.fadePos = 0;
        this.fadeInKey = null;
        break;

      case 'seek':
        this.position = msg.position;
        this.port.postMessage({ type: 'position', position: this.position });
        break;

      case 'setFadeLength':
        this.fadeMax = msg.samples;
        break;

      case 'cleanup':
        this.buffers = {};
        this.activeKey = null;
        this.playing = false;
        this.position = 0;
        this.fadeState = 0;
        this.fadePos = 0;
        this.fadeInKey = null;
        break;
    }
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const numChannels = output.length;
    const blockSize = output[0].length; // 128 samples

    // Not playing or no active buffer → silence
    if (!this.playing || !this.activeKey || !this.buffers[this.activeKey]) {
      for (let ch = 0; ch < numChannels; ch++) output[ch].fill(0);
      return true;
    }

    let pos = this.position;

    for (let i = 0; i < blockSize; i++) {
      // Read active buffer (re-read each sample so transitions are seamless)
      const buf = this.buffers[this.activeKey];
      if (!buf) break;
      const totalLen = buf[0].length;

      if (this.fadeState === 1) {
        // ── Fade out current buffer ──
        const ramp = 0.5 * (1 + Math.cos(Math.PI * this.fadePos / (this.fadeMax - 1)));
        for (let ch = 0; ch < numChannels; ch++) {
          output[ch][i] = buf[Math.min(ch, buf.length - 1)][pos] * ramp;
        }
        this.fadePos++;
        if (this.fadePos >= this.fadeMax) {
          if (this.fadeInKey && this.buffers[this.fadeInKey]) {
            this.activeKey = this.fadeInKey;
            this.fadeInKey = null;
            this.fadeState = 2;
            this.fadePos = 0;
          } else {
            this.playing = false;
            this.fadeState = 0;
            this.fadePos = 0;
            // Fill remainder with silence
            for (let ch = 0; ch < numChannels; ch++) {
              for (let j = i + 1; j < blockSize; j++) output[ch][j] = 0;
            }
            this.position = pos;
            return true;
          }
        }
      } else if (this.fadeState === 2) {
        // ── Fade in new buffer (activeKey already switched) ──
        const ramp = 0.5 * (1 - Math.cos(Math.PI * this.fadePos / (this.fadeMax - 1)));
        for (let ch = 0; ch < numChannels; ch++) {
          output[ch][i] = buf[Math.min(ch, buf.length - 1)][pos] * ramp;
        }
        this.fadePos++;
        if (this.fadePos >= this.fadeMax) {
          this.fadeState = 0;
          this.fadePos = 0;
        }
      } else {
        // ── Normal playback ──
        for (let ch = 0; ch < numChannels; ch++) {
          output[ch][i] = buf[Math.min(ch, buf.length - 1)][pos];
        }
      }

      pos++;
      if (pos >= totalLen) pos = 0;
    }

    this.position = pos;

    // Report position periodically for playhead animation
    this.reportCounter += blockSize;
    if (this.reportCounter >= this.reportInterval) {
      this.reportCounter = 0;
      this.port.postMessage({ type: 'position', position: this.position });
    }

    return true;
  }
}

registerProcessor('playback-processor', PlaybackProcessor);
