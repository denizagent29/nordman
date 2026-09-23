import test from 'node:test';
import assert from 'node:assert/strict';

import { formatValue, describeChange, statusLine, joinAnnouncements } from '../src/announce.js';

const knob = { name: 'Reverb mix', kind: 'range' };
const sw = { name: 'Chorus', kind: 'switch' };
const sel = { name: 'Reverb type', kind: 'enum', values: { 0: 'Room', 1: 'Hall', 2: 'Stage' } };
const bipolar = { name: 'Pan', kind: 'bipolar' };

test('a range announces its number', () => {
  assert.equal(formatValue(knob, 100), '100');
  assert.equal(formatValue(knob, 0), '0');
});

test('a switch is announced as on or off, not as 0 or 127', () => {
  assert.equal(formatValue(sw, 127), 'on');
  assert.equal(formatValue(sw, 64), 'on');
  assert.equal(formatValue(sw, 0), 'off');
});

test('an enum announces its label', () => {
  assert.equal(formatValue(sel, 1), 'Hall');
});

test('an enum with an unmapped value still says something usable', () => {
  assert.equal(formatValue(sel, 9), 'value 9');
});

test('a bipolar knob says which side of centre it is on', () => {
  assert.equal(formatValue(bipolar, 64), 'centre (64)');
  assert.equal(formatValue(bipolar, 74), 'plus 10 (74)');
  assert.equal(formatValue(bipolar, 54), 'minus 10 (54)');
});

test('the name comes first and the value after it', () => {
  // Order is deliberate: a clipped announcement should lose the number, not
  // the name of the knob that moved.
  assert.equal(describeChange(knob, { value: 42 }), 'Reverb mix, 42');
});

test('a change says the new value, not the old one', () => {
  assert.equal(describeChange(knob, { value: 90, from: 10 }), 'Reverb mix, 90');
});

test('settling on the value it already had announces nothing', () => {
  assert.equal(describeChange(knob, { value: 50, from: 50 }), null);
});

test('a switch that re-settles on the same state is not re-announced', () => {
  assert.equal(describeChange(sw, { value: 127, from: 100 }), null);
  assert.equal(describeChange(sw, { value: 0, from: 127 }), 'Chorus, off');
});

test('an unknown controller still produces a usable sentence', () => {
  assert.equal(describeChange(undefined, { value: 7 }), 'Controller, 7');
});

test('the status line drops empty parts', () => {
  assert.equal(statusLine(['Nord Piano 6', '', null, 'Reverb mix, 90']), 'Nord Piano 6 · Reverb mix, 90');
});
