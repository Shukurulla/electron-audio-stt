const { app, BrowserWindow, ipcMain, desktopCapturer, session } = require('electron');
const path = require('path');
require('dotenv').config();

let mainWindow;

// Enhanced Electron settings for audio capture
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--enable-features', 'SharedArrayBuffer');
app.commandLine.appendSwitch('--enable-webrtc-experimental-audio-features');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile('renderer/index.html');
  
  // Enhanced permissions for better audio capture
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    const allowedPermissions = ['media', 'microphone', 'camera', 'display-capture', 'audio-capture', 'desktop-audio-capture'];
    callback(allowedPermissions.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    return true;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
}

app.whenReady().then(async () => {
  await createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Enhanced desktop capturer for better audio
ipcMain.handle('get-sources', async (event) => {
  try {
    console.log('Getting desktop sources with audio...');
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 },
      fetchWindowIcons: false
    });
    
    console.log(`Found ${sources.length} sources`);
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail ? source.thumbnail.toDataURL() : null
    }));
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

ipcMain.handle('get-deepgram-key', async (event) => {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
      throw new Error('Deepgram API key not configured');
    }
    return apiKey;
  } catch (error) {
    console.error('Error getting Deepgram key:', error);
    return null;
  }
});

// Enhanced media constraints for better audio quality
ipcMain.handle('get-media-constraints', async (event, sourceId) => {
  try {
    return {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googTypingNoiseDetection: false
        },
        optional: [
          { googAudioMirroring: false }
        ]
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minWidth: 1,
          maxWidth: 1,
          minHeight: 1,
          maxHeight: 1
        }
      }
    };
  } catch (error) {
    console.error('Error creating media constraints:', error);
    return null;
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
