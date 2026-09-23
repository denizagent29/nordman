// Debounced parameter reporter (the owner's spec: when a controller has not
// changed for 200 ms, announce the new state — one announcement per settle,
// not per MIDI tick).
//
// A hardware knob sends a burst of CC messages while it turns. We keep the
// newest value per key and flush it after `quietMs` of silence for that key.
// Flushing is driven by tick(now) so the whole thing is testable without
// real timers.

export const QUIET_MS = 200;

// Keys that are "big" enough to be worth reading as a number in isolation.
export function createDebouncer({ quietMs = QUIET_MS, now = () => Date.now() } = {}) {
  const pending = new Map(); // key -> { value, at, meta }
  const lastFlushed = new Map(); // key -> value

  function push(key, value, meta = {}) {
    const at = now();
    const prev = pending.get(key);
    // Keep a coalesced "from" value so the announcement can say what it moved
    // from → to when the burst was long (useful for a screen reader).
    pending.set(key, {
      value,
      at,
      meta,
      from: prev ? prev.from : lastFlushed.get(key),
    });
  }

  // Returns the settled entries and removes them from the queue.
  function tick(at = now()) {
    const ready = [];
    for (const [key, entry] of pending) {
      if (at - entry.at >= quietMs) {
        pending.delete(key);
        lastFlushed.set(key, entry.value);
        ready.push({ key, ...entry });
        continue;
      }
    }
    return ready;
  }

  function flushAll() {
    const all = [];
    for (const [key, entry] of pending) {
      pending.delete(key);
      lastFlushed.set(key, entry.value);
      all.push({ key, ...entry });
    }
    return all;
  }

  function pendingKeys() {
    return [...pending.keys()];
  }

  function lastValue(key) {
    return lastFlushed.has(key) ? lastFlushed.get(key) : undefined;
  }

  function reset() {
    pending.clear();
    lastFlushed.clear();
  }

  return { push, tick, flushAll, pendingKeys, lastValue, reset };
}
