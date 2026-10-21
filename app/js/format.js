// Small formatting helpers.

export function clock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 10:00, 7:30, 0:45 (no leading zero on minutes)
export function duration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Totals: 32m, 3h 44m (seconds don't matter at this scale).
export function hoursMinutes(totalSeconds) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function pace(seconds) {
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}

const DAY = 24 * 60 * 60 * 1000;

export function sameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function dayLabel(ts, now = Date.now()) {
  const d = new Date(ts);
  if (sameDay(ts, now)) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (sameDay(ts, now - DAY)) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

export function longDate(ts = Date.now()) {
  return new Date(ts).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ESC[c]);
}
