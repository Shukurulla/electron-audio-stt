# Electron System Audio Speech-to-Text

Real-time system audio transcription using Deepgram API and Electron.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file and add your Deepgram API key:
```
DEEPGRAM_API_KEY=your_api_key_here
```

3. Run the application:
```bash
npm start
```

## Features

- Real-time system audio capture
- High-accuracy speech-to-text using Deepgram Nova-2 model
- Clean, modern UI
- Real-time transcription display
- Word count and confidence metrics
- Optimized for performance

## Requirements

- Node.js 16+
- Deepgram API key
- Modern browser with WebRTC support

## Usage

1. Click "Start Recording"
2. Select screen/window to capture audio from
3. Real-time transcription will appear in the text area
4. Click "Stop Recording" to end session
