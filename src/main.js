// The page entry point. Everything here is DOM-adjacent; the logic it drives
// lives in app.js and below.
//
// Two rules the owner asked for and this file has to honour:
//   - "logs easy to copy" — the capture is a real textarea, selectable and
//     copyable with the keyboard, plus a copy button and a file download. A
//     textarea rather than a debug <pre>, because a blind user copies with the
//     ordinary selection commands and those need a text control.
//   - "or you get them directly" — the download button produces a plain .txt
//     that can be forwarded in this chat with no re-typing.

import { createApp } from './app.js';

const $ = (s) => document.querySelector(s);

// The instrument's own words, at the top of every capture, so a log sent to me
// is self-describing — I do not have to ask which model and map produced it.
// The log module writes its own one-line header; this sits above it.
function header(session) {
  return [
    `# Nord manager capture`,
    `# model: ${session.modelName || 'unknown'}`,
    `# map:   ${session.map ? session.map.id : 'none'}`,
    `# Lines starting with "#" are program output, not MIDI.`,
    '',
  ].join('\n');
}

function renderLog(session, node) {
  const text = `${header(session)}\n${session.log.toText()}`;
  // Preserve the scroll position: rewriting the whole value on every burst
  // would throw the caret back to the top mid-read.
  const atEnd = node.selectionStart === node.value.length;
  const scroll = node.scrollTop;
  if (node.value !== text) node.value = text;
  if (atEnd) node.selectionStart = node.selectionEnd = node.value.length;
  node.scrollTop = scroll;
  return text;
}

function download(text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `nord-capture-${stamp}.txt`;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoking later, not immediately: Firefox cancels a download whose blob URL
  // is already gone by the time it starts reading.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function main() {
  const app = createApp();
  const logNode = $('#log');
  const summaryNode = $('#log-summary');

  // The only live region on this page is the status line. The capture count is
  // ordinary text that changes constantly — it counts every note and every
  // twitch — so it must never announce: as a live region it spoke over the
  // status line it sits under, permanently. It is skipped here when unchanged
  // as well, so the DOM is not rewritten twice a second for nothing.
  let summaryText = null;
  const refresh = () => {
    renderLog(app.session, logNode);
    const text = app.session.log.summaryText;
    if (text !== summaryText) {
      summaryText = text;
      summaryNode.textContent = text;
    }
  };

  // The capture updates on a slow timer rather than per message: a knob burst
  // arrives faster than it can be drawn, and mid-burst redraws only queue up.
  setInterval(refresh, 500);

  $('#connect').addEventListener('click', async () => {
    const button = $('#connect');
    button.disabled = true;
    try {
      const ok = await app.connect();
      button.textContent = ok ? 'Connected' : 'Retry';
      if (!ok) button.disabled = false;
    } catch (err) {
      // Say it in the status line — the owner hears the page, and a console
      // error is a sentence nobody reads.
      app.status.say(err && err.message ? err.message : 'Could not reach the MIDI devices.');
      button.textContent = 'Retry';
      button.disabled = false;
    }
    refresh();
  });

  $('#copy-log').addEventListener('click', async () => {
    const text = renderLog(app.session, logNode);
    logNode.select();
    try {
      await navigator.clipboard.writeText(text);
      app.status.say(`Copied ${app.session.log.lines.length} events`);
    } catch {
      // Clipboard access can be refused; the textarea is already selected, so
      // the ordinary copy command still works and the owner is told so.
      app.status.say('Clipboard refused — press Control C, the text is selected');
    }
  });

  $('#download-log').addEventListener('click', () => {
    download(renderLog(app.session, logNode));
    app.status.say('Capture downloaded');
  });

  $('#clear-log').addEventListener('click', () => {
    app.session.log.clear();
    refresh();
    app.status.say('Capture cleared');
  });

  window.nordman = app;
  refresh();
}

// Not before the DOM is parsed: createApp queries elements by id.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
