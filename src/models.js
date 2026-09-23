// Model detection for Nord instruments over Web MIDI.
//
// Three independent signals, weakest to strongest:
//   1. MIDI port name ("Nord Stage 4", "Nord Piano 6", ...) — always available,
//      never authoritative (users rename ports, drivers mangle names).
//   2. Universal SysEx Device Identity Reply — authoritative when the device
//      answers our request.
//   3. The user's explicit choice in the UI — runs when 1 and 2 disagree or
//      come up empty (Stage 4 and Piano 6 both exist as A/B revisions and the
//      identity family bytes are not fully documented; the owner's instrument
//      is the ground truth we cannot synthesise).
//
// Detection returns a model *entry*; the caller picks the CC map from it.

export const CLAVIA_MANUFACTURER = [0x00, 0x33, 0x29];

export const MODELS = [
  {
    id: 'nord-stage-4',
    name: 'Nord Stage 4',
    portPatterns: [/stage\s*4/i, /nord\s*stage\s*4/i, /ns4/i],
    // Family/member codes are only used when we actually saw an identity reply
    // from a Clavia device; left null until confirmed against hardware.
    identity: null,
  },
  {
    id: 'nord-piano-6',
    name: 'Nord Piano 6',
    portPatterns: [/piano\s*6/i, /nord\s*piano\s*6/i, /np6/i],
    identity: null,
  },
  {
    id: 'nord-stage-3',
    name: 'Nord Stage 3',
    portPatterns: [/stage\s*3/i, /ns3/i],
    identity: null,
    legacy: true,
  },
  {
    id: 'nord-piano-5',
    name: 'Nord Piano 5',
    portPatterns: [/piano\s*5/i, /np5/i],
    identity: null,
    legacy: true,
  },
];

export const UNKNOWN_MODEL = {
  id: 'unknown',
  name: 'Unknown MIDI device',
  portPatterns: [],
  identity: null,
};

export function modelById(id) {
  return MODELS.find((m) => m.id === id) || null;
}

// Match a MIDI port name against the catalogue. Returns the model entry or
// null — never UNKNOWN_MODEL, so callers can distinguish "no guess" from
// "deliberately unrecognised".
export function detectByPortName(name) {
  if (!name) return null;
  for (const model of MODELS) {
    if (model.portPatterns.some((re) => re.test(name))) return model;
  }
  return null;
}

// Match a parsed identity reply. Only Clavia manufacturers are considered;
// anything else is rejected so a random USB device cannot masquerade as a Nord.
export function detectByIdentity(identity) {
  if (!identity) return null;
  const [m0, m1, m2] = identity.manufacturer;
  if (m0 !== CLAVIA_MANUFACTURER[0] || m1 !== CLAVIA_MANUFACTURER[1] || m2 !== CLAVIA_MANUFACTURER[2]) {
    return null;
  }
  for (const model of MODELS) {
    if (!model.identity) continue;
    if (model.identity.family === identity.family && model.identity.member === identity.member) {
      return model;
    }
  }
  return null;
}

// Combine every signal we have into one decision the UI can act on.
//   signals = { portName, identity, chosenId }
export function resolveModel({ portName, identity, chosenId } = {}) {
  const byName = detectByPortName(portName);
  const byIdentity = detectByIdentity(identity);
  const chosen = chosenId ? modelById(chosenId) : null;

  if (byIdentity && chosen && byIdentity.id !== chosen.id) {
    return {
      model: chosen,
      source: 'user',
      conflict: { detected: byIdentity, chosen },
      confident: false,
    };
  }
  if (byIdentity) return { model: byIdentity, source: 'identity', confident: true };
  if (byName && chosen && byName.id !== chosen.id) {
    return {
      model: chosen,
      source: 'user',
      conflict: { detected: byName, chosen },
      confident: false,
    };
  }
  if (chosen) return { model: chosen, source: 'user', confident: !!byName };
  if (byName) return { model: byName, source: 'port-name', confident: false };
  return { model: UNKNOWN_MODEL, source: 'none', confident: false };
}
