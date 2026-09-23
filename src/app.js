// The page: a status line that speaks, a control panel that sends, and a
// capture pane for learn mode.
//
// Accessibility decisions, and why:
//   - The status line is `aria-live="polite"`, never assertive. An assertive
//     region interrupts whatever NVDA is reading mid-word; the owner turns
//     knobs while listening to something else, and a clipped interruption is
//     worse than a slightly late one.
//   - The panel is a `role="toolbar"`. That is the role that puts NVDA into
//     forms mode (memory: reference_nvda_focus_mode_roles) — `application`
//     does not, and without forms mode the arrow keys scroll the page instead
//     of moving between controls.
//   - Every control is a real form element: sliders are `input[type=range]`,
//     switches are `input[type=checkbox]`, choices are `select`. Native
//     elements already speak correctly and need no ARIA restatement.
//   - Controls that only *receive* (pedals) are shown but disabled, and say so
//     in their label, because a slider that silently does nothing is a lie.

import { createSession, MAPS, mapById, indexControls } from './session.js';
import { createTransport, isSupported, unsupportedReason, identityFromMessage } from './transport.js';
import { resolveModel, modelById, UNKNOWN_MODEL } from './models.js';
import { formatValue } from './announce.js';
import { NORD_PIANO_6 } from '../data/nord-piano-6.js';

const $ = (sel, root = document) => root.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

// ---------------------------------------------------------------------------
// Status line
// ---------------------------------------------------------------------------

export function createStatusLine(node) {
  let history = [];
  return {
    say(text) {
      if (!text) return;
      history.push(text);
      if (history.length > 50) history.shift();
      // Clearing before setting is not needed for polite regions, but NVDA
      // will not re-read an identical string — so an occasional repeat of the
      // same sentence is nudged with a zero-width space.
      node.textContent = node.textContent === text ? `${text}​` : text;
    },
    set(text) { this.say(text); },
    get history() { return [...history]; },
  };
}

// ---------------------------------------------------------------------------
// Control panel
// ---------------------------------------------------------------------------

// How a control is rendered, by kind. Disabled for receive-only controls.
export function controlWidget(def, { onSend }) {
  const send = (value) => onSend(def, value);

  if (def.receiveOnly) {
    const input = el('input', { type: 'range', min: 0, max: 127, value: 0, disabled: true,
      id: `c-${def.key}`, 'aria-describedby': `d-${def.key}` });
    return el('div', { class: 'ctrl disabled' }, [
      el('label', { for: `c-${def.key}`, text: `${def.name} (receives only)` }),
      input,
      el('span', { class: 'hint', id: `d-${def.key}`, text: 'The instrument controls this; nothing is sent.' }),
    ]);
  }

  if (def.kind === 'switch') {
    const input = el('input', { type: 'checkbox', id: `c-${def.key}` });
    input.addEventListener('change', () => send(input.checked ? 127 : 0));
    return el('div', { class: 'ctrl' }, [
      el('label', { for: `c-${def.key}`, text: def.name }), input,
    ]);
  }

  if (def.kind === 'enum' && def.values) {
    const select = el('select', { id: `c-${def.key}` });
    for (const [value, label] of Object.entries(def.values)) {
      select.append(el('option', { value, text: label }));
    }
    select.addEventListener('change', () => send(Number(select.value)));
    return el('div', { class: 'ctrl' }, [
      el('label', { for: `c-${def.key}`, text: def.name }), select,
    ]);
  }

  // range, bipolar, and enums whose table is not yet known: one slider.
  const input = el('input', { type: 'range', min: 0, max: 127, value: def.kind === 'bipolar' ? 64 : 0,
    id: `c-${def.key}` });
  const readout = el('span', { class: 'readout' });
  const show = (v) => { readout.textContent = formatValue(def, Number(v)); };
  input.addEventListener('input', () => show(input.value));
  input.addEventListener('change', () => send(Number(input.value)));
  show(input.value);
  const children = [el('label', { for: `c-${def.key}`, text: def.name }), input, readout];
  if (def.kind === 'enum') {
    children.push(el('span', { class: 'hint', text: 'Value labels not known yet — capture them in the log.' }));
  }
  return el('div', { class: 'ctrl' }, children);
}

export function buildPanel(map, { onSend }) {
  const byGroup = new Map();
  for (const c of map.controls) {
    if (!byGroup.has(c.group)) byGroup.set(c.group, []);
    byGroup.get(c.group).push(c);
  }
  const frag = document.createDocumentFragment();
  for (const group of map.groups) {
    const controls = byGroup.get(group.id) || [];
    if (!controls.length) continue;
    const fieldset = el('fieldset', {}, [el('legend', { text: group.name })]);
    for (const def of controls) fieldset.append(controlWidget(def, { onSend }));
    frag.append(fieldset);
  }
  return frag;
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

export function createApp(doc = document) {
  const statusNode = $('#status', doc);
  const logNode = $('#log', doc);
  const modelSelect = $('#model', doc);
  const inputSelect = $('#input-port', doc);
  const outputSelect = $('#output-port', doc);

  const status = createStatusLine(statusNode);

  const session = createSession({
    map: NORD_PIANO_6,
    modelName: NORD_PIANO_6.name,
    now: () => Date.now(),
    onAnnounce: (text) => status.say(text),
  });

  function renderPanel(map, modelName) {
    const panel = $('#panel', doc);
    panel.replaceChildren(buildPanel(map, { onSend }));
    $('#panel-title', doc).textContent = modelName;
  }

  function onSend(def, value) {
    if (def.nrpn) {
      const [msb, lsb] = def.nrpn;
      const frame = [0xb0, 99, msb, 0xb0, 98, lsb, 0xb0, 6, 0, 0xb0, 38, value & 0x7f];
      transport.send(frame);
    } else {
      transport.send([0xb0, def.cc, value & 0x7f]);
    }
    // Say it locally too: the panel is a control surface, and waiting for the
    // instrument to echo would leave a silent gap on a model that does not.
    status.say(`${def.name}, ${formatValue(def, value)}`);
  }

  let transport = null;

  function refreshPorts() {
    if (!transport) return;
    const { inputs, outputs } = transportPorts();
    inputSelect.replaceChildren(...inputs.map((p) => el('option', { value: p.id, text: p.name || p.id })));
    outputSelect.replaceChildren(...outputs.map((p) => el('option', { value: p.id, text: p.name || p.id })));
  }

  function transportPorts() {
    const access = transport && transport.access;
    if (!access) return { inputs: [], outputs: [] };
    const inputs = [], outputs = [];
    for (const p of access.inputs.values()) inputs.push({ id: p.id, name: p.name });
    for (const p of access.outputs.values()) outputs.push({ id: p.id, name: p.name });
    return { inputs, outputs };
  }

  async function connect() {
    if (!isSupported()) {
      status.say(unsupportedReason());
      return false;
    }
    transport = createTransport({
      onMessage: (data) => {
        const identity = identityFromMessage(data);
        if (identity) {
          const decision = resolveModel({ identity, chosenId: session.map && session.map.id });
          if (decision.model && decision.model.id !== session.map.id && decision.confident) {
            applyModel(decision.model.id);
            status.say(`Detected ${decision.model.name}`);
          }
        }
        session.feed(data);
      },
      onPorts: () => refreshPorts(),
      onState: (e) => {
        if (e.kind === 'input-lost') status.say('Instrument disconnected');
      },
    });
    await transport.start({});
    transport.startClock(() => session.tick());
    // Silence here is expected on both supported models — it is not evidence
    // that the device is not a Nord.
    transport.requestIdentity();
    refreshPorts();
    const inName = transport.input ? transport.input.name : 'no input';
    const outName = transport.output ? transport.output.name : 'no output';
    status.say(`Connected. In: ${inName}. Out: ${outName}.`);
    return true;
  }

  function applyModel(id) {
    const map = mapById(id);
    if (!map) return;
    const model = modelById(id) || UNKNOWN_MODEL;
    session.setMap(map, model.name);
    renderPanel(map, model.name);
    modelSelect.value = id;
  }

  if (modelSelect) {
    modelSelect.addEventListener('change', () => applyModel(modelSelect.value));
  }
  if (inputSelect) {
    inputSelect.addEventListener('change', () => {
      if (transport) { transport.pick(inputSelect.value, 'input'); transport.requestIdentity(); }
    });
  }
  if (outputSelect) {
    outputSelect.addEventListener('change', () => {
      if (transport) transport.pick(outputSelect.value, 'output');
    });
  }

  renderPanel(NORD_PIANO_6, NORD_PIANO_6.name);

  return { session, status, connect, applyModel, get transport() { return transport; }, logNode };
}

// Auto-start only in a real page, so importing this module in a test does not
// reach for the MIDI subsystem.
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__NORDMAN_TEST__) {
  const app = createApp();
  window.nordman = app;
}
