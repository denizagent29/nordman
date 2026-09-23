// MIDI message parsing helpers. Pure, no DOM, no Web MIDI.
// Works on Uint8Array-compatible arrays (DataView is normalised by the caller).

export const CC = 0xb0;
export const NRPN_CC = { MSB: 99, LSB: 98, DATA_MSB: 6, DATA_LSB: 38, INCREMENT: 96, DECREMENT: 97 };
export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

export function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof DataView) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return Uint8Array.from(data);
}

export function isSysex(bytes) {
  return bytes.length > 0 && bytes[0] === SYSEX_START;
}

export function isCc(bytes) {
  return bytes.length >= 3 && (bytes[0] & 0xf0) === CC;
}

export function ccNumber(bytes) {
  return bytes[1];
}

export function ccValue(bytes) {
  return bytes[2];
}

export function channel(bytes) {
  return (bytes[0] & 0x0f) + 1;
}

export function isPitchBend(bytes) {
  return bytes.length >= 3 && (bytes[0] & 0xf0) === 0xe0;
}

// System real-time: clock, start, continue, stop, active sensing. One byte
// each, so they are checked before anything that reads a second byte. A Nord
// sends MIDI clock as soon as it is on, which is why this has to be recognised
// rather than logged as an unknown message.
export function isClock(bytes) {
  if (!bytes.length) return false;
  const b = bytes[0];
  return b >= 0xf8 && b <= 0xff;
}

export function isNoteOn(bytes) {
  return bytes.length >= 3 && (bytes[0] & 0xf0) === 0x90 && bytes[2] > 0;
}

export function isNoteOff(bytes) {
  return bytes.length >= 3 && ((bytes[0] & 0xf0) === 0x80 || ((bytes[0] & 0xf0) === 0x90 && bytes[2] === 0));
}

// 14-bit value, centre = 0.
export function pitchBendValue(bytes) {
  return (bytes[2] << 7 | bytes[1]) - 8192;
}

export function isProgramChange(bytes) {
  return bytes.length >= 2 && (bytes[0] & 0xf0) === 0xc0;
}

// Universal Device Identity Request (non-realtime), which is what we send to
// ask "who are you?" — answered with a Device Identity Reply (see classifySysex).
export function deviceIdentityRequest(deviceId = 0x7f) {
  return Uint8Array.from([0xf0, 0x7e, deviceId, 0x06, 0x01, 0xf7]);
}

// A SysEx payload as a plain array, without F0/F7 and without the leading
// 0x7E (universal) or vendor byte — i.e. what classifySysex works on.
export function sysexPayload(bytes) {
  const b = toBytes(bytes);
  let start = 1;
  let end = b.length;
  if (b[end - 1] === SYSEX_END) end -= 1;
  return b.slice(start, end);
}

export function isUniversalNonRealtime(bytes) {
  const b = toBytes(bytes);
  return b.length > 3 && b[0] === SYSEX_START && b[1] === 0x7e;
}

// Device Identity Reply: 7E <dev> 06 02 <manuf 3 bytes> <family 2> <member 2> <ver 4>
// Manufacturer 00 33 29 is Clavia (Nord). We never trust the manufacturer
// blindly — the caller cross-checks against the known model table.
export function parseIdentityReply(bytes) {
  const b = toBytes(bytes);
  if (!isUniversalNonRealtime(b)) return null;
  if (b[3] !== 0x06 || b[4] !== 0x02) return null;
  const body = b.slice(5);
  if (body.length < 11) return null;
  return {
    manufacturer: [body[0], body[1], body[2]],
    deviceId: b[2],
    family: body[3] << 7 | body[4],
    familyRaw: [body[3], body[4]],
    member: body[5] << 7 | body[6],
    memberRaw: [body[5], body[6]],
    version: body.slice(7, 11),
  };
}

export function isClavia(identity) {
  return !!identity && identity.manufacturer[0] === 0x00
    && identity.manufacturer[1] === 0x33 && identity.manufacturer[2] === 0x29;
}
