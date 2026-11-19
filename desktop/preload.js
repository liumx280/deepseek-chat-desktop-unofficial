// 只把「关于」需要的少量信息暴露给页面，页面本身不接触 Node。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dshApp', {
  platform: process.platform,
  version: ipcRenderer.sendSync('dsh:version'),
  runtime: ipcRenderer.sendSync('dsh:runtime'),
  dataDir: ipcRenderer.sendSync('dsh:datadir'),
  openDataFolder: () => ipcRenderer.send('dsh:open-data'),
  openLog: () => ipcRenderer.send('dsh:open-log'),
  openExternal: (url) => ipcRenderer.send('dsh:open-external', String(url)),
})
