// Announcement text. One place decides how a settled controller change is
// phrased, so the screen reader hears the same wording everywhere and the
// strings can be pluralised/translated without touching the transport code.
//
// Rules learned from how the owner works (blind, NVDA/Elten):
//   - the value comes FIRST: an interruption is often clipped, the number is
//     what matters, the controller name is allowed to be cut off;
//   - "on"/"off" rather than "1"/"0" for switches;
//   - no emoji, no markdown, plain sentences — this goes into aria-live and
//     then through TTS.

export function formatValue(def, value) {
  if (!def) return String(value);
  if (def.kind === 'switch') return value >= 64 ? 'on' : 'off';
  if (def.kind === 'enum' && def.values) {
    const label = def.values[value];
    return label !== undefined ? label : `value ${value}`;
  }
  if (def.kind === 'bipolar') {
    const v = value - 64;
    if (v === 0) return `centre ${value}`;
    return `${v > 0 ? 'plus' : 'minus'} ${Math.abs(v)} (${value})`;
  }
  return String(value);
}

// Phrases a settled change. `from` may be undefined (first touch of a knob in
// this session) — then we only state the new value.
export function describeChange(def, { value, from }) {
  const name = def ? def.name : 'Controller';
  const now = formatValue(def, value);
  if (from === undefined || from === null) return `${name}, ${now}`;
  const before = formatValue(def, from);
  if (before === now) return null; // settled on the value it already had
  return `${name}, ${now}`;
}

// A short line for the always-visible status bar (aria-live polite — it must
// not interrupt a sentence being read).
export function statusLine(parts) {
  return parts.filter(Boolean).join(' · ');
}
