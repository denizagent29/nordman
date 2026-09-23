// Nord Piano 6 — MIDI controller map.
//
// Source: Nord Piano 6 User Manual, Appendix II "MIDI Controller List"
// (v1.1x, English, p. 34) plus the MIDI / NRPN chapters (pp. 26–30).
// Transcribed by hand; do NOT reuse the Piano 5 map — roughly thirty CC
// numbers changed meaning between the two models (33, 116, 117, 118, …), so a
// Piano 5 template silently mis-maps and the screen reader would then lie
// confidently about what a knob does, which is worse than saying nothing.
//
// `kind` drives how a value is spoken (see src/announce.js):
//   range    — plain 0..127 number
//   switch   — on/off, threshold at 64
//   enum     — a named choice; `values` is known only where the manual
//              documents the order. Clavia publishes CC numbers and ranges
//              but NOT the value→meaning table for enums, so most enums are
//              left without `values` until the owner captures them from the
//              instrument with the log/learn mode.
//   bipolar  — centred on 64
//
// `group` is what the control panel uses to build its sections.

export const NORD_PIANO_6 = {
  id: 'nord-piano-6',
  name: 'Nord Piano 6',
  programs: {
    bankMsb: { program: 0, live: 1 },
    bankLsb: { program: 0, live: 0 },
    programChange: { min: 1, max: 108 },
    liveProgramChange: { min: 1, max: 6 },
    note: 'One MIDI program bank is three banks of 36 programs, numbered 1–108. '
      + 'This differs from the Piano 5 / Nord Grand scheme (MSB 0/3/4/6, PC 0–24).',
  },
  groups: [
    { id: 'global', name: 'Global' },
    { id: 'piano', name: 'Piano' },
    { id: 'synth', name: 'Sample Synth' },
    { id: 'mod1', name: 'Mod 1' },
    { id: 'mod2', name: 'Mod 2' },
    { id: 'eq', name: 'Equalizer' },
    { id: 'amp', name: 'Amp' },
    { id: 'comp', name: 'Compressor' },
    { id: 'delay', name: 'Delay' },
    { id: 'reverb', name: 'Reverb' },
  ],
  controls: [
    // --- Global and pedals -------------------------------------------------
    { cc: 7, key: 'volume', group: 'global', name: 'Volume', kind: 'range' },
    { cc: 10, key: 'pan', group: 'global', name: 'Pan', kind: 'bipolar' },
    { cc: 64, key: 'sustain', group: 'global', name: 'Sustain pedal', kind: 'switch', receiveOnly: true },
    { cc: 66, key: 'sostenuto', group: 'global', name: 'Sostenuto pedal', kind: 'switch', receiveOnly: true },
    { cc: 67, key: 'soft', group: 'global', name: 'Soft pedal', kind: 'switch', receiveOnly: true },
    { cc: 11, key: 'expression', group: 'global', name: 'Expression pedal', kind: 'range', receiveOnly: true },
    { cc: 31, key: 'fxFocus', group: 'global', name: 'Effects focus', kind: 'range' },
    { cc: 75, key: 'fxGroupPiano', group: 'global', name: 'Effects group, Piano', kind: 'range' },
    { cc: 76, key: 'fxGroupSynth', group: 'global', name: 'Effects group, Synth', kind: 'range' },

    // --- Piano section -----------------------------------------------------
    { cc: 72, key: 'pianoLayerEnable', group: 'piano', name: 'Piano layer enable', kind: 'switch' },
    { cc: 109, key: 'pianoLayerFocus', group: 'piano', name: 'Piano layer focus', kind: 'range' },
    { cc: 34, key: 'pianoLayerALevel', group: 'piano', name: 'Piano layer A level', kind: 'range' },
    { cc: 56, key: 'pianoLayerBLevel', group: 'piano', name: 'Piano layer B level', kind: 'range' },
    { cc: 35, key: 'pianoOctaveShift', group: 'piano', name: 'Piano octave shift', kind: 'bipolar' },
    { cc: 36, key: 'pianoSustainPedal', group: 'piano', name: 'Piano sustain pedal', kind: 'switch', receiveOnly: true },
    { cc: 37, key: 'pianoVolumePedal', group: 'piano', name: 'Piano volume pedal', kind: 'range', receiveOnly: true },
    { cc: 27, key: 'pianoTimbre', group: 'piano', name: 'Piano timbre', kind: 'range' },
    { cc: 24, key: 'pianoKbTouch', group: 'piano', name: 'Piano keyboard touch', kind: 'enum' },
    { cc: 23, key: 'pianoPedalNoise', group: 'piano', name: 'Piano pedal noise', kind: 'range' },
    { cc: 25, key: 'pianoUnison', group: 'piano', name: 'Piano unison', kind: 'range' },
    { cc: 26, key: 'pianoDynComp', group: 'piano', name: 'Piano dynamic compression', kind: 'range' },
    { nrpn: [2, 33], key: 'pianoSelect', group: 'piano', name: 'Piano select', kind: 'range' },

    // --- Sample Synth section ---------------------------------------------
    { cc: 61, key: 'synthLayerEnable', group: 'synth', name: 'Synth layer enable', kind: 'switch' },
    { cc: 115, key: 'synthLayerFocus', group: 'synth', name: 'Synth layer focus', kind: 'range' },
    { cc: 43, key: 'synthLayerALevel', group: 'synth', name: 'Synth layer A level', kind: 'range' },
    { cc: 57, key: 'synthLayerBLevel', group: 'synth', name: 'Synth layer B level', kind: 'range' },
    { cc: 44, key: 'synthOctaveShift', group: 'synth', name: 'Synth octave shift', kind: 'bipolar' },
    { cc: 42, key: 'synthSustainPedal', group: 'synth', name: 'Synth sustain pedal', kind: 'switch', receiveOnly: true },
    { cc: 47, key: 'synthVolumePedal', group: 'synth', name: 'Synth volume pedal', kind: 'range', receiveOnly: true },
    { cc: 50, key: 'synthVibratoMode', group: 'synth', name: 'Synth vibrato mode', kind: 'enum' },
    { cc: 45, key: 'synthVibratoRate', group: 'synth', name: 'Synth vibrato rate', kind: 'range' },
    { cc: 46, key: 'synthVibratoAmount', group: 'synth', name: 'Synth vibrato amount', kind: 'range' },
    { cc: 51, key: 'synthVibratoDelay', group: 'synth', name: 'Synth vibrato delay', kind: 'range' },
    { cc: 16, key: 'synthVibButtonActivate', group: 'synth', name: 'Synth vibrato button activate', kind: 'switch' },
    { cc: 49, key: 'synthVibButtonEnable', group: 'synth', name: 'Synth vibrato button enable', kind: 'switch' },
    { cc: 52, key: 'synthVoiceMode', group: 'synth', name: 'Synth voice mode', kind: 'enum' },
    { cc: 48, key: 'synthGlideRate', group: 'synth', name: 'Synth glide rate', kind: 'range' },
    { cc: 53, key: 'synthUnison', group: 'synth', name: 'Synth unison', kind: 'range' },
    { cc: 68, key: 'synthAttack', group: 'synth', name: 'Synth attack', kind: 'range' },
    { cc: 69, key: 'synthDecaySustain', group: 'synth', name: 'Synth decay/sustain', kind: 'range' },
    { cc: 71, key: 'synthRelease', group: 'synth', name: 'Synth release', kind: 'range' },
    { cc: 54, key: 'synthDynamics', group: 'synth', name: 'Synth dynamics', kind: 'range' },
    { nrpn: [3, 4], key: 'synthSampleSelect', group: 'synth', name: 'Sample select', kind: 'range' },

    // --- Mod 1 / Mod 2 (per-layer effects: a Piano 6 architecture change) ---
    { cc: 79, key: 'mod1Enable', group: 'mod1', name: 'Mod 1 enable', kind: 'switch' },
    { cc: 80, key: 'mod1Type', group: 'mod1', name: 'Mod 1 type', kind: 'enum' },
    { cc: 85, key: 'mod1Amount', group: 'mod1', name: 'Mod 1 amount', kind: 'range' },
    { cc: 86, key: 'mod1Rate', group: 'mod1', name: 'Mod 1 rate', kind: 'range' },
    { cc: 81, key: 'mod1CtrlPed', group: 'mod1', name: 'Mod 1 control pedal', kind: 'range' },
    { cc: 118, key: 'mod2Enable', group: 'mod2', name: 'Mod 2 enable', kind: 'switch' },
    { cc: 83, key: 'mod2Type', group: 'mod2', name: 'Mod 2 type', kind: 'enum' },
    { cc: 89, key: 'mod2Amount', group: 'mod2', name: 'Mod 2 amount', kind: 'range' },
    { cc: 90, key: 'mod2Rate', group: 'mod2', name: 'Mod 2 rate', kind: 'range' },
    { cc: 84, key: 'mod2Mono', group: 'mod2', name: 'Mod 2 mono', kind: 'switch' },

    // --- Equalizer ---------------------------------------------------------
    { cc: 105, key: 'eqEnable', group: 'eq', name: 'Equalizer enable', kind: 'switch' },
    { cc: 102, key: 'eqBassGain', group: 'eq', name: 'EQ bass gain', kind: 'bipolar' },
    { cc: 103, key: 'eqMidGain', group: 'eq', name: 'EQ mid gain', kind: 'bipolar' },
    { cc: 107, key: 'eqMidFreq', group: 'eq', name: 'EQ mid frequency', kind: 'range' },
    { cc: 104, key: 'eqTrebleGain', group: 'eq', name: 'EQ treble gain', kind: 'bipolar' },
    { cc: 33, key: 'eqGlobal', group: 'eq', name: 'Equalizer global', kind: 'switch' },

    // --- Amp ---------------------------------------------------------------
    { cc: 108, key: 'ampEnable', group: 'amp', name: 'Amp enable', kind: 'switch' },
    { cc: 110, key: 'ampType', group: 'amp', name: 'Amp type', kind: 'enum' },
    { cc: 106, key: 'ampDrive', group: 'amp', name: 'Amp drive', kind: 'range' },
    { cc: 119, key: 'ampAlternateTone', group: 'amp', name: 'Amp alternate tone', kind: 'switch' },

    // --- Compressor (a separate unit on the Piano 6) ------------------------
    { cc: 116, key: 'compEnable', group: 'comp', name: 'Compressor enable', kind: 'switch' },
    { cc: 117, key: 'compAmount', group: 'comp', name: 'Compressor amount', kind: 'range' },
    { cc: 28, key: 'compGlobal', group: 'comp', name: 'Compressor global', kind: 'switch' },

    // --- Delay -------------------------------------------------------------
    { cc: 92, key: 'delayEnable', group: 'delay', name: 'Delay enable', kind: 'switch' },
    { cc: 93, key: 'delayDryWet', group: 'delay', name: 'Delay dry/wet', kind: 'range' },
    { cc: 94, key: 'delayRate', group: 'delay', name: 'Delay rate', kind: 'range' },
    { cc: 95, key: 'delayFeedback', group: 'delay', name: 'Delay feedback', kind: 'range' },
    { cc: 91, key: 'delayPingPong', group: 'delay', name: 'Delay ping pong', kind: 'switch' },
    { cc: 88, key: 'delayFilterType', group: 'delay', name: 'Delay filter type', kind: 'enum' },
    { cc: 87, key: 'delayFlam', group: 'delay', name: 'Delay flam', kind: 'range' },
    { cc: 29, key: 'delayGlobal', group: 'delay', name: 'Delay global', kind: 'switch' },

    // --- Reverb ------------------------------------------------------------
    { cc: 17, key: 'reverbEnable', group: 'reverb', name: 'Reverb enable', kind: 'switch' },
    { cc: 19, key: 'reverbType', group: 'reverb', name: 'Reverb type', kind: 'enum' },
    { cc: 113, key: 'reverbDryWet', group: 'reverb', name: 'Reverb dry/wet', kind: 'range' },
    { cc: 18, key: 'reverbBrightDark', group: 'reverb', name: 'Reverb bright/dark', kind: 'bipolar' },
    { cc: 21, key: 'reverbChorale', group: 'reverb', name: 'Reverb chorale', kind: 'range' },
    { cc: 20, key: 'reverbPreDelay', group: 'reverb', name: 'Reverb pre-delay', kind: 'range' },
    { cc: 112, key: 'reverbLayerSendEnable', group: 'reverb', name: 'Reverb layer send enable', kind: 'switch' },
  ],
};

// Removed on the Piano 6 relative to the Piano 5 — kept as an explicit list so
// that a Piano 5 template imported by mistake is caught rather than trusted.
export const NORD_PIANO_6_REMOVED_VS_5 = {
  5: 'KB split key',
  6: 'KB split cross-fade',
  9: 'Transpose on/off',
  52: 'Piano acoustics (52 is now Synth voice mode)',
  54: 'Piano layer detune (54 is now Synth dynamics)',
  55: 'Piano KB split',
  65: 'Sample synth timbre',
  74: 'Sample synth vibrato',
  77: 'Sample synth KB split',
  84: 'Effects source (84 is now Mod 2 mono)',
  88: 'Effects source (88 is now Delay filter type)',
  92: 'Effects source (92 is now Delay enable)',
  106: 'EQ source (106 is now Amp drive)',
  111: 'Reverb chorale (old number)',
  115: 'Reverb type (old number)',
  116: 'Reverb enable (116 is now Compressor enable)',
  119: 'Amp source (119 is now Amp alternate tone)',
};
