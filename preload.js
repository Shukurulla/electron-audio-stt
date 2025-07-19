const { contextBridge, ipcRenderer } = require('electron');

// Secure IPC API
const electronAPI = {
  // Desktop sources olish
  getSources: async () => {
    try {
      return await ipcRenderer.invoke('get-sources');
    } catch (error) {
      console.error('Error in getSources:', error);
      return [];
    }
  },

  // Deepgram API key olish
  getDeepgramKey: async () => {
    try {
      return await ipcRenderer.invoke('get-deepgram-key');
    } catch (error) {
      console.error('Error in getDeepgramKey:', error);
      return null;
    }
  },

  // Media constraints olish
  getMediaConstraints: async (sourceId) => {
    try {
      return await ipcRenderer.invoke('get-media-constraints', sourceId);
    } catch (error) {
      console.error('Error in getMediaConstraints:', error);
      return null;
    }
  }
};

// Context bridge orqali xavfsiz API expose qilish
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Console log polyfill (debugging uchun)
contextBridge.exposeInMainWorld('electronConsole', {
  log: (...args) => console.log('[Renderer]', ...args),
  error: (...args) => console.error('[Renderer]', ...args),
  warn: (...args) => console.warn('[Renderer]', ...args)
});

// Error handling
window.addEventListener('error', (event) => {
  console.error('Renderer error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
