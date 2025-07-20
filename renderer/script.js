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
    
    // API kalitlari
    this.API_KEY = null;
    this.ASSISTANT_ID = null;
    this.keysLoaded = false;

    this.initializeElements();
    this.setupEventListeners();
    this.loadSources();
    this.loadAPIKeys(); // API kalitlarini yuklash
    this.testDeepgramConnection();
  }

  // API kalitlarini yuklash
  async loadAPIKeys() {
    try {
      console.log("API kalitlarini yuklamoqda...");
      
      this.API_KEY = await window.electronAPI.getOpenAIKey();
      this.ASSISTANT_ID = await window.electronAPI.getAssistantId();
      
      console.log("API_KEY loaded:", this.API_KEY ? `Yes (${this.API_KEY.length} chars)` : "No");
      console.log("ASSISTANT_ID loaded:", this.ASSISTANT_ID ? `Yes (${this.ASSISTANT_ID})` : "No");
      
      if (!this.API_KEY || this.API_KEY === "your_openai_api_key_here") {
        console.warn("OpenAI API key not configured");
        this.updateStatus("⚠️ OpenAI API key ni .env fayliga qo'shing", false);
      }
      
      if (!this.ASSISTANT_ID || this.ASSISTANT_ID === "your_assistant_id_here") {
        console.warn("Assistant ID not configured");
        this.updateStatus("⚠️ Assistant ID ni .env fayliga qo'shing", false);
      }

      if (this.API_KEY && this.ASSISTANT_ID) {
        this.keysLoaded = true;
        console.log("✅ API kalitlar muvaffaqiyatli yuklandi");
        this.updateStatus("✅ API kalitlar yuklandi", false);
      }
      
    } catch (error) {
      console.error("API kalitlarini yuklashda xato:", error);
      this.updateStatus("❌ API kalitlarini yuklashda xato", false);
    }
  }

  initializeElements() {
    this.startBtn = document.getElementById("startBtn");
    this.stopBtn = document.getElementById("stopBtn");
    this.clearBtn = document.getElementById("clearBtn");
    this.copyBtn = document.getElementById("copyBtn");
    this.status = document.getElementById("status");
    this.indicator = document.getElementById("indicator");
    this.transcript = document.getElementById("transcript");
    this.wordCount = document.getElementById("wordCount");
    this.confidence = document.getElementById("confidence");
    this.language = document.getElementById("language");
    this.askBtn = document.getElementById("send");
    this.clearResponse = document.getElementById("clearResponse");
    this.responseChatGPT = document.getElementById("responseOfChatGPT");

    // Elementlarni tekshirish
    if (!this.status) {
      console.warn("Status element topilmadi");
    }
    if (!this.indicator) {
      console.warn("Indicator element topilmadi");
    }
  }

  setupEventListeners() {
    if (this.startBtn) {
      this.startBtn.addEventListener("click", () => this.startRecording());
    }
    if (this.stopBtn) {
      this.stopBtn.addEventListener("click", () => this.stopRecording());
    }
    if (this.clearBtn) {
      this.clearBtn.addEventListener("click", () => this.clearTranscript());
    }
    if (this.copyBtn) {
      this.copyBtn.addEventListener("click", () => this.copyTranscript());
    }
    if (this.askBtn) {
      this.askBtn.addEventListener("click", () =>
        this.sendToAssistant(this.transcript.value)
      );
    }
    if (this.clearResponse) {
      this.clearResponse.addEventListener("click", () => this.clearResponseText());
    }
  }

  // Response matnini tozalash
  clearResponseText() {
    if (this.responseChatGPT) {
      this.responseChatGPT.value = "";
    }
  }

  async sendToAssistant(USER_MESSAGE) {
    try {
      console.log("sendToAssistant boshlandi");

      // Agar kalitlar yuklanmagan bo'lsa, qayta yuklash
      if (!this.keysLoaded) {
        console.log("API kalitlar yuklanmagan, qayta yuklamoqda...");
        await this.loadAPIKeys();
      }

      // API kalitlarini tekshirish
      if (!this.API_KEY || this.API_KEY === "your_openai_api_key_here") {
        throw new Error("OpenAI API key not configured. Please add it to .env file.");
      }
      
      if (!this.ASSISTANT_ID || this.ASSISTANT_ID === "your_assistant_id_here") {
        throw new Error("Assistant ID not configured. Please add it to .env file.");
      }

      if (!USER_MESSAGE || USER_MESSAGE.trim() === "") {
        throw new Error("Matn bo'sh. Avval audio yozib oling.");
      }

      // Loading holatini ko'rsatish
      this.responseChatGPT.value = "ChatGPT javob bermoqda...";
      this.askBtn.disabled = true;
      this.askBtn.innerHTML = 'Yuklanmoqda... <i class="bi bi-hourglass-split"></i>';

      console.log("API Key bor:", this.API_KEY ? "Ha" : "Yo'q");
      console.log("Assistant ID:", this.ASSISTANT_ID);
      console.log("User message uzunligi:", USER_MESSAGE.length);

      // 1. Thread yaratish
      console.log("1. Thread yaratmoqda...");
      const threadRes = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2"
        },
      });

      console.log("Thread response status:", threadRes.status);

      if (!threadRes.ok) {
        const errorText = await threadRes.text();
        console.error("Thread yaratish xatosi:", threadRes.status, errorText);
        throw new Error(`Thread yaratishda xato: ${threadRes.status} - ${errorText}`);
      }

      const threadData = await threadRes.json();
      const threadId = threadData.id;
      console.log("✅ Thread yaratildi:", threadId);

      // 2. Xabar yuborish
      console.log("2. Xabar yubormoqda...");
      const messageRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.API_KEY}`,
          "Content-Type": "application/json",
          "OpenAI-Beta": "assistants=v2"
        },
        body: JSON.stringify({
          role: "user",
          content: USER_MESSAGE,
        }),
      });

      console.log("Message response status:", messageRes.status);

      if (!messageRes.ok) {
        const errorText = await messageRes.text();
        console.error("Xabar yuborish xatosi:", messageRes.status, errorText);
        throw new Error(`Xabar yuborishda xato: ${messageRes.status} - ${errorText}`);
      }

      console.log("✅ Xabar yuborildi");

      // 3. Run yaratish (assistantni ishga tushirish)
      console.log("3. Run yaratmoqda...");
      const runRes = await fetch(
        `https://api.openai.com/v1/threads/${threadId}/runs`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2"
          },
          body: JSON.stringify({
            assistant_id: this.ASSISTANT_ID,
          }),
        }
      );

      console.log("Run response status:", runRes.status);

      if (!runRes.ok) {
        const errorText = await runRes.text();
        console.error("Run yaratish xatosi:", runRes.status, errorText);
        throw new Error(`Run yaratishda xato: ${runRes.status} - ${errorText}`);
      }

      const runData = await runRes.json();
      const runId = runData.id;
      console.log("✅ Run boshlandi:", runId);

      // 4. Run holatini tekshirib, tugaguncha kutish
      console.log("4. Run holatini kuzatmoqda...");
      let status = "queued";
      let attempts = 0;
      const maxAttempts = 60; // 60 sekund max kutish

      while (status !== "completed" && status !== "failed" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 sekund kutish
        attempts++;

        const runStatusRes = await fetch(
          `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
          {
            headers: {
              Authorization: `Bearer ${this.API_KEY}`,
              "OpenAI-Beta": "assistants=v2"
            },
          }
        );

        if (!runStatusRes.ok) {
          const errorText = await runStatusRes.text();
          console.error("Run status xatosi:", runStatusRes.status, errorText);
          throw new Error(`Run holatini tekshirishda xato: ${runStatusRes.status}`);
        }

        const runStatus = await runStatusRes.json();
        status = runStatus.status;

        // Progress ko'rsatish
        this.responseChatGPT.value = `ChatGPT javob bermoqda... (${attempts}s) - Status: ${status}`;

        console.log(`Run status: ${status} (${attempts}s)`);

        if (status === "failed") {
          console.error("Run failed:", runStatus);
          throw new Error("Assistant ishlov berishda muvaffaqiyatsiz bo'ldi");
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error("Vaqt tugadi - assistant juda uzoq javob beryapti");
      }

      // 5. Javobni olish
      console.log("5. Javobni olamoqda...");
      const finalMessageRes = await fetch(
        `https://api.openai.com/v1/threads/${threadId}/messages`,
        {
          headers: {
            Authorization: `Bearer ${this.API_KEY}`,
            "OpenAI-Beta": "assistants=v2"
          },
        }
      );

      console.log("Final message response status:", finalMessageRes.status);

      if (!finalMessageRes.ok) {
        const errorText = await finalMessageRes.text();
        console.error("Messages olish xatosi:", finalMessageRes.status, errorText);
        throw new Error(`Javobni olishda xato: ${finalMessageRes.status}`);
      }

      const messageData = await finalMessageRes.json();
      
      if (!messageData.data || messageData.data.length === 0) {
        throw new Error("Javob topilmadi");
      }

      const assistantReply = messageData.data[0].content[0].text.value;

      // 6. Javobni textarea'ga ko'rsatish
      this.responseChatGPT.value = assistantReply;
      
      console.log("✅ Assistant javobi muvaffaqiyatli olindi");

    } catch (error) {
      console.error("SendToAssistant xatosi:", error);
      this.responseChatGPT.value = `Xato yuz berdi: ${error.message}`;
    } finally {
      // Tugmani qayta faollashtirish
      this.askBtn.disabled = false;
      this.askBtn.innerHTML = 'Отправит <i class="bi bi-send"></i>';
    }
  }

  // Deepgram connection test
  async testDeepgramConnection() {
    try {
      const apiKey = await window.electronAPI.getDeepgramKey();
      if (!apiKey || apiKey === "your_deepgram_api_key_here") {
        this.updateStatus("⚠️ Настройте API ключ в .env файле", false);
        return false;
      }

      // Test HTTP connection first
      console.log("Тестирование HTTP подключения к Deepgram...");

      return true;
    } catch (error) {
      console.error("Ошибка тестирования подключения:", error);
      return false;
    }
  }

  async loadSources() {
    try {
      console.log("Загрузка источников рабочего стола...");
      this.sources = await window.electronAPI.getSources();
      console.log(`Загружено ${this.sources.length} источников`);
    } catch (error) {
      console.error("Ошибка загрузки источников:", error);
      this.sources = [];
    }
  }

  async startRecording() {
    try {
      this.updateStatus("Проверка API ключа...", false);

      // Deepgram API key validation
      const apiKey = await window.electronAPI.getDeepgramKey();
      if (!apiKey || apiKey === "your_deepgram_api_key_here") {
        throw new Error(
          "API ключ Deepgram не настроен. Откройте файл .env и добавьте ваш ключ."
        );
      }

      console.log("API ключ найден, длина:", apiKey.length);

      this.updateStatus("Настройка аудио...", false);
      this.clearTranscript();
      this.allTranscripts = [];

      // System audio capture
      await this.captureSystemAudio();

      this.updateStatus("Подключение к Deepgram...", false);

      // Simplified Deepgram connection
      await this.connectToDeepgramSimple(apiKey);

      this.isRecording = true;
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.updateStatus("🎙️ Запись...", true);
    } catch (error) {
      console.error("Ошибка начала записи:", error);
      this.updateStatus("❌ " + error.message, false);
      this.resetButtons();
    }
  }

  async captureSystemAudio() {
    try {
      console.log("Запуск захвата системного аудио...");

      try {
        this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 16000, // Back to standard rate for stability
            channelCount: 1,
          },
        });

        console.log("✅ getDisplayMedia успешно");

        // Stop video track
        const videoTracks = this.mediaStream.getVideoTracks();
        videoTracks.forEach((track) => track.stop());
      } catch (error1) {
        console.log("getDisplayMedia не удалось, пробуем метод Electron...");

        if (this.sources.length === 0) {
          await this.loadSources();
        }

        if (this.sources.length === 0) {
          throw new Error("Нет доступных источников рабочего стола");
        }

        const screenSource =
          this.sources.find(
            (s) =>
              s.name.includes("Screen") ||
              s.name.includes("Экран") ||
              s.name.includes("Entire") ||
              s.name.includes("screen")
          ) || this.sources[0];

        console.log("Используем источник:", screenSource.name);

        const constraints = await window.electronAPI.getMediaConstraints(
          screenSource.id
        );
        if (!constraints) {
          throw new Error("Не удалось получить медиа-ограничения");
        }

        this.mediaStream = await navigator.mediaDevices.getUserMedia(
          constraints
        );
        console.log("✅ Захват рабочего стола Electron успешен");
      }

      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error(
          'Аудио треки не найдены. Убедитесь, что при выборе экрана включили "Поделиться аудио"'
        );
      }

      console.log(`✅ Аудио треки: ${audioTracks.length}`);

      // Simple audio context setup
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = this.audioContext.createMediaStreamSource(
        this.mediaStream
      );

      // Simple processor
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (event) => {
        if (
          this.deepgramSocket &&
          this.deepgramSocket.readyState === WebSocket.OPEN
        ) {
          const audioData = event.inputBuffer.getChannelData(0);
          const int16Array = this.convertFloat32ToInt16(audioData);
          this.deepgramSocket.send(int16Array);
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      console.log("✅ Настройка аудио обработки завершена");
    } catch (error) {
      throw new Error("Не удалось захватить системное аудио: " + error.message);
    }
  }

  // Simplified Deepgram connection
  async connectToDeepgramSimple(apiKey) {
    try {
      // Basic connection parameters
      const params = {
        encoding: "linear16",
        sample_rate: "16000",
        channels: "1",
        interim_results: "false",
        punctuate: "true",
        smart_format: "true",
        model: "nova-2",
        language: "ru",
      };

      const wsUrl = `wss://api.deepgram.com/v1/listen?${new URLSearchParams(
        params
      ).toString()}`;

      console.log("Подключение к Deepgram...");
      console.log("URL:", wsUrl.substring(0, 50) + "...");

      this.deepgramSocket = new WebSocket(wsUrl, ["token", apiKey]);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("⏰ Таймаут подключения к Deepgram");
          reject(
            new Error(
              "Таймаут подключения к Deepgram (15 сек). Проверьте интернет и API ключ."
            )
          );
        }, 15000);

        this.deepgramSocket.onopen = () => {
          clearTimeout(timeout);
          console.log("✅ WebSocket Deepgram подключен успешно");
          resolve();
        };

        this.deepgramSocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleTranscription(data);
          } catch (error) {
            console.error("Ошибка разбора ответа Deepgram:", error);
          }
        };

        this.deepgramSocket.onerror = (error) => {
          clearTimeout(timeout);
          console.error("❌ Ошибка WebSocket Deepgram:", error);

          // More specific error messages
          let errorMessage = "Не удалось подключиться к Deepgram. ";

          if (apiKey.length < 20) {
            errorMessage += "API ключ выглядит неправильно (слишком короткий).";
          } else if (!navigator.onLine) {
            errorMessage += "Нет интернет-соединения.";
          } else {
            errorMessage += "Проверьте API ключ и интернет-соединение.";
          }

          reject(new Error(errorMessage));
        };

        this.deepgramSocket.onclose = (event) => {
          clearTimeout(timeout);
          console.log(
            "🔌 WebSocket Deepgram закрыт:",
            event.code,
            event.reason
          );

          if (event.code === 1006) {
            console.error("Неожиданное закрытие соединения");
          } else if (event.code === 1002) {
            console.error("Ошибка протокола WebSocket");
          } else if (event.code === 4008) {
            console.error("Недействительный API ключ");
          }
        };
      });
    } catch (error) {
      throw new Error("Ошибка создания WebSocket соединения: " + error.message);
    }
  }

  handleTranscription(data) {
    try {
      if (data.channel?.alternatives?.length > 0 && data.is_final) {
        const transcript = data.channel.alternatives[0].transcript;
        const confidence = data.channel.alternatives[0].confidence;

        if (transcript?.trim()) {
          console.log(
            "🎯 Final transcript:",
            transcript,
            "Confidence:",
            confidence
          );

          this.allTranscripts.push({
            text: transcript,
            confidence: confidence,
            timestamp: Date.now(),
          });

          this.transcript.value += transcript + " ";
          this.transcript.scrollTop = this.transcript.scrollHeight;
          this.updateWordCount();

          if (confidence !== undefined) {
            this.confidence.textContent = Math.round(confidence * 100) + "%";
          }
        }
      }

      if (data.error) {
        console.error("Deepgram error:", data.error);
      }
    } catch (error) {
      console.error("Ошибка обработки транскрипции:", error);
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
    const words = this.transcript.value
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    this.wordCount.textContent = words.length;
  }

  clearTranscript() {
    this.transcript.value = "";
    this.allTranscripts = [];
    this.wordCount.textContent = "0";
    this.confidence.textContent = "0%";
  }

  async copyTranscript() {
    try {
      const text = this.transcript.value.trim();
      await navigator.clipboard.writeText(text);

      const originalText = this.copyBtn.textContent;
      this.copyBtn.textContent = "Скопировано!";
      this.copyBtn.style.background = "#4CAF50";

      setTimeout(() => {
        this.copyBtn.textContent = originalText;
        this.copyBtn.style.background = "#667eea";
      }, 2000);
    } catch (error) {
      console.error("Ошибка копирования:", error);
      alert("Ошибка копирования текста");
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
        this.mediaStream.getTracks().forEach((track) => track.stop());
        this.mediaStream = null;
      }

      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.resetButtons();
      this.updateStatus("⏹️ Остановлено", false);

      if (this.allTranscripts.length > 0) {
        console.log(
          `✅ Транскрипция завершена. Сегментов: ${this.allTranscripts.length}`
        );
        console.log(
          "Средняя точность:",
          this.calculateAverageConfidence() + "%"
        );
      }
    } catch (error) {
      console.error("Ошибка остановки записи:", error);
      this.resetButtons();
      this.updateStatus("❌ Ошибка остановки", false);
    }
  }

  calculateAverageConfidence() {
    if (this.allTranscripts.length === 0) return 0;
    const total = this.allTranscripts.reduce(
      (sum, t) => sum + (t.confidence || 0),
      0
    );
    return Math.round((total / this.allTranscripts.length) * 100);
  }

  resetButtons() {
    this.startBtn.disabled = false;
    this.stopBtn.disabled = true;
  }

  updateStatus(message, isRecording) {
    if (this.status) {
      this.status.textContent = message;
    } else {
      console.log("Status:", message);
    }
    
    if (this.indicator) {
      this.indicator.classList.toggle("recording", isRecording);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    if (typeof window.electronAPI === "undefined") {
      console.error("❌ Electron API недоступен");
      const statusEl = document.getElementById("status");
      if (statusEl) {
        statusEl.textContent = "❌ Electron API не загружен";
      }
      return;
    }

    console.log("🚀 Инициализация SystemAudioSTT...");
    new SystemAudioSTT();
  } catch (error) {
    console.error("❌ Ошибка инициализации:", error);
    const statusEl = document.getElementById("status");
    if (statusEl) {
      statusEl.textContent = "❌ Ошибка инициализации";
    }
  }
});

window.addEventListener("error", (event) => {
  console.error("Глобальная ошибка:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Необработанное отклонение промиса:", event.reason);
});