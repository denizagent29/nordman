import test from 'node:test';
import assert from 'node:assert/strict';

import { createSession, indexControls, controlLabel, mapById } from '../src/session.js';
import { NORD_PIANO_6 } from '../data/nord-piano-6.js';
import { NORD_STAGE_4 } from '../data/nord-stage-4.js';

const cc = (num, val, ch = 0) => Uint8Array.from([0xb0 | ch, num, val]);

// A clock the test drives by hand, so no timers are involved.
function fakeClock() {
  let t = 0;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

function harness(opts = {}) {
  const clock = fakeClock();
  const heard = [];
  const status = [];
  const session = createSession({
    map: NORD_PIANO_6,
    modelName: 'Nord Piano 6',
    now: clock.now,
    onAnnounce: (text) => heard.push(text),
    onStatus: (text) => status.push(text),
    ...opts,
  });
  // tick() hands back at most one sentence — the whole settle goes out as one
  // line — so the split between "one announcement" and "several controls in
  // it" is made here rather than in every test. `heard` is the flat list of
  // clauses, which is what a test about a single control cares about.
  const tick = (...args) => {
    const out = session.tick(...args);
    for (const line of out) for (const part of line.split(' and ')) heard.push(part);
    return out;
  };
  return { session, clock, heard, status, tick };
}

test('the maps are indexed by CC number', () => {
  const { byCc, byNrpn } = indexControls(NORD_PIANO_6);
  assert.equal(byCc.get(7).key, 'volume');
  assert.equal(byNrpn.get('2:33').key, 'pianoSelect');
});

test('a knob that settles is announced once, by name and value', () => {
  const { session, clock, heard } = harness();
  session.feed(cc(19, 10));
  session.feed(cc(19, 90));
  assert.deepEqual(session.tick(), [], 'still moving — nothing yet');
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Reverb type, value 90']);
  assert.deepEqual(heard, ['Reverb type, value 90']);
});

test('a knob still being turned is not announced on every message', () => {
  const { session, clock } = harness();
  for (let i = 0; i < 40; i++) session.feed(cc(19, i * 3));
  clock.advance(50);
  assert.deepEqual(session.tick(), [], 'a 50 ms pause is not a settle');
  clock.advance(150);
  assert.equal(session.tick().length, 1, 'one announcement for the whole burst');
});

test('two knobs settling together arrive in one line, not two', () => {
  // The owner's ask: several controls can change faster than a sentence takes
  // to read, and one sentence per control talks over itself.
  const { session, clock, tick } = harness();
  session.feed(cc(19, 1));
  session.feed(cc(113, 1));
  clock.advance(200);
  const out = tick();
  assert.deepEqual(out, ['Reverb type, value 1 and Reverb dry/wet, 1']);
});

test('two knobs settling apart are still two separate announcements', () => {
  // Coalescing must not merge a change made now with one made a minute ago.
  const { session, clock, tick } = harness();
  session.feed(cc(19, 1));
  clock.advance(200);
  assert.deepEqual(tick(), ['Reverb type, value 1']);
  session.feed(cc(113, 1));
  clock.advance(200);
  assert.deepEqual(tick(), ['Reverb dry/wet, 1']);
});

test('a set longer than the cap is counted, not silently dropped', () => {
  const { session, clock, tick } = harness();
  for (const num of [19, 113, 18, 21, 20]) session.feed(cc(num, 40));
  clock.advance(200);
  const [line] = tick();
  assert.match(line, /and 2 more changes$/, line);
});

test('the same channel is tracked apart from another one', () => {
  const { session, clock } = harness();
  session.feed(cc(7, 10, 0));
  session.feed(cc(7, 20, 5));
  clock.advance(200);
  const out = session.tick();
  assert.equal(out.length, 1, 'one line');
  assert.match(out[0], /Volume, 20.* and .*Volume, 10|Volume, 10.* and .*Volume, 20/, out[0]);
});

test('an unmapped CC is announced generically rather than silently dropped', () => {
  const { session, clock } = harness();
  // CC 30 is not used by the Piano 6 map — a device sending it is telling us
  // something we have no name for, and saying so beats saying nothing.
  session.feed(cc(30, 64));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Controller ch1:cc:30 = 64']);
});

test('an NRPN parameter is announced by its map name, not its address', () => {
  const { session, clock } = harness();
  session.feed(cc(99, 2));
  session.feed(cc(98, 33));
  session.feed(cc(6, 0));
  session.feed(cc(38, 0));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Piano select, line A, slot one']);
});

test('the NRPN transport bytes are never themselves announced as controls', () => {
  const { session, clock } = harness();
  session.feed(cc(99, 2));
  session.feed(cc(98, 33));
  clock.advance(200);
  assert.deepEqual(session.tick(), [], 'CC 99/98 are transport, not knobs');
});

test('two NRPN parameters do not collapse into one controller', () => {
  const { session, clock } = harness();
  session.feed(cc(99, 2)); session.feed(cc(98, 33)); session.feed(cc(38, 0));
  session.feed(cc(99, 3)); session.feed(cc(98, 4)); session.feed(cc(38, 7));
  clock.advance(200);
  const out = session.tick();
  assert.equal(out.length, 1);
  assert.match(out[0], /Piano select/, out[0]);
  assert.match(out[0], /Sample select/, out[0]);
});

test('a switch is spoken as on or off', () => {
  const { session, clock } = harness();
  session.feed(cc(17, 127));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Reverb enable, on']);
});

test('a knob nudged away and back does not re-announce the value it never left', () => {
  // The hardware sends the whole burst; only the first message moves the knob.
  // Announcing "5" again after it settled on 5 would be noise in the ear.
  const { session, clock } = harness();
  session.feed(cc(19, 5));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Reverb type, value 5']);
  session.feed(cc(19, 9));            // nudged away…
  session.feed(cc(19, 5));            // …and back within the same burst
  clock.advance(200);
  assert.deepEqual(session.tick(), [], 'it never left 5 for longer than the quiet window');
});

// ---------------------------------------------------------------------------
// Layer focus — the same knob means two different things
// ---------------------------------------------------------------------------

test('piano layer editing follows the layer focus knob', () => {
  const { session, clock } = harness();
  session.feed(cc(109, 0));            // focus layer A
  session.feed(cc(34, 100));           // piano layer A level
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Piano layer A level A, 100']);
});

test('the focused layer is named, and switches when focus moves', () => {
  const { session, clock } = harness();
  session.feed(cc(109, 0));
  session.feed(cc(34, 100));
  session.feed(cc(109, 127));          // focus layer B
  session.feed(cc(56, 20));
  clock.advance(200);
  const out = session.tick();
  const all = out.join(' | ');
  assert.ok(all.includes('Piano layer A level A, 100'), all);
  assert.ok(all.includes('Piano layer B level B, 20'), all);
  assert.deepEqual(session.focus.piano, 'B');
});

test('a control outside a layered group gets no layer suffix', () => {
  const { session, clock } = harness();
  session.feed(cc(7, 90));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Volume, 90']);
});

test('an NRPN parameter the map does not know is still announced, by address', () => {
  const { session, clock } = harness();
  session.feed(cc(99, 9));   // not in the Piano 6 map
  session.feed(cc(98, 9));
  session.feed(cc(38, 42));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['NRPN 9:9 = 42']);
});

test('controlLabel only adds a layer when it is known', () => {
  const def = { name: 'Piano layer A level' };
  assert.equal(controlLabel(def, null), 'Piano layer A level');
  assert.equal(controlLabel(def, 'B'), 'Piano layer A level B');
  assert.equal(controlLabel(null, 'B'), null);
});

// ---------------------------------------------------------------------------
// Model switching
// ---------------------------------------------------------------------------

test('switching the map re-points a CC at the new model meaning', () => {
  const { session, clock } = harness();
  // 52 is Synth voice mode on the Piano 6, and a different control on the Stage 4.
  session.setMap(NORD_STAGE_4, 'Nord Stage 4');
  session.feed(cc(7, 40));
  clock.advance(200);
  const out = session.tick();
  assert.ok(out[0].startsWith('Volume'), out.join(' | '));
});

test('switching the map clears the capture, so old lines cannot be misread', () => {
  const { session } = harness();
  session.feed(cc(19, 5));
  assert.equal(session.log.lines.length, 1);
  session.setMap(NORD_STAGE_4, 'Nord Stage 4');
  assert.equal(session.log.lines.length, 0);
});

test('the log records what came in, including notes as a count', () => {
  const { session } = harness();
  session.feed(cc(19, 5));
  session.feed(Uint8Array.from([0x90, 60, 100]));
  assert.equal(session.log.lines.length, 1);
  assert.equal(session.log.counters.note, 1);
});

test('flushAll emits whatever was still settling, for a deliberate disconnect', () => {
  const { session } = harness();
  session.feed(cc(19, 77));
  const out = session.flushAll();
  assert.deepEqual(out, ['Reverb type, cathedral']);
});

test('reset forgets the pending knobs and the layer focus', () => {
  const { session } = harness();
  session.feed(cc(109, 127));
  session.feed(cc(19, 9));
  session.reset();
  assert.deepEqual(session.pendingKeys, []);
  assert.equal(session.focus.piano, null);
});

test('mapById returns null for a model we have no map for', () => {
  assert.equal(mapById('nord-piano-6').id, 'nord-piano-6');
  assert.equal(mapById('nord-grand'), null);
});

test('neither model map has an undocumented duplicate address', () => {
  // A duplicate CC without `sharedWith` means the transcription contradicted
  // itself — the announcer would then name the wrong control, confidently.
  for (const map of [NORD_PIANO_6, NORD_STAGE_4]) {
    const { collisions } = indexControls(map);
    assert.deepEqual(collisions, [], `${map.id} has a duplicate address`);
  }
});

test('a documented shared address is allowed and resolves to one of the two', () => {
  const { byCc, collisions } = indexControls(NORD_STAGE_4);
  assert.deepEqual(collisions, []);
  assert.ok(byCc.get(15).sharedWith, 'CC 15 is marked as shared');
});

// ---------------------------------------------------------------------------
// Playing is not a control change
// ---------------------------------------------------------------------------

const noteOn = (n = 60, v = 100, ch = 0) => Uint8Array.from([0x90 | ch, n, v]);
const noteOff = (n = 60, ch = 0) => Uint8Array.from([0x80 | ch, n, 0]);

test('playing never reaches the status line', () => {
  // The bug this guards: notes fell through to the debouncer, controlKey
  // answered null for all of them, and they piled into one shared bucket. A
  // note off carries value 0, so the announcer read it as a knob turned down
  // to zero — the owner heard his own playing as controller changes.
  const { session, clock, heard } = harness();
  session.feed(noteOn(60, 100));
  clock.advance(200);
  assert.deepEqual(session.tick(), [], 'a keypress says nothing');
  session.feed(noteOff(60));
  clock.advance(200);
  assert.deepEqual(session.tick(), [], 'a release says nothing either');
  assert.deepEqual(heard, []);
});

test('a burst of playing cannot masquerade as a knob sweep', () => {
  const { session, clock, heard } = harness();
  for (let i = 0; i < 40; i++) {
    session.feed(noteOn(60 + (i % 12), 100));
    session.feed(noteOff(60 + (i % 12)));
    clock.advance(10);
  }
  clock.advance(500);
  assert.deepEqual(session.tick(), []);
  assert.deepEqual(heard, [], 'none of it is an announcement');
});

test('a knob still speaks while the other hand is playing', () => {
  // Suppressing notes must not suppress controllers mixed in with them.
  const { session, clock, heard } = harness();
  session.feed(noteOn(64, 100));
  session.feed(cc(19, 90));
  session.feed(noteOff(64));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['Reverb type, value 90']);
  assert.deepEqual(heard, ['Reverb type, value 90']);
});

test('playing is still counted in the capture', () => {
  const { session } = harness();
  for (let i = 0; i < 5; i++) session.feed(noteOn(60 + i, 100));
  assert.equal(session.log.counters.note, 5, 'the log still saw them');
  assert.equal(session.log.lines.length, 0, 'but they are not listed');
});

test('turning the layer focus says which layer the next edit lands on', () => {
  // The complaint: enabling a layer while the synth was focused announced the
  // effect chain's focus instead, and never said where the knobs now point.
  const { session, clock, heard } = harness();
  session.feed(cc(109, 127));          // piano layer focus → B
  clock.advance(200);
  session.tick();
  assert.ok(heard.includes('Layer edit focus: B'), heard.join(' | '));
  assert.equal(session.focus.piano, 'B');
});

test('the focus is announced once, not on every repeat of the same value', () => {
  // The instrument re-sends the focus CC as part of its state dumps; saying
  // the same thing again is the stutter this project has already fought.
  const { session, clock, heard } = harness();
  session.feed(cc(109, 0));
  clock.advance(200);
  session.tick();
  session.feed(cc(109, 0));
  clock.advance(200);
  session.tick();
  assert.equal(heard.filter((h) => h.startsWith('Layer edit focus:')).length, 1, heard.join(' | '));
});

test('an unmapped NRPN still reports its address rather than a name', () => {
  const { session, clock } = harness();
  session.feed(cc(99, 9)); session.feed(cc(98, 9)); session.feed(cc(38, 26));
  clock.advance(200);
  assert.deepEqual(session.tick(), ['NRPN 9:9 = 26']);
});
