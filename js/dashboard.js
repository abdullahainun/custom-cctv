// ─────────────────────────────────────────────────────────────────────────────
// dashboard.js — Stream player logic, UI controls, clock, system status checks
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  server:      '100.74.162.72',
  frigatePort: 5000,

  // Option A — port 1984 exposed in docker-compose (recommended):
  go2rtcBase: 'http://100.74.162.72:1984',

  // Option B — no port 1984 needed; Frigate proxies go2rtc at /go2rtc/:
  // go2rtcBase: 'http://100.74.162.72:5000/go2rtc',

  streams: {
    sub:  { name: 'hikvision_sub',  label: 'Sub Stream (720p)' },
    main: { name: 'hikvision_main', label: 'Main Stream (4K)'  },
  },
}

// ─── StreamPlayer ─────────────────────────────────────────────────────────────

class StreamPlayer {
  constructor() {
    this.quality   = 'sub'     // 'sub' | 'main'
    this.protocol  = 'webrtc'  // 'webrtc' | 'hls'
    this.hlsInst   = null

    this._iframe = document.getElementById('player-iframe')
    this._video  = document.getElementById('player-video')

    this._load()
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  _base() {
    return CONFIG.go2rtcBase
  }

  _streamName() {
    return CONFIG.streams[this.quality].name
  }

  _load() {
    this._updateUI()
    if (this.protocol === 'webrtc') {
      this._loadWebRTC()
    } else {
      this._loadHLS()
    }
  }

  _loadWebRTC() {
    this._destroyHLS()
    const url = `${this._base()}/links.html?src=${this._streamName()}&mode=webrtc`
    this._iframe.src = url
    this._iframe.classList.remove('hidden')
    this._video.classList.add('hidden')
  }

  _loadHLS() {
    // Blank out the iframe so WebRTC stops consuming bandwidth
    this._iframe.src = 'about:blank'
    this._iframe.classList.add('hidden')
    this._video.classList.remove('hidden')

    const url = `${this._base()}/api/stream.m3u8?src=${this._streamName()}`

    if (window.Hls && Hls.isSupported()) {
      this._destroyHLS()
      this.hlsInst = new Hls({
        enableWorker:    true,
        lowLatencyMode:  true,
        backBufferLength: 10,
      })
      this.hlsInst.loadSource(url)
      this.hlsInst.attachMedia(this._video)
      this.hlsInst.on(Hls.Events.MANIFEST_PARSED, () => {
        this._video.play().catch(() => {})
      })
      this.hlsInst.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error('[HLS] Fatal:', data.type, data.details)
        }
      })
    } else if (this._video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      this._video.src = url
      this._video.play().catch(() => {})
    } else {
      console.warn('[HLS] Not supported in this browser. Try WebRTC mode.')
    }
  }

  _destroyHLS() {
    if (this.hlsInst) {
      this.hlsInst.destroy()
      this.hlsInst = null
    }
  }

  // ── UI sync ─────────────────────────────────────────────────────────────────

  _updateUI() {
    const stream = CONFIG.streams[this.quality]
    const isHD  = this.quality  === 'main'
    const isHLS = this.protocol === 'hls'

    // Quality button
    const btnQ = document.getElementById('btn-quality')
    const lblQ = document.getElementById('lbl-quality')
    if (isHD) {
      btnQ.classList.add('bg-emerald-600', 'text-white')
      btnQ.classList.remove('bg-slate-800', 'text-slate-300')
      lblQ.textContent = 'Switch to SD'
    } else {
      btnQ.classList.remove('bg-emerald-600', 'text-white')
      btnQ.classList.add('bg-slate-800', 'text-slate-300')
      lblQ.textContent = 'Switch to HD'
    }

    // Protocol button label
    document.getElementById('lbl-protocol').textContent = isHLS ? 'WebRTC Mode' : 'HLS Fallback'

    // Info badges
    document.getElementById('badge-protocol').textContent   = isHLS ? 'HLS' : 'WebRTC'
    document.getElementById('badge-resolution').textContent = stream.label
    document.getElementById('meta-source').textContent      = stream.name

    // Diagnostic cards
    document.getElementById('diag-protocol').textContent = isHLS ? 'HLS (hls.js)' : 'WebRTC'
    document.getElementById('diag-quality').textContent  = isHD ? 'Main Stream (4K)' : 'Sub Stream (720p)'
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  toggleQuality() {
    this.quality = this.quality === 'sub' ? 'main' : 'sub'
    this._load()
  }

  toggleProtocol() {
    this.protocol = this.protocol === 'webrtc' ? 'hls' : 'webrtc'
    this._load()
  }
}

// ─── Fullscreen ───────────────────────────────────────────────────────────────

function toggleFullscreen() {
  const container = document.getElementById('player-container')
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => console.error('[Fullscreen]', err))
  } else {
    document.exitFullscreen()
  }
}

// ─── Dark mode ────────────────────────────────────────────────────────────────

function toggleDarkMode() {
  const html = document.documentElement
  const sun  = document.getElementById('icon-sun')
  const moon = document.getElementById('icon-moon')
  if (html.classList.contains('dark')) {
    html.classList.remove('dark')
    sun.classList.add('hidden')
    moon.classList.remove('hidden')
  } else {
    html.classList.add('dark')
    moon.classList.add('hidden')
    sun.classList.remove('hidden')
  }
}

// ─── Clock ────────────────────────────────────────────────────────────────────

function updateClock() {
  const now = new Date()
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('id-ID', { hour12: false })
  document.getElementById('datestamp').textContent =
    now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── System status ────────────────────────────────────────────────────────────

function setServiceStatus(name, online) {
  const color     = online ? 'bg-emerald-500' : 'bg-red-500'
  const labelText = online ? 'Online' : 'Unreachable'
  const labelCls  = online ? 'text-xs text-emerald-500' : 'text-xs text-red-500'

  for (const id of [`sys-dot-${name}`, `hdr-dot-${name}`]) {
    const el = document.getElementById(id)
    if (!el) continue
    el.classList.remove('bg-slate-600', 'bg-emerald-500', 'bg-red-500')
    el.classList.add(color)
  }

  const sysLbl = document.getElementById(`sys-lbl-${name}`)
  if (sysLbl) { sysLbl.textContent = labelText; sysLbl.className = labelCls }

  const hdrLbl = document.getElementById(`hdr-lbl-${name}`)
  if (hdrLbl) {
    hdrLbl.textContent = labelText
    hdrLbl.className = online ? 'text-xs text-emerald-600' : 'text-xs text-red-500'
  }
}

// Chrome 104+ Private Network Access (PNA) policy blocks requests from localhost to
// 192.168.x.x before they leave the browser — onerror fires in < 5 ms.
// A genuine connection-refused on LAN takes ~1-10 ms; a real server response takes ≥ 80 ms.
// We use three states:
//   • onload             → Online  (green)
//   • onerror ≥ 80 ms   → Online  (server replied, content just wasn't an image)
//   • timeout (4 s)      → Unreachable (red)
//   • onerror < 80 ms   → Unknown (amber) — PNA block or instant-refused; can't tell
function pingService(name, probeBase) {
  return new Promise(resolve => {
    const img   = new Image()
    const start = Date.now()

    const timer = setTimeout(() => {
      img.onload = img.onerror = null
      img.src = ''
      setServiceStatus(name, false)   // 4 s timeout → genuinely unreachable
      resolve()
    }, 4000)

    img.onload = () => {
      clearTimeout(timer)
      setServiceStatus(name, true)
      resolve()
    }

    img.onerror = () => {
      clearTimeout(timer)
      const elapsed = Date.now() - start
      if (elapsed >= 80) {
        setServiceStatus(name, true)   // server responded (non-image body) → online
      } else {
        setServiceStatusUnknown(name)  // < 80 ms → PNA block or instant refused
      }
      resolve()
    }

    img.src = `${probeBase}/?_t=${Date.now()}`
  })
}

function setServiceStatusUnknown(name) {
  for (const id of [`sys-dot-${name}`, `hdr-dot-${name}`]) {
    const el = document.getElementById(id)
    if (!el) continue
    el.classList.remove('bg-slate-600', 'bg-emerald-500', 'bg-red-500')
    el.classList.add('bg-amber-500')
  }
  const sysLbl = document.getElementById(`sys-lbl-${name}`)
  if (sysLbl) { sysLbl.textContent = 'Unknown'; sysLbl.className = 'text-xs text-amber-500' }
  const hdrLbl = document.getElementById(`hdr-lbl-${name}`)
  if (hdrLbl) { hdrLbl.textContent = 'Unknown'; hdrLbl.className = 'text-xs text-amber-500' }
}

function checkSystemStatus() {
  pingService('go2rtc',  CONFIG.go2rtcBase)
  pingService('frigate', `http://${CONFIG.server}:${CONFIG.frigatePort}`)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  window.player = new StreamPlayer()

  updateClock()
  setInterval(updateClock, 1000)

  checkSystemStatus()
  setInterval(checkSystemStatus, 30_000)
})
