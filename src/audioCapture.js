class AudioCaptureManager {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
  }

  async initializeAudio() {
    try {
      // High-quality audio settings
      const constraints = {
        video: false,
        audio: {
          mediaSource: 'screen',
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000,
          channelCount: 1
        }
      };

      this.mediaStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Audio context with optimal settings
      this.audioContext = new AudioContext({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });

      return true;
    } catch (error) {
      console.error('Audio initialization failed:', error);
      return false;
    }
  }

  createAudioProcessor(onAudioData) {
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    // Use AudioWorklet for better performance (modern browsers)
    if (this.audioContext.audioWorklet) {
      // AudioWorklet implementation would go here
    } else {
      // Fallback to ScriptProcessor
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        onAudioData(audioData);
      };
      
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    }
  }

  cleanup() {
    if (this.processor) {
      this.processor.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
  }
}

module.exports = AudioCaptureManager;
