class DeepgramClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    const wsUrl = this.buildWebSocketUrl();
    
    this.socket = new WebSocket(wsUrl, ['token', this.apiKey]);
    
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('Deepgram connected successfully');
        resolve();
      };

      this.socket.onerror = (error) => {
        console.error('Deepgram connection error:', error);
        reject(error);
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.handleDisconnection();
      };
    });
  }

  buildWebSocketUrl() {
    const params = new URLSearchParams({
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      interim_results: 'true',
      punctuate: 'true',
      smart_format: 'true',
      model: 'nova-2',
      language: 'en-US',
      endpointing: '300'
    });

    return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
  }

  sendAudioData(audioData) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(audioData);
    }
  }

  onMessage(callback) {
    if (this.socket) {
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          callback(data);
        } catch (error) {
          console.error('Error parsing Deepgram response:', error);
        }
      };
    }
  }

  handleDisconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, 2000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }
}

module.exports = DeepgramClient;
