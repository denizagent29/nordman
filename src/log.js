// Log capture — the recording half of "learn mode".
//
// Why this exists: Clavia publishes which CC and NRPN numbers an instrument
// uses and what range each one spans, but never the value→meaning table for
// the enumerated parameters (reverb type, amp type, keyboard touch, vibrato
// mode …). Those tables only exist inside the instrument. Every enumerated
// field in the model maps therefore starts out without `values`, and the only
// way to fill them in is to listen to the real thing while someone turns the
// knob through every position.
//
// The output format is chosen for the person, not for a parser: he is blind,
// so a log he cannot hear is useless, and he reads it in Telegram, where a
// long line wraps and a table loses its columns. So:
//   - one event per line, tab-separated prefix so the lines stay parseable;
//   - the spoken sentence as the last field, so quoting a single line in a
//     chat is enough for it to be understood;
//   - `flavour` names the shape of a burst so the reader can tell a slow
//     deliberate sweep (that is the one worth keeping) from a quick flick.
//
// Everything here is pure: no DOM, no Web MIDI, no clock of its own. The
// transport hands in already-parsed messages and the current time.

import { ccNumber, ccValue, channel, isCc, isClock, isPitchBend, pitchBendValue,
         isProgramChange, isSysex, sysexPayload, toBytes } from './midi.js';

// A single held note produces note-on, note-off, and for a pedal-heavy player
// a stream of aftertouch; none of that helps map a knob and all of it buries
// the useful lines. Filtered by default, switchable off in the UI.
export function isNoteMessage(data) {
  const b = toBytes(data);
  if (!b.length) return false;
  const op = b[0] & 0xf0;
  return op === 0x80 || op === 0x90 || op === 0xa0;
}

// The debouncer keys controllers as `cc:<n>`; the log uses the same key space
// so a captured line and an announcement refer to the same thing.
export function controlKey(msg) {
  const b = toBytes(msg);
  if (isCc(b)) return `ch${channel(b)}:cc:${ccNumber(b)}`;
  return null;
}

// Clavia's documented NRPN notation is "X:Y" — CC 99 carries X, CC 98 carries
// Y, the parameter value follows in CC 38. A Nord sends the four-message
// package (99, 98, 6, 38), so a log line has to say which part of the package
// it is or the reader cannot tell a parameter change from a register write.
export function nrpnRole(cc, value) {
  switch (cc) {
    case 99: return { role: 'msb', text: `NRPN bank select, high = ${value}` };
    case 98: return { role: 'lsb', text: `NRPN bank select, low = ${value}` };
    case 6: return { role: 'data-msb', text: `NRPN data entry = ${value}` };
    case 38: return { role: 'data-lsb', text: `NRPN value = ${value}` };
    default: return null;
  }
}

// A snapshot of the NRPN registers as they are seen, so a CC 38 line can be
// reported as "3:4 = 12" instead of "value = 12" — the number that means
// something to a human.
export function createNrpnTracker() {
  let msb = null, lsb = null;
  return {
    observe(cc, value) {
      // CC 6 (data entry MSB) is accepted as a coarse value too; Nords send a
      // literal 0 there, which is not a parameter change.
      if (cc === 99) { msb = value; return null; }
      if (cc === 98) { lsb = value; return null; }
      if (cc === 38) {
        if (msb === null || lsb === null) return null;
        return { address: [msb, lsb], value };
      }
      return null;
    },
    get address() {
      return msb === null || lsb === null ? null : [msb, lsb];
    },
    reset() { msb = null; lsb = null; },
  };
}

// Status bytes run to 0xFF and must not be truncated to seven bits: masking
// one to 0x7f turns a clock tick (0xF8) into "0x78", which reads as a data
// byte and makes the dump actively misleading.
export function hexByte(value) {
  return `0x${value.toString(16).padStart(2, '0')}`;
}

export function hexDump(bytes) {
  return [...bytes].map(hexByte).join(' ');
}

// A burst shorter than this is a flick, not a sweep — the reader is told so
// they do not mistake one for the other when reading the log back.
export const SWEEP_MIN_STEPS = 3;
export const SWEEP_MIN_SPAN = 6;

export function flavourOf(steps, first, last) {
  if (steps < SWEEP_MIN_STEPS) return 'flick';
  return Math.abs(last - first) >= SWEEP_MIN_SPAN ? 'sweep' : 'wobble';
}

export function createLog({
  now = () => Date.now(),
  filterNotes = true,
  modelName = 'Nord',
  limit = 2000,
} = {}) {
  const lines = [];
  const nrpn = createNrpnTracker();
  let counters = { cc: 0, note: 0, nrpn: 0, sysex: 0, clock: 0, other: 0 };

  // `counted` is false for lines that are shown but not kept in the list —
  // return the same thing and the caller says nothing new for the rest of the
  // session.
  function record(kind, text, extra = {}, { counted = true } = {}) {
    const line = { seq: lines.length + 1, kind, text, at: now(), ...extra };
    if (counted) lines.push(line);
    counters[kind] = (counters[kind] || 0) + 1;
    if (lines.length > limit) lines.splice(0, lines.length - limit);
    return line;
  }

  // Returns the recorded line, or null when the message is filtered out.
  function feed(raw) {
    const b = toBytes(raw);
    if (!b.length) return null;

    // The clock keeps ticking whether or not anyone plays. Recording it would
    // fill the capture with thousands of identical lines and drown the sweep
    // that is the entire point of learn mode, so it is counted and spoken but
    // not listed.
    if (isClock(b)) {
      return record('clock', 'MIDI clock', { bytes: [...b] }, { counted: false });
    }

    if (isSysex(b)) {
      return record('sysex', `SysEx: ${hexDump(b)}`,
        { bytes: [...b], payload: [...sysexPayload(b)] });
    }

    if (filterNotes && isNoteMessage(b)) {
      counters.note++;
      // Counted only: the notes are announced by the status line's own
      // sentence when playing starts, and a line per keypress would bury
      // every knob in the capture.
      return null;
    }

    if (isCc(b)) {
      const cc = ccNumber(b);
      const v = ccValue(b);
      const ch = channel(b);
      const role = nrpnRole(cc, v);
      if (role) {
        const resolved = nrpn.observe(cc, v);
        const label = resolved
          ? `NRPN ${resolved.address[0]}:${resolved.address[1]} = ${resolved.value}`
          : role.text;
        return record('nrpn', label, { cc, value: v, channel: ch, role: role.role,
          address: resolved ? resolved.address : undefined });
      }
      return record('cc', `CC ${cc} = ${v} (channel ${ch})`, { cc, value: v, channel: ch });
    }

    if (isPitchBend(b)) {
      const v = pitchBendValue(b);
      return record('other', `Pitch bend ${v > 0 ? '+' : ''}${v}`, { value: v });
    }

    if (isProgramChange(b)) {
      return record('other', `Program change ${b[1]} (channel ${channel(b)})`,
        { program: b[1], channel: channel(b) });
    }

    return record('other', `Unknown MIDI: ${hexDump(b)}`,
      { bytes: [...b] });
  }

  // The export: a fixed tab-separated prefix so the lines stay parseable, and
  // the spoken sentence as the last field so quoting one line in a chat is
  // enough to be understood. One event per line, so wrapping in a narrow
  // window cannot merge two events into one.
  function toText() {
    const head = `# ${modelName} control log — ${lines.length} events — ${new Date(now()).toISOString()}`;
    const body = lines.map((l) => `${l.seq}\t${l.at}\t${l.kind}\t${l.text}`);
    return [head, ...body].join('\n');
  }

  // What learn mode is for: group the captured CCs so a sweep of one knob is
  // one entry, and say whether each looked like a deliberate sweep. Without
  // this the reader has a wall of numbers and has to find the sweeps by hand.
  function summary() {
    const byKey = new Map();
    for (const l of lines) {
      if (l.kind !== 'cc' || l.cc === undefined) continue;
      const key = `ch${l.channel}:cc:${l.cc}`;
      if (!byKey.has(key)) byKey.set(key, { key, cc: l.cc, channel: l.channel, values: [] });
      byKey.get(key).values.push(l.value);
    }
    return [...byKey.values()].map((e) => {
      const values = e.values;
      const uniq = [...new Set(values)].sort((a, b) => a - b);
      return {
        ...e,
        steps: values.length,
        distinct: uniq.length,
        first: values[0],
        last: values[values.length - 1],
        min: uniq[0],
        max: uniq[uniq.length - 1],
        flavour: flavourOf(values.length, values[0], values[values.length - 1]),
      };
    }).sort((a, b) => b.distinct - a.distinct);
  }

  // An enum is worth mapping only when a sweep actually reached every
  // position — then the distinct values in the order they appeared ARE the
  // value→meaning table, ready to be pasted into the model map.
  function enumCandidates() {
    return summary()
      .filter((e) => e.flavour === 'sweep' && e.distinct >= 2)
      .map((e) => ({ ...e, values: undefined }));
  }

  // The one-line count that sits above the capture. A property rather than a
  // function so the caller can compare it against what it last displayed —
  // a live region announces on change, so the caller must only write when the
  // string differs, and it cannot know that without being handed the string.
  const summaryText = () => {
    const c = counters;
    const recorded = lines.length;
    const total = recorded + c.note + c.clock;
    if (total === 0) return 'Nothing heard yet — is the instrument on?';
    const bits = [];
    // Switches land in `cc` too, so this is "controllers", not "knobs": a
    // pedal down and a knob moved are the same message shape.
    if (c.cc) bits.push(`${c.cc} controllers`);
    if (c.nrpn) bits.push(`${c.nrpn} NRPN`);
    if (c.note) bits.push(`${c.note} notes`);
    if (c.clock) bits.push('clock running');
    if (c.sysex) bits.push(`${c.sysex} sysex`);
    if (c.other) bits.push(`${c.other} other`);
    const plural = total === 1 ? '' : 's';
    return `${total} MIDI event${plural} heard — ${bits.join(', ')}.`;
  };

  return {
    feed, toText, summary, enumCandidates, lines,
    get counters() { return { ...counters }; },
    // Read each time, never cached: the panel polls it twice a second.
    get summaryText() { return summaryText(); },
    clear() { lines.length = 0; counters = { cc: 0, note: 0, nrpn: 0, sysex: 0, clock: 0, other: 0 }; nrpn.reset(); },
  };
}
