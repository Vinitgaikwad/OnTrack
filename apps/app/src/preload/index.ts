import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ontrack', {
  closeDashboard: () => ipcRenderer.send('dashboard:close'),
  showDashboard: () => ipcRenderer.send('dashboard:show'),
  isDashboardVisible: () => ipcRenderer.invoke('dashboard:visible'),
  setDashboardAlwaysOnTop: (onTop: boolean) => ipcRenderer.send('dashboard:ontop', onTop),
  isDashboardAlwaysOnTop: () => ipcRenderer.invoke('dashboard:ontop:get'),
  showMain: () => ipcRenderer.send('dashboard:show-main'),
})