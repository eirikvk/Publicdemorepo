/* Fargelegging av kartbildene fra NIBIO i nettleseren: fra de rene fargene NIBIO tegner klassene i, til fargene i kartet. Stilen
   som sendes til NIBIO, ligger i data/bronse/nibio-grunnkart.ts, og tolkingen av fargene til klasser i data/solv/klasser.ts. */
import { pngBit, pngBiter } from '../../data/generelt/png.ts';
import { ALLE, BLANDING, fargeNr } from '../../data/solv/klasser.ts';
import { tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
/* Bildet fra NIBIO har en fargetabell med opptil 256 farger. Siden bytter ut tabellen og lar selve bildet være, så fargebytte
   trenger ikke nytt kall. Hver farge tolkes som en blanding av to klasser, se BLANDING i solv/klasser.ts, og får en tilsvarende
   blanding av kartfargene. */
export const klassefarger = () => ALLE.map(([id]) => rgb(id));
export function tilFarge(r: number, g: number, b: number, a: number, F: number[][]): number[] {
  if (!a) return [0, 0, 0, 0];
  const q = fargeNr(r, g, b),
    A = F[BLANDING.A[q]],
    B = F[BLANDING.B[q]],
    t = BLANDING.T[q] / 255,
    va = A ? t * (A[3] || 1) : 0,
    vb = B ? (1 - t) * (B[3] || 1) : 0,
    syn = va + vb;
  if (!(syn > 0)) return [0, 0, 0, 0];
  const f = [0, 0, 0, Math.round(a * syn)];
  for (let k = 0; k < 3; k++) f[k] = Math.round(((A ? A[k] * va : 0) + (B ? B[k] * vb : 0)) / syn);
  return f;
}
export async function fargeleggBlob(buf: ArrayBuffer): Promise<Blob | null> {
  const t0 = performance.now(),
    F = klassefarger(),
    u = new Uint8Array(buf),
    deler = pngBiter(u),
    ihdr = deler.find(d => d.type === 'IHDR'),
    pl = deler.find(d => d.type === 'PLTE'),
    tr = deler.find(d => d.type === 'tRNS'),
    type3 = !!ihdr && u[ihdr.start + 17] === 3 /* fargetabell */,
    plte = pl ? [pl.start + 8, pl.lengde - 12] : null,
    trns = tr ? [tr.start + 8, tr.lengde - 12] : null;
  if (!type3 || !plte) {
    /* uventet bildeformat: gå gjennom pikslene i stedet */
    const bm = await createImageBitmap(new Blob([buf])),
      c = document.createElement('canvas');
    c.width = bm.width;
    c.height = bm.height;
    const g = c.getContext('2d')!;
    g.drawImage(bm, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height),
      o = d.data;
    for (let i = 0; i < o.length; i += 4) {
      const f = tilFarge(o[i], o[i + 1], o[i + 2], o[i + 3], F);
      o[i] = f[0];
      o[i + 1] = f[1];
      o[i + 2] = f[2];
      o[i + 3] = f[3];
    }
    g.putImageData(d, 0, 0);
    return new Promise<Blob | null>(ok => c.toBlob(ok));
  }
  const n = plte[1] / 3,
    nyP = new Uint8Array(plte[1]),
    nyT = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const f = tilFarge(
      u[plte[0] + 3 * i],
      u[plte[0] + 3 * i + 1],
      u[plte[0] + 3 * i + 2],
      trns && i < trns[1] ? u[trns[0] + i] : 255,
      F
    );
    nyP[3 * i] = f[0];
    nyP[3 * i + 1] = f[1];
    nyP[3 * i + 2] = f[2];
    nyT[i] = f[3];
  }
  const ut = [u.subarray(0, 8)];
  deler.forEach(({ type, start, lengde }) => {
    if (type === 'PLTE') ut.push(pngBit('PLTE', nyP), pngBit('tRNS', nyT));
    else if (type !== 'tRNS') ut.push(u.subarray(start, start + lengde));
  });
  const blob = new Blob(ut, { type: 'image/png' });
  tidSlutt('kartfliser', t0);
  return blob;
}
