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

// A piano memory slot, spoken as a place rather than as an address: the
// instrument numbers 12 slots in two lines of six, and "line B, slot three"
// is a place a player can find on the panel — the value the instrument sends
// (0, 1, … 14, 21, 34) is not, which is exactly why it sounded like jumping.
const ORDINALS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
                  'nine', 'ten', 'eleven', 'twelve'];

export function slotLabel(def, value) {
  const size = def.groupSize || 6;
  const slot = value % size;
  const group = Math.floor(value / size);
  const labels = def.groupLabels || [];
  const prefix = labels[group] !== undefined ? labels[group] : `line ${group + 1}`;
  const ordinal = ORDINALS[slot] !== undefined ? ORDINALS[slot] : String(slot + 1);
  return `${prefix}, slot ${ordinal}`;
}

// The unit is spoken where the number is meaningless without one: an EQ gain
// of "plus 3" is a direction, "+3 dB" is a measurement.
function withUnit(text, unit) {
  return unit ? `${text} ${unit}` : text;
}

export function formatValue(def, value) {
  if (!def) return String(value);
  // Some controls are a switch in shape but not in meaning: the layer knob
  // reports which layer is selected, so its low value is "layer A", not "off".
  // `offIsSilent` says the map already spells the position out in `values`.
  if (def.kind === 'switch' && !def.offIsSilent) return value >= 64 ? 'on' : 'off';
  if ((def.kind === 'enum' || def.kind === 'switch') && def.values) {
    const label = def.values[value];
    return label !== undefined ? label : `value ${value}`;
  }
  if (def.kind === 'slots') return slotLabel(def, value);
  if (def.kind === 'bipolar') {
    const v = value - 64;
    if (v === 0) return `centre (${value})`;
    return withUnit(`${v > 0 ? 'plus' : 'minus'} ${Math.abs(v)} (${value})`, def.unit);
  }
  return withUnit(String(value), def.unit);
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

// Several controllers can settle in the same 200 ms window — pressing a
// section button moves the focus and the layer enable together, and the owner
// asked to hear all of them rather than only the last. One sentence per change
// would also be a burst of speech; joined into one line the screen reader
// reads it as a single announcement.
//
// The cap matters as much as the join: a knob sweep legitimately settles many
// keys at once when the player lets go of two at a time, and an announcement
// that runs past a few clauses is not heard, it is talked over. The overflow
// is counted, not dropped silently — a reader who hears "and two more" knows
// the capture has the rest.
export const ANNOUNCE_MAX = 3;

export function joinAnnouncements(parts, { max = ANNOUNCE_MAX, and = 'and' } = {}) {
  const list = parts.filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  const head = list.slice(0, max);
  const rest = list.length - head.length;
  const last = head[head.length - 1];
  const lead = head.slice(0, -1).join(', ');
  const overflow = rest === 0 ? ''
    : `, ${and} ${rest} more ${rest === 1 ? 'change' : 'changes'}`;
  return `${lead} ${and} ${last}${overflow}`;
}
