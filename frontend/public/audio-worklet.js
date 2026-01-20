class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.targetSamples = 2048; // ~0.128 seconds at 16kHz - larger chunks for testing
    this.isActive = true;

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
      if (maxAmplitude > 100) { // Lower threshold for sound detection
        // Accumulate in buffer
        this.buffer.push(...pcm);
      } else {
        // Send silence data occasionally to keep connection alive
        this.buffer.push(...new Int16Array(resampledData.length));
      }

      // If buffer has enough data and we're still active, send
      if (this.buffer.length >= this.targetSamples && this.isActive) {
        const sendBuffer = new Int16Array(this.buffer.slice(0, this.targetSamples));
        this.buffer = this.buffer.slice(this.targetSamples);
        this.port.postMessage(sendBuffer.buffer, [sendBuffer.buffer]);
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
