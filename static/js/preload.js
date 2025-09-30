const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Aqui você pode expor funções Node seguras para o renderer
});
