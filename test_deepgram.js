const WebSocket = require('ws');
require('dotenv').config();

async function testDeepgramConnection() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  console.log('� Testing Deepgram connection...');
  console.log('API Key length:', apiKey ? apiKey.length : 0);
  console.log('API Key starts with:', apiKey ? apiKey.substring(0, 8) + '...' : 'NOT FOUND');
  
  if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
    console.error('❌ API key not configured in .env file');
    return;
  }
  
  const wsUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&language=ru';
  
  try {
    const ws = new WebSocket(wsUrl, ['token', apiKey]);
    
    ws.on('open', () => {
      console.log('✅ Deepgram WebSocket connection successful!');
      ws.close();
    });
    
    ws.on('error', (error) => {
      console.error('❌ Deepgram connection failed:', error.message);
    });
    
    ws.on('close', (code, reason) => {
      console.log('� Connection closed:', code, reason.toString());
    });
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  }
}

testDeepgramConnection();
