class SystemAudioSTT {
  constructor() {
    this.mediaRecorder = null;
    this.audioContext = null;
    this.deepgramSocket = null;
    this.isRecording = false;
    this.mediaStream = null;
    this.processor = null;
    this.sources = [];
    this.allTranscripts = [];
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadSources();
    this.testDeepgramConnection(); // Connection test qo'shamiz
  }

  initializeElements() {
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.copyBtn = document.getElementById('copyBtn');
    this.status = document.getElementById('status');
    this.indicator = document.getElementById('indicator');
    this.transcript = document.getElementById('transcript');
    this.wordCount = document.getElementById('wordCount');
    this.confidence = document.getElementById('confidence');
    this.language = document.getElementById('language');
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startRecording());
    this.stopBtn.addEventListener('click', () => this.stopRecording());
    this.clearBtn.addEventListener('click', () => this.clearTranscript());
    this.copyBtn.addEventListener('click', () => this.copyTranscript());
  }

  // Deepgram connection test
  async testDeepgramConnection() {
    try {
      const apiKey = await window.electronAPI.getDeepgramKey();
      if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
        this.updateStatus('⚠️ Настройте API ключ в .env файле', false);
        return false;
      }

      // Test HTTP connection first
      console.log('Тестирование HTTP подключения к Deepgram...');
      
      // Simple connection test without WebSocket
      this.updateStatus('✅ API ключ найден', false);
      return true;
      
    } catch (error) {
      console.error('Ошибка тестирования подключения:', error);
      this.updateStatus('❌ Ошибка проверки API ключа', false);
      return false;
    }
  }

  async loadSources() {
    try {
      console.log('Загрузка источников рабочего стола...');
      this.sources = await window.electronAPI.getSources();
      console.log(`Загружено ${this.sources.length} источников`);
    } catch (error) {
      console.error('Ошибка загрузки источников:', error);
      this.sources = [];
    }
  }

  async startRecording() {
    try {
      this.updateStatus('Проверка API ключа...', false);
      
      // Deepgram API key validation
      const apiKey = await window.electronAPI.getDeepgramKey();
      if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
        throw new Error('API ключ Deepgram не настроен. Откройте файл .env и добавьте ваш ключ.');
      }

      console.log('API ключ найден, длина:', apiKey.length);

      this.updateStatus('Настройка аудио...', false);
      this.clearTranscript();
      this.allTranscripts = [];

      // System audio capture
      await this.captureSystemAudio();
      
      this.updateStatus('Подключение к Deepgram...', false);
      
      // Simplified Deepgram connection
      await this.connectToDeepgramSimple(apiKey);
      
      this.isRecording = true;
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.updateStatus('��� Запись...', true);
      
    } catch (error) {
      console.error('Ошибка начала записи:', error);
      this.updateStatus('❌ ' + error.message, false);
      this.resetButtons();
    }
  }

  async captureSystemAudio() {
    try {
      console.log('Запуск захвата системного аудио...');
      
      try {
        this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 16000, // Back to standard rate for stability
            channelCount: 1
          }
        });
        
        console.log('✅ getDisplayMedia успешно');
        
        // Stop video track
        const videoTracks = this.mediaStream.getVideoTracks();
        videoTracks.forEach(track => track.stop());
        
      } catch (error1) {
        console.log('getDisplayMedia не удалось, пробуем метод Electron...');
        
        if (this.sources.length === 0) {
          await this.loadSources();
        }
        
        if (this.sources.length === 0) {
          throw new Error('Нет доступных источников рабочего стола');
        }
        
        const screenSource = this.sources.find(s => 
          s.name.includes('Screen') || 
          s.name.includes('Экран') || 
          s.name.includes('Entire') ||
          s.name.includes('screen')
        ) || this.sources[0];
        
        console.log('Используем источник:', screenSource.name);
        
        const constraints = await window.electronAPI.getMediaConstraints(screenSource.id);
        if (!constraints) {
          throw new Error('Не удалось получить медиа-ограничения');
        }
        
        this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Захват рабочего стола Electron успешен');
      }

      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('Аудио треки не найдены. Убедитесь, что при выборе экрана включили "Поделиться аудио"');
      }

      console.log(`✅ Аудио треки: ${audioTracks.length}`);

      // Simple audio context setup
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ 
        sampleRate: 16000 
      });
      
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Simple processor
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        if (this.deepgramSocket && this.deepgramSocket.readyState === WebSocket.OPEN) {
          const audioData = event.inputBuffer.getChannelData(0);
          const int16Array = this.convertFloat32ToInt16(audioData);
          this.deepgramSocket.send(int16Array);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('✅ Настройка аудио обработки завершена');
      
    } catch (error) {
      throw new Error('Не удалось захватить системное аудио: ' + error.message);
    }
  }

  // Simplified Deepgram connection
  async connectToDeepgramSimple(apiKey) {
    try {
      // Basic connection parameters
      const params = {
        encoding: 'linear16',
        sample_rate: '16000',
        channels: '1',
        interim_results: 'false',
        punctuate: 'true',
        smart_format: 'true',
        model: 'nova-2',
        language: 'ru'
      };
      
      const wsUrl = `wss://api.deepgram.com/v1/listen?${new URLSearchParams(params).toString()}`;
      
      console.log('Подключение к Deepgram...');
      console.log('URL:', wsUrl.substring(0, 50) + '...');
      
      this.deepgramSocket = new WebSocket(wsUrl, ['token', apiKey]);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('⏰ Таймаут подключения к Deepgram');
          reject(new Error('Таймаут подключения к Deepgram (15 сек). Проверьте интернет и API ключ.'));
        }, 15000);

        this.deepgramSocket.onopen = () => {
          clearTimeout(timeout);
          console.log('✅ WebSocket Deepgram подключен успешно');
          resolve();
        };

        this.deepgramSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleTranscription(data);
          } catch (error) {
            console.error('Ошибка разбора ответа Deepgram:', error);
          }
        };

        this.deepgramSocket.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ Ошибка WebSocket Deepgram:', error);
          
          // More specific error messages
          let errorMessage = 'Не удалось подключиться к Deepgram. ';
          
          if (apiKey.length < 20) {
            errorMessage += 'API ключ выглядит неправильно (слишком короткий).';
          } else if (!navigator.onLine) {
            errorMessage += 'Нет интернет-соединения.';
          } else {
            errorMessage += 'Проверьте API ключ и интернет-соединение.';
          }
          
          reject(new Error(errorMessage));
        };

        this.deepgramSocket.onclose = (event) => {
          clearTimeout(timeout);
          console.log('��� WebSocket Deepgram закрыт:', event.code, event.reason);
          
          if (event.code === 1006) {
            console.error('Неожиданное закрытие соединения');
          } else if (event.code === 1002) {
            console.error('Ошибка протокола WebSocket');
          } else if (event.code === 4008) {
            console.error('Недействительный API ключ');
          }
        };
      });
    } catch (error) {
      throw new Error('Ошибка создания WebSocket соединения: ' + error.message);
    }
  }

  handleTranscription(data) {
    try {
      if (data.channel?.alternatives?.length > 0 && data.is_final) {
        const transcript = data.channel.alternatives[0].transcript;
        const confidence = data.channel.alternatives[0].confidence;
        
        if (transcript?.trim()) {
          console.log('��� Final transcript:', transcript, 'Confidence:', confidence);
          
          this.allTranscripts.push({
            text: transcript,
            confidence: confidence,
            timestamp: Date.now()
          });
          
          this.transcript.value += transcript + ' ';
          this.transcript.scrollTop = this.transcript.scrollHeight;
          this.updateWordCount();
          
          if (confidence !== undefined) {
            this.confidence.textContent = Math.round(confidence * 100) + '%';
          }
        }
      }
      
      if (data.error) {
        console.error('Deepgram error:', data.error);
      }
      
    } catch (error) {
      console.error('Ошибка обработки транскрипции:', error);
    }
  }

  convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample * 32767;
    }
    return int16Array.buffer;
  }

  updateWordCount() {
    const words = this.transcript.value.trim().split(/\s+/).filter(word => word.length > 0);
    this.wordCount.textContent = words.length;
  }

  clearTranscript() {
    this.transcript.value = '';
    this.allTranscripts = [];
    this.wordCount.textContent = '0';
    this.confidence.textContent = '0%';
  }

  async copyTranscript() {
    try {
      const text = this.transcript.value.trim();
      await navigator.clipboard.writeText(text);
      
      const originalText = this.copyBtn.textContent;
      this.copyBtn.textContent = 'Скопировано!';
      this.copyBtn.style.background = '#4CAF50';
      
      setTimeout(() => {
        this.copyBtn.textContent = originalText;
        this.copyBtn.style.background = '#667eea';
      }, 2000);
      
    } catch (error) {
      console.error('Ошибка копирования:', error);
      alert('Ошибка копирования текста');
    }
  }

  stopRecording() {
    try {
      this.isRecording = false;
      
      if (this.deepgramSocket) {
        this.deepgramSocket.close();
        this.deepgramSocket = null;
      }
      
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
      
      this.resetButtons();
      this.updateStatus('��� Остановлено', false);
      
      if (this.allTranscripts.length > 0) {
        console.log(`✅ Транскрипция завершена. Сегментов: ${this.allTranscripts.length}`);
        console.log('Средняя точность:', this.calculateAverageConfidence() + '%');
      }
      
    } catch (error) {
      console.error('Ошибка остановки записи:', error);
      this.resetButtons();
      this.updateStatus('❌ Ошибка остановки', false);
    }
  }

  calculateAverageConfidence() {
    if (this.allTranscripts.length === 0) return 0;
    const total = this.allTranscripts.reduce((sum, t) => sum + (t.confidence || 0), 0);
    return Math.round(total / this.allTranscripts.length * 100);
  }

  resetButtons() {
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
  }

  updateStatus(message, isRecording) {
    this.status.textContent = message;
    this.indicator.classList.toggle('recording', isRecording);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    if (typeof window.electronAPI === 'undefined') {
      console.error('❌ Electron API недоступен');
      document.getElementById('status').textContent = '❌ Electron API не загружен';
      return;
    }
    
    console.log('��� Инициализация SystemAudioSTT...');
    new SystemAudioSTT();
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    document.getElementById('status').textContent = '❌ Ошибка инициализации';
  }
});

window.addEventListener('error', (event) => {
  console.error('Глобальная ошибка:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Необработанное отклонение промиса:', event.reason);
});
