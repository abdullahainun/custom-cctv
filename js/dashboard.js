// ─────────────────────────────────────────────────────────────────────────────
// dashboard.js — Multi-camera grid, modal player, clock, system status
// ─────────────────────────────────────────────────────────────────────────────

const SERVER      = '100.74.162.72'
const GO2RTC_BASE = `http://${SERVER}:1984`
const FRIGATE_BASE = `http://${SERVER}:5000`

// ─── Camera list ──────────────────────────────────────────────────────────────
// Add more entries here to display additional cameras in the grid.

const CAMERAS = [
  {
    id:       'cam01',
    name:     'Kamera 01',
    location: 'Gerbang Utama',
    subSrc:   'hikvision_sub',
    mainSrc:  'hikvision_main',
  },
  // {
  //   id:       'cam02',
  //   name:     'Kamera 02',
  //   location: 'Koridor',
  //   subSrc:   'cam02_sub',
  //   mainSrc:  'cam02_main',
  // },
  // {
  //   id:       'cam03',
  //   name:     'Kamera 03',
  //   location: 'Area Parkir',
  //   subSrc:   'cam03_sub',
  //   mainSrc:  'cam03_main',
  // },
  // {
  //   id:       'cam04',
  //   name:     'Kamera 04',
  //   location: 'Lapangan',
  //   subSrc:   'cam04_sub',
  //   mainSrc:  'cam04_main',
  // },
]

// ─── Camera grid rendering ────────────────────────────────────────────────────

function buildTile(cam) {
  const div = document.createElement('div')
  div.id        = `tile-${cam.id}`
  div.className = 'cam-tile'

  div.innerHTML = `
    <iframe
      id="tile-iframe-${cam.id}"
      src="${GO2RTC_BASE}/links.html?src=${cam.subSrc}&mode=webrtc"
      allow="autoplay; camera; microphone"
      title="${cam.name}"
    ></iframe>

    <!-- Bottom overlay: always visible label + expand button -->
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pt-8 pb-2 px-2.5 flex items-end justify-between">
      <div class="leading-none">
        <div class="text-xs font-medium text-white/90">${cam.name}</div>
        <div class="text-xs text-white/50 mt-0.5">${cam.location}</div>
      </div>
      <div class="flex items-center gap-2">
        <span class="live-pulse w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <button onclick="openModal('${cam.id}')"
                title="Perbesar"
                class="p-2 rounded bg-black/40 hover:bg-black/70 text-white/60 hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5
                 m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9
                 m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
      </div>
    </div>
  `
  return div
}

function applyGridLayout(count) {
  const grid = document.getElementById('camera-grid')
  const w    = window.innerWidth

  // Reset
  grid.style.cssText = ''
  grid.style.gap = '8px'

  // Mobile-first: 1 column on small screens
  if (w < 640) {
    grid.style.gridTemplateColumns = '1fr'
    if (count <= 2) grid.style.height = '100%'
    return
  }

  // Tablet: up to 2 columns
  if (w < 1024) {
    if (count === 1) {
      grid.style.gridTemplateColumns = '1fr'
      grid.style.height = '100%'
    } else {
      const cols = Math.min(count, 2)
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
      if (count <= 4) grid.style.height = '100%'
    }
    return
  }

  // Desktop: existing multi-column logic
  if (count === 1) {
    grid.style.gridTemplateColumns = '1fr'
    grid.style.height = '100%'
  } else if (count === 2) {
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)'
    grid.style.height = '100%'
  } else if (count <= 4) {
    grid.style.gridTemplateColumns = 'repeat(2, 1fr)'
    grid.style.gridTemplateRows  = 'repeat(2, 1fr)'
    grid.style.height = '100%'
  } else if (count <= 6) {
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)'
    grid.style.gridTemplateRows  = 'repeat(2, 1fr)'
    grid.style.height = '100%'
  } else {
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)'
  }
}

function renderCameras() {
  const grid = document.getElementById('camera-grid')
  grid.innerHTML = ''

  CAMERAS.forEach(cam => grid.appendChild(buildTile(cam)))
  applyGridLayout(CAMERAS.length)
}

// ─── Modal player ─────────────────────────────────────────────────────────────

class ModalPlayer {
  constructor(cam) {
    this.cam      = cam
    this.quality  = 'sub'
    this.protocol = 'webrtc'
    this.hlsInst  = null

    this._iframe = document.getElementById('modal-iframe')
    this._video  = document.getElementById('modal-video')

    this._load()
  }

  _src() {
    const name = this.quality === 'sub' ? this.cam.subSrc : this.cam.mainSrc
    return { name }
  }

  _load() {
    this._updateUI()
    this.protocol === 'webrtc' ? this._loadWebRTC() : this._loadHLS()
  }

  _loadWebRTC() {
    this._destroyHLS()
    this._iframe.src = `${GO2RTC_BASE}/links.html?src=${this._src().name}&mode=webrtc`
    this._iframe.classList.remove('hidden')
    this._video.classList.add('hidden')
  }

  _loadHLS() {
    this._iframe.src = 'about:blank'
    this._iframe.classList.add('hidden')
    this._video.classList.remove('hidden')

    const url = `${GO2RTC_BASE}/api/stream.m3u8?src=${this._src().name}`

    if (window.Hls && Hls.isSupported()) {
      this._destroyHLS()
      this.hlsInst = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 10 })
      this.hlsInst.loadSource(url)
      this.hlsInst.attachMedia(this._video)
      this.hlsInst.on(Hls.Events.MANIFEST_PARSED, () => this._video.play().catch(() => {}))
      this.hlsInst.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) console.error('[HLS]', d) })
    } else if (this._video.canPlayType('application/vnd.apple.mpegurl')) {
      this._video.src = url
      this._video.play().catch(() => {})
    }
  }

  _destroyHLS() {
    if (this.hlsInst) { this.hlsInst.destroy(); this.hlsInst = null }
  }

  _updateUI() {
    const isHD  = this.quality  === 'main'
    const isHLS = this.protocol === 'hls'

    const qLabel = isHD  ? 'Switch ke Sub (720p)' : 'Switch ke Main (4K)'
    const pLabel = isHLS ? 'WebRTC Mode'           : 'HLS Fallback'

    const btnQ = document.getElementById('modal-btn-quality')
    const btnP = document.getElementById('modal-btn-protocol')
    if (btnQ) btnQ.textContent = qLabel
    if (btnP) btnP.textContent = pLabel

    const bProto   = document.getElementById('modal-badge-proto')
    const bQuality = document.getElementById('modal-badge-quality')
    if (bProto)   bProto.textContent   = isHLS ? 'HLS' : 'WebRTC'
    if (bQuality) bQuality.textContent = isHD  ? 'Main (4K)' : 'Sub (720p)'
  }

  toggleQuality() {
    this.quality = this.quality === 'sub' ? 'main' : 'sub'
    this._load()
  }

  toggleProtocol() {
    this.protocol = this.protocol === 'webrtc' ? 'hls' : 'webrtc'
    this._load()
  }

  requestFullscreen() {
    const wrap = document.getElementById('modal-player-wrap')
    if (!document.fullscreenElement) {
      wrap.requestFullscreen().catch(err => console.error('[Fullscreen]', err))
    } else {
      document.exitFullscreen()
    }
  }

  destroy() {
    this._destroyHLS()
    this._iframe.src = 'about:blank'
    this._video.src  = ''
    this._iframe.classList.remove('hidden')
    this._video.classList.add('hidden')
  }
}

// ─── Modal open / close ───────────────────────────────────────────────────────

let modalPlayer = null

function openModal(camId) {
  const cam = CAMERAS.find(c => c.id === camId)
  if (!cam) return

  // Close sidebar on mobile when opening a camera
  closeSidebar()

  document.getElementById('modal-cam-name').textContent     = cam.name
  document.getElementById('modal-cam-location').textContent = cam.location

  if (modalPlayer) modalPlayer.destroy()
  modalPlayer = new ModalPlayer(cam)

  document.getElementById('camera-modal').classList.remove('hidden')
  document.addEventListener('keydown', _modalEscListener)
}

function closeModal() {
  document.getElementById('camera-modal').classList.add('hidden')
  if (modalPlayer) { modalPlayer.destroy(); modalPlayer = null }
  document.removeEventListener('keydown', _modalEscListener)
}

function _modalEscListener(e) {
  if (e.key === 'Escape') closeModal()
}

// ─── Sidebar toggle (mobile drawer) ──────────────────────────────────────────

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar')
  const backdrop = document.getElementById('sidebar-backdrop')
  if (!sidebar) return

  const isOpen = sidebar.classList.contains('translate-x-0')

  sidebar.classList.toggle('translate-x-full', isOpen)
  sidebar.classList.toggle('translate-x-0', !isOpen)

  if (backdrop) {
    backdrop.classList.toggle('hidden', isOpen)
  }
}

function closeSidebar() {
  const sidebar  = document.getElementById('sidebar')
  const backdrop = document.getElementById('sidebar-backdrop')
  if (!sidebar) return
  sidebar.classList.remove('translate-x-0')
  sidebar.classList.add('translate-x-full')
  if (backdrop) backdrop.classList.add('hidden')
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
  const color = online ? 'bg-emerald-500' : 'bg-red-500'
  const text  = online ? 'Online'         : 'Unreachable'
  const cls   = online ? 'text-xs text-emerald-500' : 'text-xs text-red-500'

  for (const id of [`sys-dot-${name}`, `hdr-dot-${name}`]) {
    const el = document.getElementById(id)
    if (!el) continue
    el.classList.remove('bg-zinc-600', 'bg-emerald-500', 'bg-red-500', 'bg-amber-500')
    el.classList.add(color)
  }

  const sysLbl = document.getElementById(`sys-lbl-${name}`)
  if (sysLbl) { sysLbl.textContent = text; sysLbl.className = cls }
}

function setServiceStatusUnknown(name) {
  for (const id of [`sys-dot-${name}`, `hdr-dot-${name}`]) {
    const el = document.getElementById(id)
    if (!el) continue
    el.classList.remove('bg-zinc-600', 'bg-emerald-500', 'bg-red-500')
    el.classList.add('bg-amber-500')
  }
  const sysLbl = document.getElementById(`sys-lbl-${name}`)
  if (sysLbl) { sysLbl.textContent = 'Unknown'; sysLbl.className = 'text-xs text-amber-500' }
}

// Probes a service via image ping. Chrome PNA blocks LAN requests from localhost < 80 ms.
function pingService(name, base) {
  return new Promise(resolve => {
    const img   = new Image()
    const start = Date.now()

    const timer = setTimeout(() => {
      img.onload = img.onerror = null
      img.src = ''
      setServiceStatus(name, false)
      resolve()
    }, 4000)

    img.onload = () => {
      clearTimeout(timer)
      setServiceStatus(name, true)
      resolve()
    }

    img.onerror = () => {
      clearTimeout(timer)
      if (Date.now() - start >= 80) {
        setServiceStatus(name, true)
      } else {
        setServiceStatusUnknown(name)
      }
      resolve()
    }

    img.src = `${base}/?_t=${Date.now()}`
  })
}

function checkSystemStatus() {
  pingService('go2rtc',  GO2RTC_BASE)
  pingService('frigate', FRIGATE_BASE)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderCameras()

  // Re-layout grid on resize / orientation change
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => applyGridLayout(CAMERAS.length), 150)
  })

  // ESC closes sidebar on mobile
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar()
  })

  updateClock()
  setInterval(updateClock, 1000)

  checkSystemStatus()
  setInterval(checkSystemStatus, 30_000)
})
