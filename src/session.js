// The session: one settled controller change in, one spoken sentence out.
//
// Ties the four pure pieces together — the CC/NRPN maps, the debouncer, the
// phrasing, the log — and owns the two things a UI needs but a pure module
// cannot know: which model is connected, and what an incoming message on
// channel N means for the control map.
//
// Indexing a model map. Every control is reachable three ways:
//   cc:<n>        an ordinary control change
//   nrpn:<x>:<y>  an NRPN parameter, which arrives as CC 99/98/6/38
// and controls that exist per layer (Piano A, Synth B, …) are suffixed with
// the layer they arrived on, so turning Synth layer A and Synth layer B do
// not collapse into one announcement.
//
// No DOM, no Web MIDI: `attach` takes a very small port-like object.

import { ccNumber, ccValue, channel, isCc, toBytes } from './midi.js';
import { createDebouncer } from './debounce.js';
import { describeChange, joinAnnouncements, statusLine } from './announce.js';
import { createLog, controlKey, isNoteMessage } from './log.js';
import { NORD_PIANO_6 } from '../data/nord-piano-6.js';
import { NORD_STAGE_4 } from '../data/nord-stage-4.js';

export const MAPS = {
  'nord-piano-6': NORD_PIANO_6,
  'nord-stage-4': NORD_STAGE_4,
};

// Layer-focus CCs: for as long as such a control is "active" a following edit
// CC belongs to that layer. Both models use the same trick.
const FOCUS = {
  piano: { controlId: 'pianoLayerFocus', layers: ['A', 'B'] },
  synth: { controlId: 'synthLayerFocus', layers: ['A', 'B'] },
};

export function mapById(id) {
  return MAPS[id] || null;
}

// The four CCs that carry an NRPN package. They are transport, not controls:
// announcing "Controller, 99" whenever a knob moves would be pure noise.
export const NRPN_TRANSPORT = [99, 98, 6, 38];

export function isNrpnTransport(cc) {
  return NRPN_TRANSPORT.includes(cc);
}

export function controlsOf(map) {
  return map ? map.controls : [];
}

// A flat lookup from address to control definition. NN is the parsed NRPN
// address ("2:33"), taken from the control's own `nrpn` field so the map stays
// the single source of truth.
//
// A CC number may legitimately carry two meanings (Stage 4 CC 15 is Organ
// preset or Synth vibrato pedal depending on the focused section); the map
// marks those with `sharedWith`. `collisions` reports any address that is
// claimed twice WITHOUT such a marker, which would be a transcription error
// and would make the announcer state the wrong name with confidence.
export function indexControls(map) {
  const byCc = new Map();
  const byNrpn = new Map();
  const collisions = [];
  if (!map) return { byCc, byNrpn, collisions };
  for (const c of map.controls) {
    if (c.cc !== undefined) {
      if (byCc.has(c.cc) && !c.sharedWith) collisions.push({ kind: 'cc', address: c.cc, key: c.key });
      byCc.set(c.cc, c);
    }
    if (c.nrpn) {
      const key = c.nrpn.join(':');
      if (byNrpn.has(key) && !c.sharedWith) collisions.push({ kind: 'nrpn', address: key, key: c.key });
      byNrpn.set(key, c);
    }
  }
  return { byCc, byNrpn, collisions };
}

// What is a control called at this moment? A per-layer control gets the layer
// appended when we know which layer is focused, because "Piano layer A level"
// and "Piano layer B level" are two different knobs.
export function controlLabel(control, layer) {
  if (!control) return null;
  return layer ? `${control.name} ${layer}` : control.name;
}

// A value as a word, for the places that need the label without the sentence
// around it (the focus announcement). `fallback` is what to say when the map
// has no label for this exact number — an unnamed focus value is still a layer,
// and "Piano layer: 127" is not something a person can act on.
function ccValueLabel(def, value, fallback) {
  if (def.values && def.values[value] !== undefined) return def.values[value];
  return fallback !== undefined ? fallback : String(value);
}

export function createSession({
  map = null,
  modelName = null,
  quietMs = 200,
  now = () => Date.now(),
  onAnnounce = () => {},
  onStatus = () => {},
  log = null,
} = {}) {
  let currentMap = map;
  let index = indexControls(map);
  let focus = { piano: null, synth: null };

  const debouncer = createDebouncer({ quietMs, now });
  const logSink = log || createLog({ now, modelName: modelName || 'Nord' });

  function setMap(next, name) {
    currentMap = next;
    index = indexControls(next);
    if (name !== undefined) modelName = name;
    logSink.clear();
  }

  // A plain CC that is an ordinary control. NRPN is read only through a
  // resolved address: CC 99/98/6/38 are transport, never controls themselves,
  // so they must not match a map entry that happens to use those numbers.
  function controlFor(bytes) {
    const cc = ccNumber(bytes);
    if (isNrpnTransport(cc)) return null;
    const direct = index.byCc.get(cc);
    if (direct) return { control: direct, layer: layerFor(direct) };
    return null;
  }

  // Which layer an edit belongs to, given the focus registers.
  function layerFor(control) {
    if (!control || !control.group) return null;
    const f = FOCUS[control.group];
    if (!f) return null;
    return focus[control.group];
  }

  // The focus CC itself: it *sets* the layer register and is announced on its
  // own terms — "Piano focus: layer B", not a bare "Effects focus, 31". The
  // address of a focus knob says which section it points at, which is exactly
  // the news; a reader who cannot see the panel has no other way to know where
  // the next knob edit will land.
  function handleFocus(msg) {
    const b = toBytes(msg);
    if (!isCc(b)) return false;
    const cc = ccNumber(b);
    const v = ccValue(b);
    const c = index.byCc.get(cc);
    if (!c) return false;
    for (const [group, f] of Object.entries(FOCUS)) {
      if (c.key === f.controlId) {
        // Any non-zero means the second layer: the focus button is a button,
        // and a Nord sends 127 when it is pressed, but which button was asked
        // for is decided by the map, not by the size of the number.
        const layer = (c.values && c.values[v] === f.layers[1]) || v !== 0 ? f.layers[1] : f.layers[0];
        const changed = focus[group] !== layer;
        focus[group] = layer;
        if (!changed) return true;
        const text = `${c.name}: ${ccValueLabel(c, v, layer)}`;
        onAnnounce(text, { key: c.key, def: c, focus: group, layer });
        return true;
      }
    }
    // A focus control that is not one of the layer registers (the Stage 4
    // section focus, the Piano's effects focus) is an ordinary control and
    // falls through to the debouncer below.
    return false;
  }

  function describeEntry(entry) {
    const { key, value, meta, from } = entry;
    if (!meta || !meta.control) {
      // Unmapped, but the value only moves once per settle: saying "64" again
      // for a knob already sitting at 64 is the same noise as for a mapped one.
      if (from !== undefined && from !== null && from === value) return null;
      const addr = meta && meta.nrpnAddress;
      const noun = addr ? `NRPN ${addr}` : `Controller ${key}`;
      return { text: `${noun} = ${value}`, key };
    }
    const def = { ...meta.control, name: controlLabel(meta.control, meta.layer) };
    const text = describeChange(def, { value, from });
    return text ? { text, key, def } : null;
  }

  // Transport hands us raw messages; the NRPN package arrives in pieces and is
  // resolved here, because only the session knows the map's NRPN addresses.
  let nrpnMsb = null;
  let nrpnLsb = null;

  function feed(raw) {
    const b = toBytes(raw);
    const line = logSink.feed(b);
    if (!b.length) return null;

    if (handleFocus(b)) return null;

    // Playing is not a controller change. Notes are counted by the log and
    // stop here: they used to fall through to the debouncer, where controlKey
    // answered null, every keypress piled into one `null` bucket, and a
    // release value of 0 made the announcer read a note off as a knob being
    // turned down to zero. A screen reader for a keyboard that talks while
    // you play is unusable.
    if (isNoteMessage(b)) return line;

    if (isCc(b)) {
      const cc = ccNumber(b);
      const v = ccValue(b);
      // CC 6 is the coarse data entry a Nord sends as a literal 0; it never
      // carries the parameter value on these instruments, so it is logged
      // but never announced.
      if (isNrpnTransport(cc)) {
        if (cc === 99) nrpnMsb = v;
        if (cc === 98) nrpnLsb = v;
        if (cc === 38 && nrpnMsb !== null && nrpnLsb !== null) {
          const addr = `${nrpnMsb}:${nrpnLsb}`;
          const control = index.byNrpn.get(addr);
          if (control) {
            debouncer.push(`nrpn:${addr}`, v, { control, layer: layerFor(control) });
          } else {
            // A parameter the map does not know about is still a change worth
            // hearing, named by the address the manual would use.
            debouncer.push(`nrpn:${addr}`, v, { control: null, nrpnAddress: addr });
          }
        }
        return line;
      }
    }

    // Every CC goes through the debouncer, mapped or not: a message we cannot
    // name is still the instrument telling us something, and a screen reader
    // that goes silent on an unknown knob is worse than one that reads a
    // number. The announcer falls back to a generic sentence.
    const hit = controlFor(b);
    debouncer.push(controlKey(b), ccValue(b),
      hit ? { control: hit.control, layer: hit.layer } : { control: null });
    return line;
  }

  // Call on a timer (or after each message); returns what was said.
  //
  // Everything that settled since the last call goes out as ONE line. Several
  // knobs let go at once, or a button that moves two controls, is one event to
  // the person holding the instrument; announced one sentence per control it
  // becomes a burst the screen reader reads over itself. The return value is
  // therefore a list with at most one sentence in it.
  function tick(at = now()) {
    const described = debouncer.tick(at).map(describeEntry).filter(Boolean);
    return emit(described);
  }

  function flushAll(at = now()) {
    return emit(debouncer.flushAll().map(describeEntry).filter(Boolean));
  }

  function emit(described) {
    if (!described.length) return [];
    const text = joinAnnouncements(described.map((d) => d.text));
    if (!text) return [];
    onAnnounce(text, { parts: described.map((d) => d.text), keys: described.map((d) => d.key) });
    return [text];
  }

  function setStatus(parts) {
    const text = statusLine(parts);
    onStatus(text);
    return text;
  }

  return {
    feed, tick, flushAll, setMap, setStatus,
    get map() { return currentMap; },
    get modelName() { return modelName; },
    get log() { return logSink; },
    get pendingKeys() { return debouncer.pendingKeys(); },
    get lastValue() { return (k) => debouncer.lastValue(k); },
    get focus() { return { ...focus }; },
    reset() { debouncer.reset(); nrpnMsb = null; nrpnLsb = null; focus = { piano: null, synth: null }; },
  };
}
