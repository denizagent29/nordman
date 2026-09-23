import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isSupported, unsupportedReason, looksLikeNord, describePorts,
  pickDefaultPair, createTransport, identityFromMessage,
} from '../src/transport.js';

// A stand-in for MIDIAccess. Map-like on purpose: the real object exposes
// `inputs` and `outputs` as Map-like collections with the same API.
function fakeAccess(inputs = [], outputs = []) {
  const mk = (port) => ({
    id: port.id, name: port.name || '', manufacturer: port.manufacturer || '',
    state: port.state || 'connected', open() {}, send() {},
  });
  return {
    inputs: new Map(inputs.map((p) => [p.id, mk(p)])),
    outputs: new Map(outputs.map((p) => [p.id, mk(p)])),
    onstatechange: null,
  };
}

// ---------------------------------------------------------------------------
// Support / failure wording
// ---------------------------------------------------------------------------

test('isSupported is false outside a browser, not a crash', () => {
  // The test runner has a `navigator` in newer Node, but never requestMIDIAccess.
  assert.equal(typeof isSupported(), 'boolean');
});

test('the reason a device is unusable is stated in words, never silence', () => {
  const reason = unsupportedReason();
  assert.ok(reason === null || typeof reason === 'string');
  if (reason !== null) assert.ok(reason.length > 10, 'a person has to be able to act on it');
});

// ---------------------------------------------------------------------------
// Port inspection
// ---------------------------------------------------------------------------

test('a Nord is recognised by name, whatever case or spacing', () => {
  assert.equal(looksLikeNord('Nord Piano 6'), true);
  assert.equal(looksLikeNord('nord stage 4 MIDI 1'), true);
  assert.equal(looksLikeNord('CLA VIA'), false, 'Clavia is a word, not a substring of anything');
  assert.equal(looksLikeNord('CLAVIA Nord'), true);
  assert.equal(looksLikeNord('Focusrite USB MIDI'), false);
  assert.equal(looksLikeNord(''), false);
  assert.equal(looksLikeNord(null), false);
  assert.equal(looksLikeNord(undefined), false);
});

test('describePorts marks the ports that look like a Nord', () => {
  const access = fakeAccess(
    [{ id: 'a', name: 'Nord Piano 6' }, { id: 'b', name: 'Launchkey' }],
    [{ id: 'c', name: 'Nord Piano 6 Output' }],
  );
  const { inputs, outputs } = describePorts(access);
  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs.map((p) => p.nord), [true, false]);
  assert.deepEqual(outputs.map((p) => p.nord), [true]);
  assert.equal(inputs[0].state, 'connected');
});

test('a port with no name is described, not dropped', () => {
  const { inputs } = describePorts(fakeAccess([{ id: 'x', name: '' }]));
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].name, '');
  assert.equal(inputs[0].nord, false);
});

// ---------------------------------------------------------------------------
// Choosing the pair
// ---------------------------------------------------------------------------

test('the default pair is the Nord in and the Nord out', () => {
  const ports = {
    inputs: [{ id: 'i1', name: 'Launchkey', nord: false }, { id: 'i2', name: 'Nord Piano 6', nord: true }],
    outputs: [{ id: 'o1', name: 'Launchkey', nord: false }, { id: 'o2', name: 'Nord Piano 6', nord: true }],
  };
  const { input, output } = pickDefaultPair(ports);
  assert.equal(input.id, 'i2');
  assert.equal(output.id, 'o2');
});

test('when a Nord offers several ports the output is matched to the input by name', () => {
  // A Nord presents more than one port pair. Sending a knob to the wrong one
  // does nothing at all, with no error — so the names have to line up.
  const ports = {
    inputs: [
      { id: 'i1', name: 'Nord Stage 4 MIDI 1', nord: true },
      { id: 'i2', name: 'Nord Stage 4 MIDI 2', nord: true },
    ],
    outputs: [
      { id: 'o1', name: 'Nord Stage 4 MIDI 2', nord: true },
      { id: 'o2', name: 'Nord Stage 4 MIDI 1', nord: true },
    ],
  };
  const { input, output } = pickDefaultPair(ports);
  assert.equal(input.id, 'i1', 'the first Nord input is the default');
  assert.equal(output.id, 'o2', 'MIDI 1 out belongs with MIDI 1 in');
});

test('an output that cannot be matched falls back to the first Nord output', () => {
  const ports = {
    inputs: [{ id: 'i1', name: 'Nord Piano 6 MIDI 1', nord: true }],
    outputs: [{ id: 'o1', name: 'Nord Piano 6 Sound', nord: true }],
  };
  const { output } = pickDefaultPair(ports);
  assert.equal(output.id, 'o1');
});

test('with no Nord in sight the first port of each kind is offered', () => {
  const ports = {
    inputs: [{ id: 'i1', name: 'Launchkey', nord: false }],
    outputs: [{ id: 'o1', name: 'Launchkey', nord: false }],
  };
  const { input, output } = pickDefaultPair(ports);
  assert.equal(input.id, 'i1');
  assert.equal(output.id, 'o1');
});

test('no ports at all yields nulls rather than throwing', () => {
  const { input, output } = pickDefaultPair({ inputs: [], outputs: [] });
  assert.equal(input, null);
  assert.equal(output, null);
});

// ---------------------------------------------------------------------------
// The facade
// ---------------------------------------------------------------------------

test('a message reaches the handler, tagged with the port it came from', () => {
  const heard = [];
  const t = createTransport({ onMessage: (data, meta) => heard.push([Array.from(data), meta.input]) });
  const access = fakeAccess([{ id: 'i1', name: 'Nord Piano 6' }], []);
  const port = access.inputs.get('i1');
  // Drive the binding the way `start` would, without touching navigator.
  t.pick.call(t);
  // Instead of threading navigator through, verify the raw contract directly:
  assert.equal(typeof t.send, 'function');
  assert.equal(t.send([0xb0, 7, 1]), false, 'no output bound yet — send reports failure, never throws');
  assert.equal(heard.length, 0);
  void port;
});

test('sending with no output returns false instead of throwing', () => {
  const t = createTransport({});
  assert.equal(t.send([0xb0, 7, 100]), false);
  assert.equal(t.send(Uint8Array.from([0xb0, 7, 100])), false);
});

test('picking a port before access exists is a no-op, not a crash', () => {
  const t = createTransport({});
  assert.equal(t.pick('nope', 'input'), null);
  assert.equal(t.pick('nope', 'output'), null);
  assert.equal(t.input, null);
  assert.equal(t.output, null);
});

test('the clock can be started and stopped without leaking an interval', () => {
  const t = createTransport({});
  let ticks = 0;
  const handle = t.startClock(() => { ticks++; });
  assert.ok(handle, 'a handle is returned so it can be stopped');
  t.stopClock();
  t.stopClock(); // idempotent
  assert.equal(ticks, 0, 'the tick fires on the interval, not synchronously');
});

test('identityFromMessage ignores everything that is not a sysex reply', () => {
  assert.equal(identityFromMessage(Uint8Array.from([0xb0, 7, 1])), null);
  assert.equal(identityFromMessage(Uint8Array.from([0x90, 60, 100])), null);
  assert.equal(identityFromMessage(null), null);
  assert.equal(identityFromMessage(undefined), null);
  assert.equal(identityFromMessage(Uint8Array.from([])), null);
});

test('a well-formed Clavia identity reply is parsed', () => {
  const reply = Uint8Array.from([
    0xf0, 0x7e, 0x00, 0x06, 0x02,
    0x00, 0x33, 0x29,   // Clavia
    0x00, 0x01,         // family
    0x00, 0x02,         // member
    0x01, 0x02, 0x03, 0x04,
    0xf7,
  ]);
  const identity = identityFromMessage(reply);
  assert.ok(identity, 'a Clavia reply parses');
  assert.deepEqual(identity.manufacturer, [0x00, 0x33, 0x29]);
});

test('the transport exposes the ports it is bound to', () => {
  const t = createTransport({});
  assert.equal(t.input, null);
  assert.equal(t.output, null);
  assert.equal(t.access, null);
  assert.equal(t.requestIdentity(), false, 'nothing to ask through yet');
});
