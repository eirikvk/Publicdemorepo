/* Generelt: PNG-filer, slik standarden beskriver dem. En fil er en fast start og så biter (IHDR, PLTE, tRNS, IDAT, IEND), hver med
   lengde, type, innhold og kontrollsum. Siden bytter fargetabellen i kartbildene uten å pakke ut bildet (ui/kart/fargelegging.ts), og
   verktøyet for oversiktsbilder lager bilder med fargetabell (verktoy/oversiktsbilde.ts). */

export const PNG_START = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
/* Én bit: lengde, type, innhold og kontrollsum */
export function pngBit(type: string, data: Uint8Array) {
  const o = new Uint8Array(data.length + 12),
    dv = new DataView(o.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i);
  o.set(data, 8);
  let c = 0xffffffff;
  for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ o[i]) & 255] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return o;
}
/* Bitene i en PNG-fil: typen, hvor biten starter i filen, og hele lengden med lengde, type og kontrollsum. Innholdet starter 8 byte
   etter starten. */
export function pngBiter(u: Uint8Array) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength),
    ut: { type: string; start: number; lengde: number }[] = [];
  for (let p = 8; p + 12 <= u.length;) {
    const len = dv.getUint32(p);
    ut.push({ type: String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]), start: p, lengde: len + 12 });
    p += len + 12;
  }
  return ut;
}
/* Et bilde på w x h piksler med fargetabell (fargetype 3, 8 biter per piksel). indeks er plassen i tabellen per piksel, rad for rad,
   farger [rød, grønn, blå] per plass, og dekning dekningen (alfa) per plass. pakk komprimerer med zlib (deflate). */
export function palettPng(
  w: number,
  h: number,
  indeks: Uint8Array,
  farger: number[][],
  dekning: number[],
  pakk: (data: Uint8Array) => Uint8Array
) {
  const ihdr = new Uint8Array(13),
    dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; /* biter per piksel */
  ihdr[9] = 3; /* fargetabell */
  const rader = new Uint8Array(h * (w + 1)); /* hver rad starter med filter 0 (ingen) */
  for (let y = 0; y < h; y++) rader.set(indeks.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const plte = new Uint8Array(farger.length * 3);
  farger.forEach((f, i) => plte.set(f, 3 * i));
  const biter = [
    PNG_START,
    pngBit('IHDR', ihdr),
    pngBit('PLTE', plte),
    pngBit('tRNS', Uint8Array.from(dekning)),
    pngBit('IDAT', pakk(rader)),
    pngBit('IEND', new Uint8Array(0))
  ];
  const ut = new Uint8Array(biter.reduce((s, b) => s + b.length, 0));
  biter.reduce((p, b) => (ut.set(b, p), p + b.length), 0);
  return ut;
}
