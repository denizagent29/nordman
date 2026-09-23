// Nord Stage 4 — MIDI controller map.
//
// Source: Nord Stage 4 User Manual, OS v1.4X, Edition L — Appendix II
// "MIDI Controller List" (pp. 66–68), §10 MIDI (p. 55), §11 MIDI menu
// (pp. 61–62). Transcribed by hand.
//
// IMPORTANT — the Stage 4 is a per-scene instrument, and all its NRPNs live in
// the documented Clavia "X:Y" notation: X is CC#99 (NRPN MSB), Y is CC#98
// (NRPN LSB), the value goes in CC#38, and CC#6 is expected to be 0. Four
// messages make one package (99, 98, 6, 38).
//
// IMPORTANT — unlike the Piano 6, the Stage 4 does NOT transmit panel moves out
// of the box: MIDI menu item 7 "Ctrl" defaults to Off. See DEVICE_NOTES.
//
// `scene` marks controls that exist once per Scene (I / II). The UI must keep
// them apart — the same parameter has two different CCs and they are not
// interchangeable.

export const NORD_STAGE_4 = {
  id: 'nord-stage-4',
  name: 'Nord Stage 4',
  programs: {
    bankMsb: 0,
    bankLsb: 32,
    note: 'Bank Select MSB 0 / LSB 32, then Program Change. Exact PC range not '
      + 'confirmed from the appendix — verify on hardware before offering a '
      + 'program browser.',
  },
  groups: [
    { id: 'global', name: 'Global' },
    { id: 'organ', name: 'Organ' },
    { id: 'piano', name: 'Piano' },
    { id: 'synth', name: 'Synth' },
    { id: 'mod1', name: 'Mod 1' },
    { id: 'mod2', name: 'Mod 2' },
    { id: 'delay', name: 'Delay' },
    { id: 'amp', name: 'Amp / EQ' },
    { id: 'rotary', name: 'Rotary' },
    { id: 'reverb', name: 'Reverb' },
    { id: 'comp', name: 'Compressor' },
  ],
  controls: [
    // --- Global ------------------------------------------------------------
    { cc: 7, key: 'volume', group: 'global', name: 'Volume, global', kind: 'range' },
    { cc: 64, key: 'sustain', group: 'global', name: 'Sustain pedal', kind: 'switch', receiveOnly: true },
    { cc: 66, key: 'sostenuto', group: 'global', name: 'Sostenuto pedal', kind: 'switch', receiveOnly: true },
    { cc: 67, key: 'soft', group: 'global', name: 'Soft pedal', kind: 'switch', receiveOnly: true },
    { cc: 11, key: 'ctrlPedal', group: 'global', name: 'Control pedal', kind: 'range', receiveOnly: true },
    { cc: 8, key: 'layerScene', group: 'global', name: 'Layer scene', kind: 'range' },
    { cc: 31, key: 'sectionFxFocus', group: 'global', name: 'Section effects focus', kind: 'range' },
    { cc: 118, key: 'sectionEdit', group: 'global', name: 'Section edit', kind: 'range' },

    // --- Organ -------------------------------------------------------------
    { cc: 13, key: 'organALevel', group: 'organ', name: 'Organ A level', kind: 'range' },
    { cc: 14, key: 'organBLevel', group: 'organ', name: 'Organ B level', kind: 'range' },
    { cc: 12, key: 'organOctaveShift', group: 'organ', name: 'Organ octave shift', kind: 'bipolar' },
    { cc: 15, key: 'organPreset', group: 'organ', name: 'Organ preset', kind: 'range' },
    { nrpn: [2, 16], key: 'organModel', group: 'organ', name: 'Organ model', kind: 'enum' },
    { scene: 1, cc: 9, key: 'organEnable1', group: 'organ', name: 'Organ enable, scene 1', kind: 'switch' },
    { scene: 2, cc: 2, key: 'organEnable2', group: 'organ', name: 'Organ enable, scene 2', kind: 'switch' },
    { scene: 1, cc: 80, key: 'organLayersEnable1', group: 'organ', name: 'Organ layers enable, scene 1', kind: 'range' },
    { scene: 2, cc: 81, key: 'organLayersEnable2', group: 'organ', name: 'Organ layers enable, scene 2', kind: 'range' },
    { scene: 1, cc: 82, key: 'organLayersFocus1', group: 'organ', name: 'Organ layers focus, scene 1', kind: 'range' },
    { scene: 2, cc: 83, key: 'organLayersFocus2', group: 'organ', name: 'Organ layers focus, scene 2', kind: 'range' },
    // Drawbars 1–9 occupy CC 16–24.
    ...Array.from({ length: 9 }, (_, i) => ({
      cc: 16 + i,
      key: `organDrawbar${i + 1}`,
      group: 'organ',
      name: `Organ drawbar ${i + 1}`,
      kind: 'range',
    })),
    { nrpn: [2, 18], key: 'organPercussionEnable', group: 'organ', name: 'Percussion enable', kind: 'switch' },
    { nrpn: [2, 19], key: 'organVibratoType', group: 'organ', name: 'Vibrato type', kind: 'enum' },
    { nrpn: [2, 20], key: 'organVibratoEnable', group: 'organ', name: 'Vibrato enable', kind: 'switch' },
    { nrpn: [2, 21], key: 'organPercussionHarmonic', group: 'organ', name: 'Percussion harmonic', kind: 'enum' },
    { nrpn: [2, 22], key: 'organPercussionSpeed', group: 'organ', name: 'Percussion speed', kind: 'enum' },
    { nrpn: [2, 23], key: 'organPercussionLevel', group: 'organ', name: 'Percussion level', kind: 'range' },

    // --- Piano -------------------------------------------------------------
    { cc: 34, key: 'pianoALevel', group: 'piano', name: 'Piano A level', kind: 'range' },
    { cc: 63, key: 'pianoBLevel', group: 'piano', name: 'Piano B level', kind: 'range' },
    { cc: 35, key: 'pianoOctaveShift', group: 'piano', name: 'Piano octave shift', kind: 'bipolar' },
    { scene: 1, cc: 33, key: 'pianoEnable1', group: 'piano', name: 'Piano enable, scene 1', kind: 'switch' },
    { scene: 2, cc: 3, key: 'pianoEnable2', group: 'piano', name: 'Piano enable, scene 2', kind: 'switch' },
    { scene: 1, cc: 72, key: 'pianoLayersEnable1', group: 'piano', name: 'Piano layers enable, scene 1', kind: 'range' },
    { scene: 2, cc: 88, key: 'pianoLayersEnable2', group: 'piano', name: 'Piano layers enable, scene 2', kind: 'range' },
    { scene: 1, cc: 109, key: 'pianoLayersFocus1', group: 'piano', name: 'Piano layers focus, scene 1', kind: 'range' },
    { scene: 2, cc: 112, key: 'pianoLayersFocus2', group: 'piano', name: 'Piano layers focus, scene 2', kind: 'range' },
    { nrpn: [2, 32], key: 'pianoType', group: 'piano', name: 'Piano type', kind: 'enum' },
    { nrpn: [2, 33], key: 'pianoModel', group: 'piano', name: 'Piano model', kind: 'enum' },
    { nrpn: [2, 34], key: 'pianoVariation', group: 'piano', name: 'Piano variation', kind: 'enum' },
    { nrpn: [2, 40], key: 'pianoUnison', group: 'piano', name: 'Piano unison', kind: 'range' },
    { nrpn: [2, 41], key: 'pianoTimbre', group: 'piano', name: 'Piano timbre', kind: 'range' },
    { nrpn: [2, 42], key: 'pianoDynComp', group: 'piano', name: 'Piano dynamic compression', kind: 'range' },
    { nrpn: [2, 43], key: 'pianoKbTouch', group: 'piano', name: 'Piano keyboard touch', kind: 'enum' },
    { nrpn: [2, 44], key: 'pianoAcoustics', group: 'piano', name: 'Piano acoustics', kind: 'range' },

    // --- Synth -------------------------------------------------------------
    { cc: 43, key: 'synthALevel', group: 'synth', name: 'Synth A level', kind: 'range' },
    { cc: 37, key: 'synthBLevel', group: 'synth', name: 'Synth B level', kind: 'range' },
    { cc: 39, key: 'synthCLevel', group: 'synth', name: 'Synth C level', kind: 'range' },
    { cc: 40, key: 'synthAPan', group: 'synth', name: 'Synth A pan', kind: 'bipolar' },
    { cc: 41, key: 'synthBPan', group: 'synth', name: 'Synth B pan', kind: 'bipolar' },
    { cc: 36, key: 'synthCPan', group: 'synth', name: 'Synth C pan', kind: 'bipolar' },
    { cc: 44, key: 'synthOctaveShift', group: 'synth', name: 'Synth octave shift', kind: 'bipolar' },
    { cc: 48, key: 'synthGlideRate', group: 'synth', name: 'Synth glide rate', kind: 'range' },
    { cc: 45, key: 'synthVibratoAmount', group: 'synth', name: 'Synth vibrato amount', kind: 'range' },
    { cc: 46, key: 'synthVibratoRate', group: 'synth', name: 'Synth vibrato rate', kind: 'range' },
    { cc: 15, key: 'synthVibratoPedal', group: 'synth', name: 'Synth vibrato pedal', kind: 'switch', receiveOnly: true },
    { cc: 52, key: 'synthOscAttack', group: 'synth', name: 'Osc envelope attack', kind: 'range' },
    { cc: 53, key: 'synthOscDecay', group: 'synth', name: 'Osc envelope decay', kind: 'range' },
    { cc: 57, key: 'synthOscRelease', group: 'synth', name: 'Osc envelope release', kind: 'range' },
    { cc: 56, key: 'synthOscCtrl', group: 'synth', name: 'Oscillator control', kind: 'range' },
    { cc: 55, key: 'synthOscPitchCoarse', group: 'synth', name: 'Oscillator pitch coarse', kind: 'bipolar' },
    { cc: 47, key: 'synthOscPitchFine', group: 'synth', name: 'Oscillator pitch fine', kind: 'bipolar' },
    { cc: 59, key: 'synthFilterFreq', group: 'synth', name: 'Filter frequency', kind: 'range' },
    { cc: 60, key: 'synthFilterResonance', group: 'synth', name: 'Filter resonance', kind: 'range' },
    { cc: 25, key: 'synthFilterGroup', group: 'synth', name: 'Filter group', kind: 'range' },
    { cc: 49, key: 'synthFilterEnvAttack', group: 'synth', name: 'Filter envelope attack', kind: 'range' },
    { cc: 50, key: 'synthFilterEnvDecay', group: 'synth', name: 'Filter envelope decay', kind: 'range' },
    { cc: 51, key: 'synthFilterEnvRelease', group: 'synth', name: 'Filter envelope release', kind: 'range' },
    { cc: 73, key: 'synthFilterEnvAmount', group: 'synth', name: 'Filter envelope amount', kind: 'range' },
    { cc: 68, key: 'synthAmpEnvAttack', group: 'synth', name: 'Amp envelope attack', kind: 'range' },
    { cc: 69, key: 'synthAmpEnvDecay', group: 'synth', name: 'Amp envelope decay', kind: 'range' },
    { cc: 71, key: 'synthAmpEnvRelease', group: 'synth', name: 'Amp envelope release', kind: 'range' },
    { cc: 74, key: 'synthArpRate', group: 'synth', name: 'Arpeggiator rate', kind: 'range' },
    { cc: 76, key: 'synthArpRange', group: 'synth', name: 'Arpeggiator range', kind: 'range' },
    { cc: 77, key: 'synthArpRun', group: 'synth', name: 'Arpeggiator run', kind: 'switch' },
    { cc: 79, key: 'synthLfoRate', group: 'synth', name: 'LFO rate', kind: 'range' },
    { cc: 54, key: 'synthLfoAmount', group: 'synth', name: 'LFO amount', kind: 'range' },
    { scene: 1, cc: 42, key: 'synthEnable1', group: 'synth', name: 'Synth enable, scene 1', kind: 'switch' },
    { scene: 2, cc: 5, key: 'synthEnable2', group: 'synth', name: 'Synth enable, scene 2', kind: 'switch' },
    { scene: 1, cc: 61, key: 'synthLayersEnable1', group: 'synth', name: 'Synth layers enable, scene 1', kind: 'range' },
    { scene: 2, cc: 75, key: 'synthLayersEnable2', group: 'synth', name: 'Synth layers enable, scene 2', kind: 'range' },
    { scene: 1, cc: 115, key: 'synthLayersFocus1', group: 'synth', name: 'Synth layers focus, scene 1', kind: 'range' },
    { scene: 2, cc: 119, key: 'synthLayersFocus2', group: 'synth', name: 'Synth layers focus, scene 2', kind: 'range' },
    // NRPN-resident synth parameters the manual lists in the 3:x space.
    { nrpn: [3, 16], key: 'synthVoiceMode', group: 'synth', name: 'Synth voice mode', kind: 'enum' },
    { nrpn: [3, 17], key: 'synthVoicePriority', group: 'synth', name: 'Synth voice priority', kind: 'enum' },
    { nrpn: [3, 18], key: 'synthUnison', group: 'synth', name: 'Synth unison', kind: 'range' },
    { nrpn: [3, 2], key: 'synthWaveform', group: 'synth', name: 'Synth waveform', kind: 'enum' },
    { nrpn: [3, 8], key: 'synthSampleBright', group: 'synth', name: 'Sample brightness', kind: 'range' },
    { nrpn: [3, 4], key: 'synthSampleSelect', group: 'synth', name: 'Sample select', kind: 'range' },
    { nrpn: [3, 19], key: 'synthVibratoMode', group: 'synth', name: 'Synth vibrato mode', kind: 'enum' },
    { nrpn: [3, 20], key: 'synthVibratoDelay', group: 'synth', name: 'Synth vibrato delay time', kind: 'range' },
    { nrpn: [3, 33], key: 'synthOscEnvToPitch', group: 'synth', name: 'Osc envelope to pitch', kind: 'range' },
    { nrpn: [3, 32], key: 'synthOscEnvVelocity', group: 'synth', name: 'Osc envelope velocity', kind: 'range' },
    { nrpn: [3, 49], key: 'synthFilterDrive', group: 'synth', name: 'Filter drive', kind: 'range' },
    { nrpn: [3, 50], key: 'synthFilterKbdTrack', group: 'synth', name: 'Filter keyboard tracking', kind: 'range' },
    { nrpn: [3, 51], key: 'synthFilterType', group: 'synth', name: 'Filter type', kind: 'enum' },
    { nrpn: [3, 64], key: 'synthFilterEnvVelocity', group: 'synth', name: 'Filter envelope velocity', kind: 'range' },
    { nrpn: [3, 56], key: 'synthAmpEnvVelocity', group: 'synth', name: 'Amp envelope velocity', kind: 'range' },
    { nrpn: [3, 72], key: 'synthArpMode', group: 'synth', name: 'Arpeggiator mode', kind: 'enum' },
    { nrpn: [3, 73], key: 'synthArpPatternOn', group: 'synth', name: 'Arpeggiator pattern on', kind: 'switch' },
    { nrpn: [3, 74], key: 'synthArpDirection', group: 'synth', name: 'Arpeggiator direction', kind: 'enum' },
    { nrpn: [3, 75], key: 'synthArpZigZag', group: 'synth', name: 'Arpeggiator zig zag', kind: 'enum' },
    { nrpn: [3, 80], key: 'synthLfoWaveform', group: 'synth', name: 'LFO waveform', kind: 'enum' },
    { nrpn: [3, 81], key: 'synthLfoDestination', group: 'synth', name: 'LFO destination', kind: 'enum' },

    // --- Mod 1 / Mod 2 -----------------------------------------------------
    { nrpn: [2, 64], key: 'mod1Enable', group: 'mod1', name: 'Mod 1 enable', kind: 'switch' },
    { nrpn: [2, 65], key: 'mod1Type', group: 'mod1', name: 'Mod 1 type', kind: 'enum' },
    { cc: 85, key: 'mod1Amount', group: 'mod1', name: 'Mod 1 amount', kind: 'range' },
    { cc: 86, key: 'mod1Rate', group: 'mod1', name: 'Mod 1 rate', kind: 'range' },
    { cc: 87, key: 'mod1PumpPedal', group: 'mod1', name: 'Mod 1 pump pedal', kind: 'range' },
    { nrpn: [2, 72], key: 'mod2Enable', group: 'mod2', name: 'Mod 2 enable', kind: 'switch' },
    { nrpn: [2, 73], key: 'mod2Type', group: 'mod2', name: 'Mod 2 type', kind: 'enum' },
    { cc: 89, key: 'mod2Amount', group: 'mod2', name: 'Mod 2 amount', kind: 'range' },
    { cc: 90, key: 'mod2Rate', group: 'mod2', name: 'Mod 2 rate', kind: 'range' },

    // --- Delay -------------------------------------------------------------
    { nrpn: [2, 88], key: 'delayEnable', group: 'delay', name: 'Delay enable', kind: 'switch' },
    { cc: 93, key: 'delayDryWet', group: 'delay', name: 'Delay dry/wet', kind: 'range' },
    { cc: 94, key: 'delayTempo', group: 'delay', name: 'Delay tempo', kind: 'range' },
    { cc: 95, key: 'delayFeedback', group: 'delay', name: 'Delay feedback', kind: 'range' },
    { nrpn: [2, 89], key: 'delayAnalog', group: 'delay', name: 'Delay analog', kind: 'range' },
    { nrpn: [2, 91], key: 'delayPingPong', group: 'delay', name: 'Delay ping pong', kind: 'switch' },
    { nrpn: [2, 92], key: 'delayFilterType', group: 'delay', name: 'Delay filter type', kind: 'enum' },
    { cc: 29, key: 'delayGlobal', group: 'delay', name: 'Delay global', kind: 'switch' },

    // --- Amp / EQ ----------------------------------------------------------
    { nrpn: [2, 80], key: 'ampEnable', group: 'amp', name: 'Amp enable', kind: 'switch' },
    { nrpn: [2, 81], key: 'ampType', group: 'amp', name: 'Amp type', kind: 'enum' },
    { cc: 101, key: 'ampDrive', group: 'amp', name: 'Amp drive', kind: 'range' },
    { cc: 102, key: 'eqBassGain', group: 'amp', name: 'EQ bass gain', kind: 'bipolar' },
    { cc: 103, key: 'eqMidGain', group: 'amp', name: 'EQ mid gain', kind: 'bipolar' },
    { cc: 104, key: 'eqTrebleGain', group: 'amp', name: 'EQ treble gain', kind: 'bipolar' },
    { cc: 107, key: 'eqMidFreq', group: 'amp', name: 'EQ mid frequency', kind: 'range' },

    // --- Rotary ------------------------------------------------------------
    { cc: 108, key: 'rotarySpeed', group: 'rotary', name: 'Rotary speed', kind: 'switch' },
    { cc: 110, key: 'rotaryDrive', group: 'rotary', name: 'Rotary drive', kind: 'range' },

    // --- Reverb ------------------------------------------------------------
    { nrpn: [2, 104], key: 'reverbEnable', group: 'reverb', name: 'Reverb enable', kind: 'switch' },
    { nrpn: [2, 106], key: 'reverbBright', group: 'reverb', name: 'Reverb bright', kind: 'range' },
    { cc: 113, key: 'reverbAmount', group: 'reverb', name: 'Reverb amount', kind: 'range' },
    { nrpn: [2, 105], key: 'reverbType', group: 'reverb', name: 'Reverb type', kind: 'enum' },
    { cc: 30, key: 'reverbGlobal', group: 'reverb', name: 'Reverb global', kind: 'switch' },

    // --- Compressor --------------------------------------------------------
    { nrpn: [2, 96], key: 'compEnable', group: 'comp', name: 'Compressor enable', kind: 'switch' },
    { cc: 117, key: 'compAmount', group: 'comp', name: 'Compressor amount', kind: 'range' },
    { nrpn: [2, 97], key: 'compFast', group: 'comp', name: 'Compressor fast mode', kind: 'switch' },
    { cc: 28, key: 'compGlobal', group: 'comp', name: 'Compressor global', kind: 'switch' },
  ],
};

// Behavioural facts that belong to the instrument, not to a parameter.
export const NORD_STAGE_4_DEVICE_NOTES = {
  controlChangeMode: {
    menuItem: '7 — Control / NRPN / Device Mode',
    ctrlDefault: 'Off',
    typeDefault: 'CC & NRPN',
    devDefault: 'Send & Receive',
    note: 'Unlike the Piano 6, the Stage 4 does NOT send panel moves out of '
      + 'the box: Ctrl defaults to Off. It must be set to Send or Send & '
      + 'Receive before any knob announcement can work. Type should stay at '
      + '"CC & NRPN" — the vibrato, arpeggiator and LFO parameters are NRPN '
      + 'only and are lost in plain CC mode. Dev (pitch bend, mod wheel, '
      + 'aftertouch, pedals) is a separate class and defaults to Send & Receive.',
  },
  localControl: 'Reverts to On at every power-up; transmitting is governed by Ctrl, not by Local.',
  pedals: 'Pedals always transmit as CC4 (organ swell), CC11 (control pedal) and CC64 (sustain).',
  sysexIdentity: 'No documented Universal Device Identity Reply, and hardware '
    + 'testing on the Stage 4 found it does not answer a Universal Identity '
    + 'Request. Model detection cannot rely on SysEx.',
};
