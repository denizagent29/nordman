// Web MIDI transport. The only file that touches `navigator.requestMIDIAccess`
// — everything else stays testable without a browser.
//
// Chrome-only (Firefox and Safari do not implement Web MIDI), and it requires
// a secure context: https, or localhost for development. On an insecure origin
// `navigator.requestMIDIAccess` is simply absent, so the UI has to say so in
// words instead of failing quietly.
//
// A script may not send MIDI until the user has granted access, and in Chrome
// the grant is sticky per origin — but the *first* sysex send needs the user
// to have ticked the sysex box in the permission prompt, which is why sysex is
// requested as an option and the failure is reported rather than swallowed.

import { deviceIdentityRequest, parseIdentityReply, isSysex, toBytes } from './midi.js';

const CLOCK_TICK_MS = 40;

export function isSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

// The reason a device is not usable, in words a person can act on.
export function unsupportedReason() {
  if (typeof navigator === 'undefined') return 'This is not running in a browser.';
  if (typeof navigator.requestMIDIAccess !== 'function') {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      return 'Web MIDI needs a secure page — open the site over https.';
    }
    return 'This browser has no Web MIDI. Use Chrome or Edge.';
  }
  return null;
}

// A candidate Nord, from the port name. Deliberately loose: port names are
// renamed by drivers and users, so this only decides what to *offer*.
export function looksLikeNord(name) {
  return /nord|clavia/i.test(name || '');
}

export function describePorts(midiAccess) {
  const inputs = [];
  const outputs = [];
  for (const port of midiAccess.inputs.values()) {
    inputs.push({ id: port.id, name: port.name || '', manufacturer: port.manufacturer || '',
      state: port.state, nord: looksLikeNord(`${port.name} ${port.manufacturer}`) });
  }
  for (const port of midiAccess.outputs.values()) {
    outputs.push({ id: port.id, name: port.name || '', manufacturer: port.manufacturer || '',
      state: port.state, nord: looksLikeNord(`${port.name} ${port.manufacturer}`) });
  }
  return { inputs, outputs };
}

// The last number in a port name, so "Nord Stage 4 MIDI 2" and
// "Nord Stage 4 MIDI 1" are told apart by more than their prefix. Both the
// plain base and the numbered key are returned; a name without a number has
// only the base.
function portKey(name) {
  const n = (name || '').trim().toLowerCase();
  const numbered = n.match(/^(.*?)[\s-]*(\d+)\s*$/);
  const base = numbered ? numbered[1].replace(/[\s-]+$/, '') : n;
  return { base, full: numbered ? `${base} ${numbered[2]}` : base, index: numbered ? Number(numbered[2]) : null };
}

// Pick the input/output pair to use by default: prefer ports that look like a
// Nord, and match the output to the chosen input by name. A Nord presents
// several port pairs and sending a knob to the wrong one does nothing at all,
// with no error — so the names have to line up.
export function pickDefaultPair({ inputs, outputs }) {
  const nordIn = inputs.find((p) => p.nord);
  const nordOut = outputs.find((p) => p.nord);
  if (nordIn && nordOut) {
    const want = portKey(nordIn.name);
    // First the numbered port with the same number, then the same base name,
    // then any Nord output.
    const sameNumber = want.index === null ? null
      : outputs.find((p) => p.nord && portKey(p.name).full === want.full);
    const sameBase = outputs.find((p) => p.nord && portKey(p.name).base === want.base);
    return { input: nordIn, output: sameNumber || sameBase || nordOut };
  }
  return { input: nordIn || inputs[0] || null, output: nordOut || outputs[0] || null };
}

export async function requestAccess({ sysex = true } = {}) {
  if (!isSupported()) {
    const err = new Error(unsupportedReason() || 'Web MIDI unavailable');
    err.code = 'unsupported';
    throw err;
  }
  try {
    return await navigator.requestMIDIAccess({ sysex });
  } catch (e) {
    const err = new Error('MIDI access was refused');
    err.code = 'denied';
    err.cause = e;
    throw err;
  }
}

// A small facade the session drives. `onMessage` is called with a
// Uint8Array-like; the session parses it.
export function createTransport({ onMessage = () => {}, onPorts = () => {}, onState = () => {} } = {}) {
  let access = null;
  let currentInput = null;
  let currentOutput = null;
  let clock = null;

  function handleMessage(event) {
    onMessage(event.data, { input: currentInput ? currentInput.id : null });
  }

  function bindPort(port, which) {
    if (!port) return null;
    // Web MIDI allows several listeners; ours is replaced by assigning a new
    // one, so the previous port must be unbound first or a disconnect/reconnect
    // would deliver every message twice.
    port.onmidimessage = null;
    if (which === 'input') {
      port.onmidimessage = handleMessage;
      port.open();
    }
    return port;
  }

  function announcePorts() {
    if (!access) return;
    onPorts(describePorts(access));
  }

  async function start({ inputId = null, outputId = null, sysex = true } = {}) {
    access = await requestAccess({ sysex });
    access.onstatechange = () => {
      announcePorts();
      // A port that vanished takes its side of the wire with it; report so the
      // UI can stop pretending the instrument is still listening.
      const alive = (p) => p && p.state === 'connected';
      if (currentInput && !alive(currentInput)) { currentInput.onmidimessage = null; currentInput = null; onState({ kind: 'input-lost' }); }
      if (currentOutput && !alive(currentOutput)) { currentOutput = null; onState({ kind: 'output-lost' }); }
    };

    const ports = describePorts(access);
    const pair = pickDefaultPair(ports);
    const inPort = inputId ? access.inputs.get(inputId) : (pair.input ? access.inputs.get(pair.input.id) : null);
    const outPort = outputId ? access.outputs.get(outputId) : (pair.output ? access.outputs.get(pair.output.id) : null);

    if (currentInput) currentInput.onmidimessage = null;
    currentInput = bindPort(inPort || null, 'input');
    currentOutput = outPort || null;

    announcePorts();
    return { ports, pair: { input: currentInput, output: currentOutput } };
  }

  // Drives the debouncer. Not requestAnimationFrame: a background tab stops
  // rAF entirely, and the settle must still happen if the owner alt-tabs away
  // while turning a knob.
  function startClock(onTick) {
    stopClock();
    clock = setInterval(onTick, CLOCK_TICK_MS);
    return clock;
  }

  function stopClock() {
    if (clock) clearInterval(clock);
    clock = null;
  }

  function send(bytes) {
    if (!currentOutput) return false;
    const data = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
    currentOutput.send(data);
    return true;
  }

  // Ask the instrument who it is. Both supported models fail to answer this
  // (see nord-stage-4.js NORD_STAGE_4_DEVICE_NOTES.sysexIdentity), so the
  // caller must treat silence as "no answer", never as "not a Nord".
  function requestIdentity() {
    return send(deviceIdentityRequest());
  }

  function onSysexIdentity(handler) {
    onState({ kind: 'identity-handler', handler });
  }

  function pick(portId, which) {
    if (!access) return null;
    if (which === 'input') {
      if (currentInput) currentInput.onmidimessage = null;
      currentInput = bindPort(access.inputs.get(portId) || null, 'input');
      return currentInput;
    }
    currentOutput = access.outputs.get(portId) || null;
    return currentOutput;
  }

  return {
    start, send, requestIdentity, onSysexIdentity, pick, startClock, stopClock,
    get input() { return currentInput; },
    get output() { return currentOutput; },
    get access() { return access; },
  };
}

// Turn any incoming message into the identity reply shape, or null. Kept here
// rather than in the session so the session stays free of SysEx concerns.
// Normalised through `toBytes` first: a live `event.data` can be any array-like
// the browser hands us, and `isSysex` reads `.length` without guarding.
export function identityFromMessage(data) {
  if (data === null || data === undefined) return null;
  return isSysex(toBytes(data)) ? parseIdentityReply(data) : null;
}
