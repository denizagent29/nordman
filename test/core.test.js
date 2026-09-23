import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deviceIdentityRequest, parseIdentityReply, isClavia, isCc, ccNumber, ccValue,
  channel, isPitchBend, pitchBendValue, isProgramChange, sysexPayload, toBytes,
} from '../src/midi.js';
import { createDebouncer } from '../src/debounce.js';
import { resolveModel, detectByPortName, modelById } from '../src/models.js';

test('identity request is a universal non-realtime device inquiry', () => {
  assert.deepEqual([...deviceIdentityRequest()], [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7]);
});

test('Clavia identity reply parses and is recognised as a manufacturer', () => {
  // 7E 00 06 02 00 33 29 00 00 00 00 00 01 02 03 04 F7
  const reply = Uint8Array.from([
    0xf0, 0x7e, 0x00, 0x06, 0x02,
    0x00, 0x33, 0x29, // Clavia
    0x00, 0x04, // family
    0x00, 0x01, // member
    0x01, 0x02, 0x03, 0x04, // version
    0xf7,
  ]);
  const id = parseIdentityReply(reply);
  assert.ok(id, 'reply should parse');
  assert.deepEqual(id.manufacturer, [0x00, 0x33, 0x29]);
  assert.equal(id.family, 4);
  assert.equal(id.member, 1);
  assert.ok(isClavia(id));
});

test('a non-universal SysEx is not mistaken for an identity reply', () => {
  const other = Uint8Array.from([0xf0, 0x33, 0x00, 0x06, 0x02, 0x00, 0x33, 0x29, 0, 0, 0, 0, 0, 0, 0, 0xf7]);
  assert.equal(parseIdentityReply(other), null);
});

test('identity reply from another manufacturer is rejected', () => {
  const yamaha = Uint8Array.from([
    0xf0, 0x7e, 0x00, 0x06, 0x02, 0x43, 0x00, 0x41, 0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0xf7,
  ]);
  const id = parseIdentityReply(yamaha);
  assert.ok(id);
  assert.equal(isClavia(id), false);
});

test('CC parsing reads number, value and channel', () => {
  const msg = Uint8Array.from([0xb2, 74, 100]);
  assert.ok(isCc(msg));
  assert.equal(ccNumber(msg), 74);
  assert.equal(ccValue(msg), 100);
  assert.equal(channel(msg), 3);
});

test('pitch bend is centred on zero', () => {
  assert.equal(pitchBendValue(Uint8Array.from([0xe0, 0x00, 0x40])), 0);
  assert.equal(pitchBendValue(Uint8Array.from([0xe0, 0x7f, 0x7f])), 8191);
  assert.ok(isPitchBend(Uint8Array.from([0xe0, 0x00, 0x40])));
});

test('program change is recognised and carries no value byte', () => {
  assert.ok(isProgramChange(Uint8Array.from([0xc0, 12])));
  assert.equal(isProgramChange(Uint8Array.from([0xb0, 12, 0])), false);
});

test('sysex payload strips the frame bytes', () => {
  assert.deepEqual([...sysexPayload(Uint8Array.from([0xf0, 0x7e, 0x06, 0xf7]))], [0x7e, 0x06]);
});

test('toBytes normalises DataView', () => {
  const buf = new Uint8Array([1, 2, 3]).buffer;
  assert.deepEqual([...toBytes(new DataView(buf))], [1, 2, 3]);
});

// ---------------------------------------------------------------------------
// Debouncer — the owner's 200 ms settle rule.
// ---------------------------------------------------------------------------

test('a knob burst produces exactly one settled announcement', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  for (const v of [10, 20, 30, 40]) {
    d.push('cc:74', v);
    t += 10; // 40 ms of turning
  }
  assert.deepEqual(d.tick(t), [], 'still moving — nothing settled yet');
  t += 189;
  assert.deepEqual(d.tick(t), [], '199 ms of quiet is not enough');
  t += 11; // 200 ms of quiet — the window is inclusive at the boundary
  const ready = d.tick(t);
  assert.equal(ready.length, 1, 'at exactly 200 ms it settles');
  assert.equal(ready[0].key, 'cc:74');
  assert.equal(ready[0].value, 40, 'announces the final value, not the first');
  assert.equal(ready[0].from, undefined, 'nothing known before the first move');
  assert.deepEqual(d.tick(t), [], 'not announced twice');
});

test('a second burst reports where it came from', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  d.push('cc:74', 40); t += 300; d.tick(t);
  d.push('cc:74', 60); t += 300; d.tick(t);
  assert.equal(d.lastValue('cc:74'), 60);
  d.push('cc:74', 90); t += 250;
  assert.equal(d.tick(t)[0].from, 60, 'from is the last announced value');
});

test('a slow turn settles repeatedly so the reader keeps up', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  const announced = [];
  for (let i = 0; i < 5; i++) {
    d.push('cc:74', i * 10);
    t += 300; // slower than the quiet window
    announced.push(...d.tick(t).map((e) => e.value));
  }
  assert.deepEqual(announced, [0, 10, 20, 30, 40]);
});

test('independent controllers settle independently', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  d.push('cc:74', 1);
  t += 250;
  d.push('cc:75', 2);
  t += 10;
  const ready = d.tick(t);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].key, 'cc:74', 'the older one settles first');
  t += 250;
  assert.equal(d.tick(t)[0].key, 'cc:75');
});

test('different channels on the same CC do not collide', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  d.push('ch1:cc:74', 1);
  d.push('ch2:cc:74', 2);
  t += 250;
  assert.equal(d.tick(t).length, 2);
});

test('flushAll drains everything on disconnect', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  d.push('a', 1);
  d.push('b', 2);
  t += 5;
  assert.equal(d.tick(t).length, 0);
  assert.equal(d.flushAll().length, 2);
  assert.deepEqual(d.pendingKeys(), []);
});

test('reset clears the queue and the last-announced memory', () => {
  let t = 0;
  const d = createDebouncer({ now: () => t });
  d.push('a', 1);
  t += 300;
  d.tick(t);
  d.push('a', 2);
  d.reset();
  assert.deepEqual(d.pendingKeys(), []);
  assert.equal(d.lastValue('a'), undefined);
});

// ---------------------------------------------------------------------------
// Model detection
// ---------------------------------------------------------------------------

test('port names detect the two target instruments', () => {
  assert.equal(detectByPortName('Nord Stage 4 MIDI').id, 'nord-stage-4');
  assert.equal(detectByPortName('nord piano 6').id, 'nord-piano-6');
  assert.equal(detectByPortName('Nord Wave 2'), null);
  assert.equal(detectByPortName(''), null);
  assert.equal(detectByPortName(undefined), null);
});

test('identity reply wins over port name', () => {
  const r = resolveModel({ portName: 'Nord Piano 6', identity: null });
  assert.equal(r.model.id, 'nord-piano-6');
  assert.equal(r.source, 'port-name');
  assert.equal(r.confident, false, 'a port name alone is never authoritative');
});

test('a user choice conflicting with detection is surfaced, not hidden', () => {
  const r = resolveModel({ portName: 'Nord Stage 4', chosenId: 'nord-piano-6' });
  assert.equal(r.model.id, 'nord-piano-6', 'the explicit choice wins');
  assert.equal(r.confident, false);
  assert.ok(r.conflict, 'the disagreement must be reported to the UI');
  assert.equal(r.conflict.detected.id, 'nord-stage-4');
});

test('no signal at all yields the unknown model rather than a guess', () => {
  const r = resolveModel({ portName: 'Some USB Keyboard' });
  assert.equal(r.model.id, 'unknown');
  assert.equal(r.source, 'none');
});

test('an explicit choice with no other signal is honoured', () => {
  const r = resolveModel({ portName: 'Some USB Keyboard', chosenId: 'nord-stage-4' });
  assert.equal(r.model.id, 'nord-stage-4');
  assert.equal(r.source, 'user');
});

test('model ids round-trip', () => {
  assert.equal(modelById('nord-piano-6').name, 'Nord Piano 6');
  assert.equal(modelById('nope'), null);
});
