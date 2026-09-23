// UI-layer tests against a hand-built DOM. Not a browser: no MIDI, no layout.
// What is checked here is the wiring — that a control is rendered for every
// mapped control, that it sends the right bytes, and that the status line is
// the arithmetic-live region the owner actually hears.
//
// The DOM is a stub rather than a dependency: the node_modules tree would have
// to survive a platform update for no gain, and every assertion below is about
// our own code, not about jsdom's fidelity.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createStatusLine, controlWidget } from '../src/app.js';

// --- a very small DOM ------------------------------------------------------

class Node {
  constructor(tag) {
    this.tagName = tag ? tag.toUpperCase() : '';
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.textContent = '';
    this.value = '';
    this.parent = null;
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] ?? null; }
  append(...nodes) { for (const n of nodes) { if (n) { n.parent = this; this.children.push(n); } } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatch(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, ...event }); }
  // Depth-first search by tag, which is all the assertions need.
  find(tag) {
    if (this.tagName === tag.toUpperCase()) return this;
    for (const c of this.children) { const hit = c.find(tag); if (hit) return hit; }
    return null;
  }
  findAll(tag, out = []) {
    if (this.tagName === tag.toUpperCase()) out.push(this);
    for (const c of this.children) c.findAll(tag, out);
    return out;
  }
  get labels() { return this.children.filter((c) => c.tagName === 'LABEL'); }
}

globalThis.document = {
  createElement: (tag) => new Node(tag),
  createDocumentFragment: () => new Node('#fragment'),
};

// ---------------------------------------------------------------------------

test('every label is tied to its input, or the control is unreachable', () => {
  const def = { key: 'reverbMix', name: 'Reverb mix', kind: 'range', cc: 19 };
  const widget = controlWidget(def, { onSend: () => {} });
  const [label] = widget.labels;
  const input = widget.find('input');
  assert.ok(label, 'the control has a label');
  assert.equal(label.getAttribute('for'), input.getAttribute('id'));
  assert.equal(label.textContent, 'Reverb mix');
});

test('a range slider sends on change, not on every pointer twitch', () => {
  const sent = [];
  const def = { key: 'reverbMix', name: 'Reverb mix', kind: 'range', cc: 19 };
  const widget = controlWidget(def, { onSend: (d, v) => sent.push([d.key, v]) });
  const input = widget.find('input');
  input.value = '90';
  input.dispatch('input');
  assert.deepEqual(sent, [], 'dragging is not sending');
  input.dispatch('change');
  assert.deepEqual(sent, [['reverbMix', 90]]);
});

test('a bipolar knob starts at centre, an ordinary one at zero', () => {
  const bipolar = controlWidget({ key: 'eq', name: 'EQ', kind: 'bipolar', cc: 18 }, { onSend: () => {} });
  const plain = controlWidget({ key: 'mix', name: 'Mix', kind: 'range', cc: 19 }, { onSend: () => {} });
  assert.equal(bipolar.find('input').getAttribute('value'), 64);
  assert.equal(plain.find('input').getAttribute('value'), 0);
});

test('a switch sends 127 and 0, never a boolean', () => {
  const sent = [];
  const def = { key: 'reverbOn', name: 'Reverb enable', kind: 'switch', cc: 17 };
  const widget = controlWidget(def, { onSend: (d, v) => sent.push(v) });
  const box = widget.find('input');
  box.checked = true;
  box.dispatch('change');
  box.checked = false;
  box.dispatch('change');
  assert.deepEqual(sent, [127, 0]);
});

test('an enum with a known table renders a select of its labels', () => {
  const sent = [];
  const def = { key: 'reverbType', name: 'Reverb type', kind: 'enum', cc: 19,
    values: { 0: 'Room', 1: 'Stage', 2: 'Hall' } };
  const widget = controlWidget(def, { onSend: (d, v) => sent.push(v) });
  const select = widget.find('select');
  assert.ok(select, 'a known enum is a select');
  assert.equal(select.children.length, 3);
  assert.equal(select.children[2].textContent, 'Hall');
  select.value = '2';
  select.dispatch('change');
  assert.deepEqual(sent, [2], 'a select sends a number, not a string');
});

test('an enum without a value table still gets a slider and says why', () => {
  const def = { key: 'ampType', name: 'Amp type', kind: 'enum', cc: 44 };
  const widget = controlWidget(def, { onSend: () => {} });
  assert.ok(widget.find('input'), 'still operable');
  assert.equal(widget.find('select'), null);
  const hint = widget.children.find((c) => c.getAttribute('class') === 'hint');
  assert.match(hint.textContent, /capture/i, 'and it points at the log');
});

test('a receive-only control is disabled and says that it receives', () => {
  const def = { key: 'pedal', name: 'Synth vibrato pedal', kind: 'switch', cc: 15,
    receiveOnly: true, sharedWith: 'organPreset' };
  const widget = controlWidget(def, { onSend: () => {} });
  const input = widget.find('input');
  assert.ok(input.getAttribute('disabled') !== null, 'not operable — it would be a lie');
  assert.match(widget.labels[0].textContent, /receives only/);
});

// ---------------------------------------------------------------------------
// The status line
// ---------------------------------------------------------------------------

test('the status line is a polite live region, never assertive', () => {
  // The element is built in index.html; this asserts the module contract that
  // the page relies on, so a regression to assertive fails here too.
  const html = readIndex();
  assert.match(html, /id="status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /aria-live="assertive"/);
});

test('the status line keeps a short history of what was said', () => {
  const node = new Node('div');
  const line = createStatusLine(node);
  line.say('Volume, 90');
  line.say('Reverb mix, 42');
  assert.equal(node.textContent, 'Reverb mix, 42');
  assert.deepEqual(line.history, ['Volume, 90', 'Reverb mix, 42']);
});

test('the same sentence twice is nudged, so NVDA does not stay silent', () => {
  // A live region only announces on change; repeating a value must not become
  // a mute button.
  const node = new Node('div');
  const line = createStatusLine(node);
  line.say('Volume, 90');
  line.say('Volume, 90');
  assert.notEqual(node.textContent, 'Volume, 90');
  assert.equal(node.textContent.replace(/​/g, ''), 'Volume, 90');
});

test('an empty announcement does not wipe the status line', () => {
  const node = new Node('div');
  const line = createStatusLine(node);
  line.say('Volume, 90');
  line.say('');
  line.say(null);
  assert.equal(node.textContent, 'Volume, 90');
  assert.deepEqual(line.history, ['Volume, 90']);
});

test('the status history is bounded, so a long session cannot grow forever', () => {
  const node = new Node('div');
  const line = createStatusLine(node);
  for (let i = 0; i < 80; i++) line.say(`Knob ${i}, ${i}`);
  assert.equal(line.history.length, 50);
  assert.equal(line.history.at(-1), 'Knob 79, 79');
});

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

test('the panel is a toolbar, which is what feeds NVDA forms mode', () => {
  const html = readIndex();
  assert.match(html, /id="panel" role="toolbar"/);
});

test('every element the app queries by id exists in the page', () => {
  const html = readIndex();
  for (const id of ['status', 'log', 'model', 'input-port', 'output-port', 'panel', 'panel-title']) {
    assert.match(html, new RegExp(`id="${id}"`), `the page has #${id}`);
  }
});

function readIndex() {
  return readFileSync(new URL('../index.html', import.meta.url), 'utf8');
}
