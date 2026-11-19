const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const http = require('node:http')

// ----------------------------- boot diagnostics -----------------------------
// 启动阶段写 %TEMP%\deepseek-chat-boot.log，便于定位「双击没反应」
const BOOT = path.join(os.tmpdir(), 'deepseek-chat-boot.log')
function boot(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n'
  try {
    fs.appendFileSync(BOOT, line)
  } catch {}
  try {
    process.stdout.write(line)
  } catch {}
}
boot('module start pid=' + process.pid + ' execPath=' + process.execPath + ' argv=' + JSON.stringify(process.argv.slice(1)))
process.on('uncaughtException', (e) => boot('uncaughtException ' + ((e && e.stack) || e)))
process.on('unhandledRejection', (e) => boot('unhandledRejection ' + ((e && e.stack) || e)))

// 打包后资源在 resources/app/web，开发时直接用 repo/dist
const DIST = fs.existsSync(path.join(__dirname, 'web', 'index.html'))
  ? path.join(__dirname, 'web')
  : path.join(__dirname, '..', 'repo', 'dist')
boot('DIST=' + DIST + ' indexExists=' + fs.existsSync(path.join(DIST, 'index.html')))
boot('electron=' + process.versions.electron + ' chrome=' + process.versions.chrome)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
}

// 窗口图标（打包后随 resources/app/build 一起分发）
const ICON_PATH = path.join(__dirname, 'build', 'icon.ico')

let server = null

// 固定端口：浏览器存储（localStorage / IndexedDB）按「源」隔离，而源里包含端口号。
// 端口一变就等于换了一个网站，重启后 API Key 与聊天记录会全部“消失”。
// 所以必须在每次启动时用同一个端口；只有被别的程序占用时才顺延。
const PREFERRED_PORT = Number(process.env.DEEPSEEK_CHAT_PORT || 17890)
// 端口固定：浏览器存储按「源」隔离，端口一变旧数据就读不到，所以宁可等也不换端口
const PORT_WAIT_TRIES = 3
const PORT_WAIT_MS = 4000

// 本机静态服务：保留正常的 http(s) 源，浏览器存储、ServiceWorker 与语音权限都按普通站点处理
function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        let filePath = path.join(DIST, urlPath)
        if (!path.resolve(filePath).startsWith(path.resolve(DIST))) {
          res.writeHead(403).end('forbidden')
          return
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(DIST, 'index.html')
        }
        const body = fs.readFileSync(filePath)
        res.writeHead(200, {
          'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'cache-control': filePath.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable',
        })
        res.end(body)
      } catch (e) {
        res.writeHead(500).end(String(e))
      }
    })
    let attempt = 0
    const tryListen = () => {
      server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          attempt++
          if (attempt <= PORT_WAIT_TRIES) {
            boot('port ' + PREFERRED_PORT + ' busy (attempt ' + attempt + '), retry in ' + PORT_WAIT_MS + 'ms')
            setTimeout(tryListen, PORT_WAIT_MS)
            return
          }
          reject(new Error('PORT_IN_USE'))
          return
        }
        reject(err)
      })
      server.listen(PREFERRED_PORT, '127.0.0.1', () => {
        boot('static server on http://127.0.0.1:' + PREFERRED_PORT + ' (stable origin)')
        resolve(PREFERRED_PORT)
      })
    }
    tryListen()
  })
}

let win = null

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function restoreState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'))
  } catch {
    return { width: 1180, height: 820 }
  }
}

function saveState() {
  if (!win || win.isDestroyed()) return
  const b = win.getNormalBounds ? win.getNormalBounds() : win.getBounds()
  try {
    fs.writeFileSync(statePath(), JSON.stringify({ ...b, maximized: win.isMaximized() }))
  } catch {}
}

async function createWindow() {
  boot('createWindow start')
  const state = restoreState()
  win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 520,
    minHeight: 480,
    show: false,
    backgroundColor: '#ffffff',
    title: 'DeepSeek',
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    // 菜单栏默认收起（Alt 呼出）：关于/数据目录已放进应用内的「设置 → 关于」，
    // 顶部的原生菜单行和标题栏、侧栏品牌叠在一起会显得杂乱。
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })
  boot('BrowserWindow created')

  // 固定窗口标题，别让页面标题（"API 使用 demo"）顶掉应用名
  win.on('page-title-updated', (event) => {
    event.preventDefault()
    win.setTitle('DeepSeek')
  })

  if (state.maximized) win.maximize()

  // 外链一律交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const port = server ? server.address().port : 0
    if (!url.startsWith('http://127.0.0.1:' + port)) {
      event.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })
  // 崩溃 / 加载失败自动重载（最多两次），避免停在白屏
  let recoveries = 0
  const recover = (reason) => {
    if (!win || win.isDestroyed() || recoveries >= 2) {
      boot('recover skipped ' + reason + ' used=' + recoveries)
      return
    }
    recoveries++
    boot('recover #' + recoveries + ' ' + reason)
    setTimeout(() => {
      try {
        win.webContents.reload()
      } catch (e) {
        boot('reload failed ' + e.message)
      }
    }, 800)
  }
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    boot('did-fail-load ' + code + ' ' + desc + ' ' + url + ' main=' + isMainFrame)
    if (isMainFrame && code !== -3) recover('load ' + code)
  })
  win.webContents.on('render-process-gone', (_e, d) => {
    boot('render-process-gone ' + JSON.stringify(d))
    recover('renderer ' + d.reason)
  })
  win.webContents.on('unresponsive', () => boot('unresponsive'))
  win.webContents.on('responsive', () => boot('responsive'))
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) boot('renderer-console ' + message)
  })

  win.once('ready-to-show', () => {
    boot('ready-to-show -> show()')
    win.show()
  })
  win.on('close', saveState)
  win.on('closed', () => {
    win = null
    boot('window closed')
  })

  let port
  try {
    port = await startServer()
  } catch (e) {
    boot('startServer failed ' + ((e && e.message) || e))
    if (e && e.message === 'PORT_IN_USE') {
      dialog.showErrorBox(
        '端口被占用',
        'DeepSeek Chat 需要固定使用 127.0.0.1:' +
          PREFERRED_PORT +
          ' 来保存你的设置和聊天记录。\n\n' +
          '这个端口现在被别的程序占着。请关掉占用它的程序（通常是上一次没退干净的 DeepSeek Chat）后重新打开本应用。',
      )
    } else {
      dialog.showErrorBox('启动失败', String((e && e.stack) || e))
    }
    app.quit()
    return
  }
  boot('loadURL http://127.0.0.1:' + port + '/')
  await win.loadURL('http://127.0.0.1:' + port + '/')
  boot('loadURL done, visible=' + win.isVisible())
  if (!win.isVisible()) {
    // 某些环境 ready-to-show 不触发，兜底显示
    win.show()
    boot('forced show()')
  }

  // 数据迁移用：--dump-storage=<json> 导出本源的 localStorage，--load-storage=<json> 写回
  const dumpStoreArg = process.argv.find((a) => a.startsWith('--dump-storage='))
  const loadStoreArg = process.argv.find((a) => a.startsWith('--load-storage='))
  if (dumpStoreArg) {
    await new Promise((r) => setTimeout(r, 1800))
    const data = await win.webContents
      .executeJavaScript('JSON.stringify(Object.fromEntries(Object.entries(localStorage)))')
      .catch((e) => JSON.stringify({ __error: String(e) }))
    fs.writeFileSync(dumpStoreArg.slice('--dump-storage='.length), data)
    boot('storage dumped ' + data.length + ' bytes from port ' + port)
    app.quit()
    return
  }
  if (loadStoreArg) {
    await new Promise((r) => setTimeout(r, 1200))
    try {
      const raw = fs.readFileSync(loadStoreArg.slice('--load-storage='.length), 'utf8').replace(/^\uFEFF/, '')
      const json = JSON.parse(raw)
      const entries = JSON.stringify(Object.entries(json))
      const n = await win.webContents.executeJavaScript(
        '(() => { const e = ' + entries + '; let n = 0; for (const [k, v] of e) { try { localStorage.setItem(k, v); n++ } catch (err) {} } return n })()',
      )
      boot('storage imported ' + n + ' keys into port ' + port)
      // 等 Chromium 把 localStorage 落盘，避免退出太快丢写入
      await new Promise((r) => setTimeout(r, 2500))
    } catch (e) {
      boot('storage import failed ' + e.message)
    }
    app.quit()
    return
  }

  // 开发用：--shot=<png> 截图、--dump=<html> 导出 DOM，做完退出
  const shotArg = process.argv.find((a) => a.startsWith('--shot='))
  const dumpArg = process.argv.find((a) => a.startsWith('--dump='))
  if (shotArg || dumpArg) {
    await new Promise((r) => setTimeout(r, 2500))
    if (shotArg) {
      // 关掉首启自动弹出的设置面板，让截图看到主界面
      await win.webContents
        .executeJavaScript(
          'try { const b = document.querySelector(\'[class*="close-_83af2"]\'); if (b) b.click(); } catch (e) {}',
        )
        .catch(() => {})
      await new Promise((r) => setTimeout(r, 600))
      const out = shotArg.slice('--shot='.length)
      const img = await win.webContents.capturePage()
      fs.writeFileSync(out, img.toPNG())
      try {
        const fetchInfo = await win.webContents.executeJavaScript(`(async () => {
          try {
            const r = await fetch('/logo.svg');
            const txt = await r.text();
            return JSON.stringify({ status: r.status, ct: r.headers.get('content-type'), len: txt.length, head: txt.slice(0, 60) });
          } catch (e) { return 'fetch-err ' + e.message }
        })()`)
        boot('logo probe ' + fetchInfo)
        const info = await win.webContents.executeJavaScript(`(() => {
          const el = document.querySelector('[class*="appName"]');
          const cs = el ? getComputedStyle(el, '::before') : null;
          return JSON.stringify({
            found: !!el,
            content: cs && cs.content,
            bg: cs && cs.backgroundImage,
            w: cs && cs.width,
            h: cs && cs.height,
            display: cs && cs.display,
            sheets: [...document.styleSheets].map((s) => s.href),
            after: el ? getComputedStyle(el, '::after').content : null,
          });
        })()`)
        fs.writeFileSync(out + '.json', info)
      } catch (e) {
        boot('probe failed ' + e.message)
      }
      boot('shot ' + out + ' ' + img.getSize().width + 'x' + img.getSize().height)
    }
    if (dumpArg) {
      const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML')
      fs.writeFileSync(dumpArg.slice('--dump='.length), html)
      boot('dump written')
    }
    app.quit()
  }
}

// 便携版（解压即用）用自己目录存数据，避免和安装版互相覆盖
if (process.env.PORTABLE_EXECUTABLE_DIR && !process.env.DEEPSEEK_CHAT_SHARED_DATA) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'DeepSeekChat-data'))
  boot('portable userData -> ' + app.getPath('userData'))
}

if (!app.requestSingleInstanceLock()) {
  boot('single instance lock NOT acquired -> quit')
  app.quit()
} else {
  boot('single instance lock acquired')
  app.setAppUserModelId('com.deepseek.chat.desktop')

  app.on('second-instance', () => {
    boot('second-instance')
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    boot('app ready')
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      dialog.showErrorBox('缺少前端资源', '未找到 web/index.html，请先构建 chat-demo。')
      app.quit()
      return
    }
    // 「关于」面板（web-overlay/about.js）通过这几个通道读取本机信息
    ipcMain.on('dsh:version', (e) => { e.returnValue = app.getVersion() })
    ipcMain.on('dsh:runtime', (e) => {
      e.returnValue = 'Electron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome
    })
    ipcMain.on('dsh:datadir', (e) => { e.returnValue = app.getPath('userData') })
    ipcMain.on('dsh:open-data', () => shell.openPath(app.getPath('userData')))
    ipcMain.on('dsh:open-log', () => shell.showItemInFolder(BOOT))
    ipcMain.on('dsh:open-external', (_e, url) => {
      if (/^https?:/i.test(String(url))) shell.openExternal(String(url))
    })

    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'toggleDevTools', label: '开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '全屏' },
          { role: 'quit', label: '退出' },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'selectAll', label: '全选' },
        ],
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '关于 DeepSeek Chat',
            click: () => {
              dialog.showMessageBox(win, {
                type: 'info',
                title: '关于',
                message: 'DeepSeek Chat ' + app.getVersion(),
                detail: [
                  'Electron ' + process.versions.electron + ' / Chromium ' + process.versions.chrome,
                  '',
                  '数据目录：' + app.getPath('userData'),
                  '启动日志：' + BOOT,
                  '',
                  '非官方封装：本应用把 deepseek-ai/chat-demo 装进桌面外壳，调用官方 API，需要你自己的 API Key。',
                ].join('\n'),
                buttons: ['好'],
                noLink: true,
              })
            },
          },
          { label: '打开数据文件夹', click: () => shell.openPath(app.getPath('userData')) },
          { label: '查看启动日志', click: () => shell.showItemInFolder(BOOT) },
        ],
      },
    ]))
    await createWindow()
    boot('createWindow returned')
    app.on('activate', () => {
      boot('activate')
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  }).catch((e) => {
    boot('whenReady error ' + ((e && e.stack) || e))
  })

  app.on('window-all-closed', () => {
    boot('window-all-closed')
    app.quit()
  })

  app.on('before-quit', () => {
    boot('before-quit')
    if (server) server.close()
  })

  app.on('will-quit', () => boot('will-quit'))
}
