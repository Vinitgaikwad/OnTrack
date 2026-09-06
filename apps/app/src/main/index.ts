import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron'
import isDev from 'electron-is-dev'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'url'

const DASHBOARD_QUERY = 'widget=1'
const DASHBOARD_HASH = '/dashboard'
const DASHBOARD_DEFAULTS = { width: 340, height: 440 }

const dashboardSizePath = () => join(app.getPath('userData'), 'dashboard-size.json')

const readDashboardSize = (): { width: number; height: number } => {
  try {
    const raw = readFileSync(dashboardSizePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown }
    if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
      return { width: parsed.width, height: parsed.height }
    }
  } catch {
    // no saved size yet — fall through to defaults
  }
  return DASHBOARD_DEFAULTS
}

const writeDashboardSize = (width: number, height: number) => {
  try {
    writeFileSync(dashboardSizePath(), JSON.stringify({ width, height }))
  } catch {
    // persistence is best-effort
  }
}

const getUrl = (): string => {
  if (isDev) return 'http://localhost:3000/'

  return fileURLToPath(
    new URL(/* @vite-ignore */ '../../dist-web/index.html', import.meta.url)
  )
}

const getPreload = (): string =>
  fileURLToPath(
    new URL(/* @vite-ignore */ '../preload/index.mjs', import.meta.url)
  )

let mainWindow: BrowserWindow | null = null
let dashboardWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const createMainWindow = () => {
  const win = new BrowserWindow({
    title: 'OnTrack',
    autoHideMenuBar: true,
    width: 1200,
    height: 800,
    minWidth: 420,
    minHeight: 480,
    backgroundColor: '#f6f1e7',
    webPreferences: {
      nodeIntegration: true,
      preload: getPreload(),
    },
  })

  mainWindow = win
  win.on('close', (event) => {
    if (!isQuitting && tray) {
      event.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    mainWindow = null
  })

  const url = getUrl()
  isDev ? win.loadURL(url) : win.loadFile(url)
}

const createDashboardWindow = () => {
  const { width, height } = readDashboardSize()
  const workArea = screen.getPrimaryDisplay().workArea
  const x = Math.max(workArea.x, workArea.x + workArea.width - width)
  const y = workArea.y

  const win = new BrowserWindow({
    title: 'OnTrack Dashboard',
    autoHideMenuBar: true,
    width,
    height,
    minWidth: 300,
    minHeight: 360,
    x,
    y,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#f6f1e7',
    webPreferences: {
      nodeIntegration: true,
      preload: getPreload(),
    },
  })

  dashboardWindow = win
  win.setAlwaysOnTop(true, 'floating')
  win.once('ready-to-show', () => win.showInactive())
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    dashboardWindow = null
  })

  let resizeTimer: NodeJS.Timeout | null = null
  win.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      const [currentWidth, currentHeight] = win.getSize()
      writeDashboardSize(currentWidth, currentHeight)
    }, 300)
  })

  if (isDev) {
    win.loadURL(`http://localhost:3000/?${DASHBOARD_QUERY}#${DASHBOARD_HASH}`)
  } else {
    win.loadFile(getUrl(), { search: DASHBOARD_QUERY, hash: DASHBOARD_HASH })
  }
}

const showMainWindow = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

const showDashboardWindow = () => {
  if (!dashboardWindow || dashboardWindow.isDestroyed()) {
    createDashboardWindow()
    return
  }
  dashboardWindow.show()
}

const createTray = () => {
  const icon = nativeImage
    .createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKBSURBVFhH7VY9aBRBGE1paWlpaWmnN1OcV1kJFhZ2k01xCFocgpDKWCgiggoiEVHEQg4UjI1aCiGgTVKIEBAk2pxFis3u5X6Tc+RN7s6bN7tzu+ul88Erbu7b772Z+b5vd27uPwoiVOJkU8kzI+I3x8wUWpWPRErMx4GsR4HoxIHUSYwCubKjxKVQlY9yjsJAwigQv1jMTxFGStZgnPNlBnYRB+KTmzw7o0BuhurUcc49FXgoDuQWJyxGEaJOWCMVBzuflfiIIoxV6QRrOcCd/euxe7g1tThROAkPFmbrZtVeWxD3WXMM02q5qz2Zu9cu6EHjhwZ+t5q6WTtn1tHCu6p8jLUN0G6cqAghNthuGPERuq+X//6/IG6ztkEciA+cLC+bl8/qwc9vljjQunNlHIPWZG1T+b4Jl4nVit778pm1dX/tnRvLHREpedoJysm99VXWNmscZ6hK5y0DWHCChjTHV60465Psf1xhbb2/uZH6HLrNMpBYgNWKVcnte1edRGDv7TPWNnWAeuDYsYFA3iADpYsc1H64aGft9xwTnRd37RiIbzfGbZfGHSUXLQOY1RyEJBC1MGHCMTg8KcwAzsXEhi0DGA4cBHae3mINY6L35oljzogvzTs5koiitwwAae+ARBOMhOtJI6YtaxugMDg4q4n24yXnGQ+fs7YBrsE3jNJMoBA51kfv9yPeVvzAJLsvH1ji/bX3ToyP+GZkTQvDU/C+EdvL1/X+96+6++qR85+P5nR5BCcBFeq7iqJ0Ws8HBM/ShDP5suBgOImQk+UhNpFr54zhgKpz4ixEwWW68yxA66B/pxXo8MTquT7D88IUqZI13OuYStYOVfSw8AcP6vHcKFjx4AAAAABJRU5ErkJggg=='
    )
    .resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('OnTrack')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Dashboard', click: showDashboardWindow },
      { label: 'Show OnTrack', click: showMainWindow },
      { type: 'separator' },
      { label: 'Quit OnTrack', click: () => app.quit() },
    ])
  )
  tray.on('click', showMainWindow)
}

ipcMain.on('dashboard:close', () => {
  dashboardWindow?.hide()
})

ipcMain.on('dashboard:show', () => {
  showDashboardWindow()
})

ipcMain.handle('dashboard:visible', () => {
  return dashboardWindow?.isVisible() ?? false
})

ipcMain.on('dashboard:ontop', (_event, onTop: unknown) => {
  dashboardWindow?.setAlwaysOnTop(Boolean(onTop), 'floating')
})

ipcMain.handle('dashboard:ontop:get', () => {
  return dashboardWindow?.isAlwaysOnTop() ?? true
})

ipcMain.on('dashboard:show-main', () => {
  showMainWindow()
})

app.whenReady().then(() => {
  createTray()
  createMainWindow()
  createDashboardWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})