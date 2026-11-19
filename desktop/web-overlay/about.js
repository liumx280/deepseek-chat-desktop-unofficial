(function () {
  'use strict'
  var app = window.dshApp || null
  var VERSION = (app && app.version) || '1.0.2'
  var ENV = (app && app.runtime) || 'Android WebView'
  var BRAND = 'DeepSeek Chat'

  function openExternal(url) {
    if (app && app.openExternal) return app.openExternal(url)
    window.open(url, '_blank')
  }

  function row(label, value) {
    return '<div class="dsa-row"><span class="dsa-k">' + label + '</span><span class="dsa-v">' + value + '</span></div>'
  }

  function styles() {
    if (document.getElementById('dsa-style')) return
    var css = [
      '#dsa-mask{display:none;position:fixed;inset:0;z-index:4000;background:rgba(17,20,28,.38);align-items:center;justify-content:center;padding:24px}',
      '#dsa-mask.open{display:flex}',
      '#dsa-card{width:100%;max-width:420px;max-height:82vh;overflow:auto;background:#fff;border-radius:18px;padding:22px 22px 16px;box-shadow:0 18px 56px rgba(20,26,40,.2);font:400 13.5px/1.75 var(--ds-font-family,system-ui,sans-serif);color:#3c4149}',
      '#dsa-nav[aria-selected="true"]{background:rgba(31,35,41,.06);border-radius:8px}',
      '#dsa-card h3{margin:0 0 2px;font-size:17px;font-weight:600;color:#1f2329}',
      '#dsa-card .dsa-sub{margin:0 0 14px;color:#8a8f99;font-size:12.5px}',
      '.dsa-row{display:flex;gap:12px;padding:9px 0;border-bottom:1px solid rgba(31,35,41,.06);font-size:13px}',
      '.dsa-row:last-of-type{border-bottom:none}',
      '.dsa-k{flex:0 0 76px;color:#8a8f99}',
      '.dsa-v{flex:1;color:#1f2329;word-break:break-all}',
      '#dsa-card p.dsa-note{margin:12px 0 0;font-size:12.5px;color:#5b6270;line-height:1.8}',
      '#dsa-card .dsa-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}',
      '#dsa-card .dsa-actions button{flex:1 1 auto;padding:9px 12px;border:1px solid rgba(77,107,254,.24);border-radius:10px;background:#f5f7ff;color:#3352e0;font:500 13px/1.4 var(--ds-font-family,system-ui,sans-serif);cursor:pointer}',
      '#dsa-card .dsa-close{width:100%;margin-top:12px;padding:10px;border:none;border-radius:10px;background:#4d6bfe;color:#fff;font:600 14px/1.2 var(--ds-font-family,system-ui,sans-serif);cursor:pointer}',
    ].join('')
    var s = document.createElement('style')
    s.id = 'dsa-style'
    s.textContent = css
    document.head.appendChild(s)
  }

  function panel() {
    styles()
    var mask = document.getElementById('dsa-mask')
    if (!mask) {
      var extra = ''
      if (app) {
        extra = '<div class="dsa-row"><span class="dsa-k">数据目录</span><span class="dsa-v">' + (app.dataDir || '') + '</span></div>'
      }
      var actions = ''
      if (app) {
        actions = '<div class="dsa-actions"><button data-act="data">打开数据文件夹</button>' +
          '<button data-act="log">查看启动日志</button>' +
          '<button data-act="repo">项目主页</button></div>'
      }
      mask = document.createElement('div')
      mask.id = 'dsa-mask'
      mask.innerHTML = '<div id="dsa-card" role="dialog" aria-modal="true">' +
        '<h3>' + BRAND + '</h3>' +
        '<p class="dsa-sub">非官方客户端</p>' +
        row('版本', 'v' + VERSION) +
        row('运行环境', ENV) +
        extra +
        '<p class="dsa-note">本应用将 DeepSeek 官方 chat-demo 示例封装为独立客户端，界面与交互源自官方示例；模型服务由 DeepSeek 官方 API 提供，需自行填写 API 密钥。本项目由第三方维护，与 DeepSeek 官方无隶属关系，亦不代表官方立场。</p>' +
        '<p class="dsa-note">对话记录、设置与密钥仅保存在本机，除调用 DeepSeek API 外不向第三方传输；卸载应用会清除本机数据。</p>' +
        actions +
        '<button class="dsa-close" type="button">关闭</button>' +
        '</div>'
      document.body.appendChild(mask)
      var close = function () {
        mask.className = ''
        var b = document.getElementById('dsa-nav')
        if (b) b.setAttribute('aria-selected', 'false')
      }
      mask.addEventListener('click', function (e) { if (e.target === mask) close() })
      mask.querySelector('.dsa-close').addEventListener('click', close)
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close() })
      var acts = mask.querySelectorAll('.dsa-actions button')
      for (var i = 0; i < acts.length; i++) {
        acts[i].addEventListener('click', function (e) {
          var act = e.currentTarget.getAttribute('data-act')
          if (act === 'data' && app.openDataFolder) app.openDataFolder()
          else if (act === 'log' && app.openLog) app.openLog()
          else if (act === 'repo') openExternal('https://github.com/liumx280/deepseek-chat-desktop-unofficial')
        })
      }
    }
    mask.className = 'open'
  }

  // 只在「设置」弹窗里出现入口：等 Settings 对话框的左侧导航渲染出来再插入
  function ensureEntry() {
    var nav = document.querySelector('[class*="navigation-"]')
    if (!nav || nav.querySelector('#dsa-nav')) return false
    var proto = nav.querySelector('[class*="navItem-"]')
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.id = 'dsa-nav'
    btn.setAttribute('role', 'tab')
    btn.setAttribute('aria-selected', 'false')
    btn.className = proto ? proto.className : ''
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.2"/><path d="M8 7.2v4.1M8 4.9v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>关于'
    btn.addEventListener('click', function () {
      btn.setAttribute('aria-selected', 'true')
      panel()
    })
    nav.appendChild(btn)
    return true
  }

  var timer = 0
  function schedule() {
    if (timer) return
    timer = setTimeout(function () { timer = 0; ensureEntry() }, 120)
  }

  function boot() {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
    schedule()
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
})()
