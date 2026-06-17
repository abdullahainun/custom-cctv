// ─────────────────────────────────────────────────────────────────────────────
// detections.js — Simulated Frigate object-detection event feed.
//
// Replace the scheduler at the bottom with a real MQTT/WebSocket listener
// when Frigate is connected. The addEvent() function is the integration point:
//   mqtt.on('frigate/+/+/new_snapshot', payload => addEvent(parsePayload(payload)))
// ─────────────────────────────────────────────────────────────────────────────

const DETECTION_TYPES = {
  person: {
    label:       'Person',
    dotClass:    'bg-blue-500',
    textClass:   'text-blue-400',
    borderClass: 'border-blue-500/20',
    bgClass:     'bg-blue-500/5',
    zones:       ['Front Door', 'Lobby', 'Corridor', 'Parking Area', 'Gate Entry'],
  },
  vehicle: {
    label:       'Vehicle',
    dotClass:    'bg-amber-500',
    textClass:   'text-amber-400',
    borderClass: 'border-amber-500/20',
    bgClass:     'bg-amber-500/5',
    zones:       ['Driveway', 'Parking Lot', 'Gate Entry', 'Main Road'],
  },
  motion: {
    label:       'Motion',
    dotClass:    'bg-slate-400',
    textClass:   'text-slate-400',
    borderClass: 'border-slate-600/30',
    bgClass:     'bg-slate-700/20',
    zones:       ['Zone A', 'Zone B', 'Perimeter', 'Backyard'],
  },
}

const counts = { person: 0, vehicle: 0, motion: 0 }
const MAX_LIST_ITEMS = 25

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatTime(date) {
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

// ─── Render ───────────────────────────────────────────────────────────────────

function buildEventElement(event) {
  const cfg  = DETECTION_TYPES[event.type]
  const time = formatTime(event.timestamp)

  const el = document.createElement('div')
  el.className = `det-enter flex items-center gap-2 px-2 py-1.5 rounded`
  el.innerHTML = `
    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}"></span>
    <span class="text-xs font-medium ${cfg.textClass} flex-shrink-0">${cfg.label}</span>
    <span class="text-xs text-zinc-600 truncate flex-1">${event.zone}</span>
    <span class="text-xs text-zinc-700 flex-shrink-0 tabular-nums">${time}</span>
  `
  return el
}

function updateCounts() {
  document.getElementById('cnt-person').textContent  = counts.person
  document.getElementById('cnt-vehicle').textContent = counts.vehicle
  document.getElementById('cnt-motion').textContent  = counts.motion
}

// ─── Public: addEvent ─────────────────────────────────────────────────────────
// Call this with a real Frigate payload to integrate live detection data.
// Expected shape: { type: 'person'|'vehicle'|'motion', zone, confidence, timestamp }

function addEvent(event) {
  const list = document.getElementById('detection-list')
  if (!list) return

  counts[event.type] = (counts[event.type] || 0) + 1
  updateCounts()

  const el = buildEventElement(event)
  list.insertBefore(el, list.firstChild)

  while (list.children.length > MAX_LIST_ITEMS) {
    list.removeChild(list.lastChild)
  }
}

// ─── Seed: show a few past events on load ─────────────────────────────────────

function seedEvents() {
  const now = Date.now()
  const seed = [
    { type: 'person',  zone: 'Front Door',   confidence: 94, offsetMs: 1   * 60_000 },
    { type: 'vehicle', zone: 'Driveway',      confidence: 89, offsetMs: 3   * 60_000 },
    { type: 'person',  zone: 'Corridor',      confidence: 91, offsetMs: 5   * 60_000 },
    { type: 'motion',  zone: 'Zone A',        confidence: 82, offsetMs: 7   * 60_000 },
    { type: 'vehicle', zone: 'Parking Lot',   confidence: 87, offsetMs: 9   * 60_000 },
    { type: 'person',  zone: 'Gate Entry',    confidence: 96, offsetMs: 12  * 60_000 },
    { type: 'motion',  zone: 'Perimeter',     confidence: 78, offsetMs: 15  * 60_000 },
  ]

  // Add oldest first so newest ends up at top of the prepend list
  ;[...seed].reverse().forEach(s => {
    addEvent({
      type:       s.type,
      zone:       s.zone,
      confidence: s.confidence,
      timestamp:  new Date(now - s.offsetMs),
    })
  })
}

// ─── Simulation scheduler ─────────────────────────────────────────────────────
// Fires a random event every 8–25 seconds to mimic a live detection feed.
// Remove this block and call addEvent() from your MQTT handler instead.

function scheduleSimulation() {
  const delay = randomInt(8_000, 25_000)
  setTimeout(() => {
    const typeKey = randomItem(Object.keys(DETECTION_TYPES))
    const cfg     = DETECTION_TYPES[typeKey]
    addEvent({
      type:       typeKey,
      zone:       randomItem(cfg.zones),
      confidence: randomInt(78, 99),
      timestamp:  new Date(),
    })
    scheduleSimulation()
  }, delay)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  seedEvents()
  scheduleSimulation()
})
