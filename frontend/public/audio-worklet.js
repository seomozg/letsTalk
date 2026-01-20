class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.targetSamples = 2048; // ~0.128 seconds at 16kHz - larger chunks for testing
    this.isActive = true;
    this.silenceCounter = 0;
    this.maxSilenceChunks = 10; // Stop sending after ~1.28 seconds of silence
    this.hasSound = false;

    // Listen for stop messages from main thread
    this.port.onmessage = (event) => {
      if (event.data === 'stop') {
        this.isActive = false;
        console.log('AudioWorklet stopped');
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channel = input[0];
      // Resample to 16kHz if needed
      let resampledData = channel;
      const inputSampleRate = sampleRate;
      const targetSampleRate = 16000;
      if (inputSampleRate !== targetSampleRate) {
        const ratio = targetSampleRate / inputSampleRate;
        const newLength = Math.floor(channel.length * ratio);
        resampledData = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
          const index = Math.floor(i / ratio);
          resampledData[i] = channel[Math.min(index, channel.length - 1)];
        }
      }
      // Convert to 16-bit PCM
      const pcm = new Int16Array(resampledData.length);
      for (let i = 0; i < resampledData.length; i++) {
        pcm[i] = Math.max(-32768, Math.min(32767, resampledData[i] * 32768));
      }
      // Check if audio has sound (not silence) - lower threshold
      const maxAmplitude = Math.max(...pcm.map(Math.abs));
      const hasSoundNow = maxAmplitude > 100;

      if (hasSoundNow) {
        // Sound detected - reset silence counter and mark as having sound
        this.silenceCounter = 0;
        this.hasSound = true;
        this.buffer.push(...pcm);
      } else {
        // Silence detected
        if (this.hasSound) {
          // We had sound before, now silence - increment counter
          this.silenceCounter++;
          this.buffer.push(...new Int16Array(resampledData.length));
        } else {
          // Still in silence mode - don't accumulate data
          // This prevents sending silence indefinitely
        }
      }

      // Send data only if we have sound OR if we're still in the initial silence period
      const shouldSend = this.hasSound && this.silenceCounter <= this.maxSilenceChunks;

      if (this.buffer.length >= this.targetSamples && this.isActive && shouldSend) {
        const sendBuffer = new Int16Array(this.buffer.slice(0, this.targetSamples));
        this.buffer = this.buffer.slice(this.targetSamples);
        this.port.postMessage(sendBuffer.buffer, [sendBuffer.buffer]);
      }

      // If we've been silent too long, stop sending entirely until sound resumes
      if (this.hasSound && this.silenceCounter > this.maxSilenceChunks) {
        this.hasSound = false;
        this.buffer = []; // Clear buffer
        console.log('AudioWorklet: entering silence mode (stopped sending)');
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
