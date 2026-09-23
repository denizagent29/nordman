import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLog, isNoteMessage, nrpnRole, createNrpnTracker, flavourOf, controlKey,
  hexByte, hexDump,
} from '../src/log.js';

const cc = (num, val, ch = 0) => Uint8Array.from([0xb0 | ch, num, val]);

test('a CC is logged with its number, value and channel', () => {
  const log = createLog({ now: () => 0 });
  const line = log.feed(cc(74, 90, 2));
  assert.equal(line.kind, 'cc');
  assert.equal(line.text, 'CC 74 = 90 (channel 3)');
  assert.equal(line.cc, 74);
  assert.equal(line.value, 90);
});

test('notes are filtered out by default but still counted', () => {
  const log = createLog({ now: () => 0 });
  assert.equal(log.feed(Uint8Array.from([0x90, 60, 100])), null, 'note on hidden');
  assert.equal(log.feed(Uint8Array.from([0x80, 60, 0])), null, 'note off hidden');
  assert.equal(log.feed(Uint8Array.from([0xa0, 60, 40])), null, 'aftertouch hidden');
  assert.equal(log.counters.note, 3, 'the reader can still see how much was hidden');
  assert.equal(log.lines.length, 0);
});

test('notes can be kept when the reader wants to see everything', () => {
  const log = createLog({ now: () => 0, filterNotes: false });
  assert.ok(log.feed(Uint8Array.from([0x90, 60, 100])));
});

test('the NRPN package is labelled by role', () => {
  assert.equal(nrpnRole(99, 2).role, 'msb');
  assert.equal(nrpnRole(98, 33).role, 'lsb');
  assert.equal(nrpnRole(6, 0).role, 'data-msb');
  assert.equal(nrpnRole(38, 12).role, 'data-lsb');
  assert.equal(nrpnRole(74, 12), null, 'an ordinary CC is not NRPN traffic');
});

test('the NRPN tracker turns a bare value into the address it belongs to', () => {
  const t = createNrpnTracker();
  assert.equal(t.observe(99, 3), null);
  assert.equal(t.observe(98, 4), null);
  assert.deepEqual(t.observe(38, 12), { address: [3, 4], value: 12 });
  assert.deepEqual(t.address, [3, 4]);
});

test('a value byte before any address is not attributed to a stale one', () => {
  const t = createNrpnTracker();
  assert.equal(t.observe(38, 12), null, 'no address seen yet');
});

test('a Nord NRPN package reads as an addressed parameter, not four numbers', () => {
  const log = createLog({ now: () => 0 });
  log.feed(cc(99, 3));
  log.feed(cc(98, 4));
  log.feed(cc(6, 0));
  const line = log.feed(cc(38, 12));
  assert.equal(line.kind, 'nrpn');
  assert.equal(line.text, 'NRPN 3:4 = 12');
  assert.deepEqual(line.address, [3, 4]);
});

test('program change and pitch bend are recognisable, not lumped in as unknown', () => {
  const log = createLog({ now: () => 0 });
  assert.equal(log.feed(Uint8Array.from([0xc0, 12])).text, 'Program change 12 (channel 1)');
  assert.equal(log.feed(Uint8Array.from([0xe0, 0x00, 0x40])).text, 'Pitch bend 0');
  assert.equal(log.feed(Uint8Array.from([0xe0, 0x7f, 0x7f])).text, 'Pitch bend +8191');
});

test('an unrecognised message is preserved in full rather than dropped', () => {
  // 0xF3 (song select) is a real-time byte we do not model — unlike clock it
  // must keep its bytes in the text, so an unknown message is still readable.
  const log = createLog({ now: () => 0 });
  const line = log.feed(Uint8Array.from([0xf3, 0x05]));
  assert.equal(line.kind, 'other');
  assert.ok(line.text.includes('0xf3'));
});

test('clock is told apart from an unknown real-time byte', () => {
  // The distinction matters: clock is expected and ignored, anything else is
  // a message nobody has seen before and has to survive in the log.
  const log = createLog({ now: () => 0 });
  assert.equal(log.feed(Uint8Array.from([0xf8])).kind, 'clock');
  assert.equal(log.feed(Uint8Array.from([0xfe])).kind, 'clock', 'active sensing too');
  assert.equal(log.feed(Uint8Array.from([0xf3])).kind, 'other');
});

test('SysEx is captured, since a device inquiry reply is evidence', () => {
  const log = createLog({ now: () => 0 });
  const line = log.feed(Uint8Array.from([0xf0, 0x7e, 0x00, 0x06, 0x02, 0xf7]));
  assert.equal(line.kind, 'sysex');
  assert.deepEqual(line.payload, [0x7e, 0x00, 0x06, 0x02]);
});

// ---------------------------------------------------------------------------
// The export is for a person reading Telegram, not for a parser
// ---------------------------------------------------------------------------

test('the export is one line per event, so wrapping cannot merge two of them', () => {
  const log = createLog({ now: () => 0, modelName: 'Nord Piano 6' });
  log.feed(cc(74, 1));
  log.feed(cc(75, 2));
  const body = log.toText().split('\n').filter((l) => !l.startsWith('#'));
  assert.equal(body.length, 2);
  for (const line of body) {
    assert.match(line, /^\d+\t\d+\t[a-z]+\t/);
  }
});

test('the export carries the timestamps of the events, not of the export', () => {
  let t = 1000;
  const log = createLog({ now: () => t });
  log.feed(cc(74, 1));
  t = 5000;
  assert.ok(log.toText().includes('1000'), 'the event time is kept');
});

test('an empty log still exports a header rather than an empty string', () => {
  const log = createLog({ now: () => 0 });
  const text = log.toText();
  assert.match(text, /0 events/);
});

// ---------------------------------------------------------------------------
// Burst flavour — telling a deliberate sweep from a flick
// ---------------------------------------------------------------------------

test('a flick, a wobble and a sweep are told apart', () => {
  assert.equal(flavourOf(2, 10, 90), 'flick');
  assert.equal(flavourOf(8, 64, 66), 'wobble');
  assert.equal(flavourOf(8, 0, 127), 'sweep');
});

test('the summary groups a burst of one knob into a single entry', () => {
  const log = createLog({ now: () => 0 });
  for (const v of [0, 16, 32, 48, 64, 80, 96, 112, 127]) log.feed(cc(19, v));
  const s = log.summary();
  assert.equal(s.length, 1);
  assert.equal(s[0].cc, 19);
  assert.equal(s[0].steps, 9);
  assert.equal(s[0].flavour, 'sweep');
  assert.equal(s[0].min, 0);
  assert.equal(s[0].max, 127);
});

test('two knobs turned one after another stay two entries', () => {
  const log = createLog({ now: () => 0 });
  for (const v of [0, 60, 127]) log.feed(cc(19, v));
  for (const v of [127, 60, 0]) log.feed(cc(18, v));
  const s = log.summary();
  assert.equal(s.length, 2);
  assert.deepEqual(s.map((e) => e.cc).sort((a, b) => a - b), [18, 19]);
});

test('a sweep that reached every position is offered as an enum candidate', () => {
  const log = createLog({ now: () => 0 });
  for (const v of [0, 32, 64, 96, 127]) log.feed(cc(19, v));
  const cands = log.enumCandidates();
  assert.equal(cands.length, 1);
  assert.equal(cands[0].cc, 19);
  assert.equal(cands[0].distinct, 5, 'five positions means a five-way choice');
});

test('a one-position nudge is not an enum candidate', () => {
  const log = createLog({ now: () => 0 });
  log.feed(cc(19, 64));
  assert.deepEqual(log.enumCandidates(), []);
});

test('clearing empties the lines, the counters and the NRPN registers', () => {
  const log = createLog({ now: () => 0 });
  log.feed(cc(99, 3));
  log.feed(cc(74, 1));
  log.clear();
  assert.equal(log.lines.length, 0);
  assert.equal(log.counters.cc, 0);
  assert.equal(log.feed(cc(38, 5)).text, 'NRPN value = 5', 'the stale 3: must not survive');
});

test('a hex dump keeps status bytes whole instead of masking them to 7 bits', () => {
  // 0xF8 is a clock tick. Masked to 0x7f it prints as "0x78", which looks like
  // an ordinary data byte — the dump would then quietly mislead.
  assert.equal(hexByte(0xf8), '0xf8');
  assert.equal(hexByte(0x00), '0x00');
  assert.equal(hexByte(0x7f), '0x7f');
  assert.equal(hexDump(Uint8Array.from([0xf0, 0x7e, 0x0a])), '0xf0 0x7e 0x0a');
});

test('the control key matches the one the debouncer uses', () => {
  assert.equal(controlKey(cc(74, 1, 2)), 'ch3:cc:74');
  assert.equal(controlKey(Uint8Array.from([0x90, 60, 1])), null);
});

test('isNoteMessage covers note on, note off and poly aftertouch only', () => {
  assert.ok(isNoteMessage(Uint8Array.from([0x90, 60, 1])));
  assert.ok(isNoteMessage(Uint8Array.from([0x8f, 60, 1])));
  assert.ok(isNoteMessage(Uint8Array.from([0xa0, 60, 1])));
  assert.equal(isNoteMessage(cc(74, 1)), false);
  assert.equal(isNoteMessage(Uint8Array.from([0xe0, 0, 64])), false);
});
