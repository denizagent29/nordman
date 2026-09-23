// Announcement text. One place decides how a settled controller change is
// phrased, so the screen reader hears the same wording everywhere and the
// strings can be pluralised/translated without touching the transport code.
//
// The owner is blind (NVDA/Elten), which drives the phrasing:
//   - the NAME comes first, the value after: a polite announcement that gets
//     cut off loses its tail, not its head, so "Reverb mix, 42" clipped to
//     "Reverb mix" still tells him which knob moved — the reverse tells him a
//     number with no owner;
//   - "on"/"off" rather than "1"/"0" for switches;
//   - no emoji, no markdown, plain sentences — this goes into aria-live and
//     then through TTS.
//
// The order is not settled: name-first is the current choice, value-first is
// defensible for a knob he is already holding. Ask before changing it.

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
