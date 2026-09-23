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
    // What CC 31 is: NOT a knob and NOT a section address. This is the only
    // row here whose meaning was checked against the instrument rather than
    // read off the manual, so it is written down as measured (capture
    // 2026-09-23): the owner turned the Piano section's focus knob while
    // watching this log, and the message came out as the constant 0 —
    // `CC 31 = 0` — with the actual focus travel carried by CC 72 alongside it
    // ("31→[0]  72→[43]"). An earlier version of this map called CC 31 an
    // effects-focus enum; that came from the manual's list and from a wrong
    // guess about a number the owner had merely seen, and it made the site
    // announce a section the instrument was not on. The manual does not
    // document a bare CC 31 at all.
    //
    // So it is mapped sendable-only: a value written into it by mistake is
    // not passed off as news. When the owner sweeps 31 across its positions
    // and reports what he hears, this becomes a real enum again.
    { cc: 31, key: 'fxFocus', group: 'global', name: 'Focus', kind: 'range',
      sendableOnly: true },
    { cc: 75, key: 'fxGroupPiano', group: 'global', name: 'Effects group, Piano', kind: 'range' },
    { cc: 76, key: 'fxGroupSynth', group: 'global', name: 'Effects group, Synth', kind: 'range' },

    // --- Piano section -----------------------------------------------------
    // The two positions of this one knob are the two piano layers, not on/off,
    // so the value is spoken as the layer: "Piano layer A enabled". A raw 0
    // reads as "off" on a switch and tells the player nothing.
    //
    // The three values are MEASURED, not inferred (capture 2026-09-23): the
    // knob is a three-position switch, and the owner's A / off / B walk came
    // out as 0 / 43 / 85 — a position knob, not a two-state button. A version
    // that read 0/1 was wrong: on the instrument the second position sends 85,
    // so it would have been announced as an unknown value.
    { cc: 72, key: 'pianoLayerEnable', group: 'piano', name: 'Piano layer',
      kind: 'enum', values: { 0: 'off', 43: 'layer A', 85: 'layer B' },
      offIsSilent: true },
    { cc: 109, key: 'pianoLayerFocus', group: 'piano', name: 'Layer edit focus', kind: 'enum',
      values: { 0: 'A', 127: 'B' } },
    { cc: 34, key: 'pianoLayerALevel', group: 'piano', name: 'Piano layer A level', kind: 'range' },
    { cc: 56, key: 'pianoLayerBLevel', group: 'piano', name: 'Piano layer B level', kind: 'range' },
    { cc: 35, key: 'pianoOctaveShift', group: 'piano', name: 'Piano octave shift', kind: 'bipolar' },
    { cc: 36, key: 'pianoSustainPedal', group: 'piano', name: 'Piano sustain pedal', kind: 'switch', receiveOnly: true },
    { cc: 37, key: 'pianoVolumePedal', group: 'piano', name: 'Piano volume pedal', kind: 'range', receiveOnly: true },
    { cc: 27, key: 'pianoTimbre', group: 'piano', name: 'Piano timbre', kind: 'range' },
    // Three positions, and the POSITIONS are measured (capture 2026-09-23): the
    // owner walked it up and back four times and the instrument sent 0 / 64 /
    // 127, coming back to 0. `enumCandidates()` calls a knob like this a
    // 'wobble', because its first value equals its last and the sweep test
    // wants a net travel — worth knowing, because this list is where a genuine
    // three-position switch is distinguished from a knob that was merely
    // nudged. The NAMES are the Nord panel's (Soft / Medium / Hard): not yet
    // confirmed by ear, so they are a hypothesis until the owner walks it.
    { cc: 24, key: 'pianoKbTouch', group: 'piano', name: 'Piano keyboard touch', kind: 'enum',
      values: { 0: 'soft', 64: 'medium', 127: 'hard' } },
    { cc: 23, key: 'pianoPedalNoise', group: 'piano', name: 'Piano pedal noise', kind: 'range' },
    { cc: 25, key: 'pianoUnison', group: 'piano', name: 'Piano unison', kind: 'range' },
    // Discrete positions, not a continuous amount — the capture shows the
    // instrument sending only 43 / 85 / 127, never anything between (and 0,
    // when the owner walked back past the bottom). A slider that can land
    // between positions is the wrong control for a switch with positions.
    // Whether these are three or four positions (is 0 a real "off"?) needs one
    // more walk; the four names are the panel's, marked as the guess they are.
    { cc: 26, key: 'pianoDynComp', group: 'piano', name: 'Piano dynamic compression', kind: 'enum',
      values: { 0: 'off', 43: 'low', 85: 'mid', 127: 'high' } },
    // The piano memory: two lines of six slots. The address the instrument
    // sends is not a picture of the sound, so the slot is what gets spoken;
    // the raw value goes into the capture for whoever maps the library.
    { nrpn: [2, 33], key: 'pianoSelect', group: 'piano', name: 'Piano select',
      kind: 'slots', slots: 12, groupSize: 6, groupLabels: ['line A', 'line B'] },

    // --- Sample Synth section ---------------------------------------------
    { cc: 61, key: 'synthLayerEnable', group: 'synth', name: 'Synth layer enable', kind: 'enum',
      values: { 0: 'Synth layer A enabled', 1: 'Synth layer B enabled' },
      offIsSilent: true },
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
    { cc: 102, key: 'eqBassGain', group: 'eq', name: 'EQ bass gain', kind: 'bipolar', unit: 'dB' },
    { cc: 103, key: 'eqMidGain', group: 'eq', name: 'EQ mid gain', kind: 'bipolar', unit: 'dB' },
    { cc: 107, key: 'eqMidFreq', group: 'eq', name: 'EQ mid frequency', kind: 'range' },
    { cc: 104, key: 'eqTrebleGain', group: 'eq', name: 'EQ treble gain', kind: 'bipolar', unit: 'dB' },
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
    // Six positions, and the positions are MEASURED (capture 2026-09-23): the
    // owner swept it through 26 / 51 / 77 / 102 / 127 and back to 0, each value
    // sent twice. The names below are the Piano 6 panel's six reverb types in
    // that order — a hypothesis, not a measurement, and the one table here
    // most worth correcting by ear, since a wrong name is worse than a number
    // the owner can look up. Until he walks it and says what he hears, treat
    // the labels as a placeholder: the map is exact about WHICH positions
    // exist and silent-but-guessing about what they are called.
    { cc: 19, key: 'reverbType', group: 'reverb', name: 'Reverb type', kind: 'enum',
      values: { 0: 'room', 26: 'stage', 51: 'hall', 77: 'cathedral', 102: 'plate', 127: 'spring' } },
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
