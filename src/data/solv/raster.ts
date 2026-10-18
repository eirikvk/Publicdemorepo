/* Sølv, felles standard: lerretet (canvas) i nettleseren, til å pakke ut kartbildene og tegne kartet. Dekningen av flater regnes
   ikke her, men i egen kode (generelt/dekning.ts), og noen få flater tegnes fortsatt med halvregelen (METODE.md). Dette er den
   eneste filen i sølv og gull som bruker nettleseren, sammen med bakgrunnstråden (arbeid.ts og arbeider.ts). Skal beregningene
   kjøres et annet sted, er det disse som må byttes ut. Det som tegnes og leses med en tegneflate som gis inn (Flate), virker både på
   siden og i bakgrunnstråden. */
import type { Flerflate, Utsnitt } from '../generelt/geometri.ts';

/* En tegneflate: et lerret på siden, eller i bakgrunnstråden (OffscreenCanvas) */
export type Flate = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/* Gjør tegneflaten g på w x h klar til bruk igjen: tom, uten forskyvning og med vanlige innstillinger */
export function nullstill(g: Flate, w: number, h: number) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.imageSmoothingEnabled = true;
  g.fillStyle = '#000';
  g.clearRect(0, 0, w, h);
  g.beginPath();
}

/* Et lerret på w x h ruter, klart til å tegne i og lese fra */
export function tegneflate(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d', { willReadFrequently: true })!;
}

/* Tegneflatene som brukes om igjen, én per størrelse. Lerreter tar mye minne, og Safari på iPhone har en grense for hvor mye alle
   lerretene på siden kan ta til sammen, også de som venter på å bli ryddet bort. En flate lånes bare mens noe tegnes og leses, uten
   å vente på noe i mellom, så to kall kan ikke bruke den samme samtidig. Svaret er alltid en kopi (getImageData), ikke flaten. */
const flater = new Map<string, CanvasRenderingContext2D>();
/* En tom tegneflate på w x h fra dem som brukes om igjen. Den kan brukes fram til neste await. */
export function hentFlate(w: number, h: number): CanvasRenderingContext2D {
  const n = `${w}x${h}`;
  let g = flater.get(n);
  if (g) {
    flater.delete(n);
    nullstill(g, w, h);
  } else g = tegneflate(w, h);
  flater.set(n, g);
  /* høyst fire størrelser: den som er brukt lengst siden, frigjøres */
  for (const [k, x] of flater) {
    if (flater.size <= 4) break;
    x.canvas.width = 0;
    flater.delete(k);
  }
  return g;
}

/* Et lerret på 512 x 512 piksler: én flis i utbyggingen, eller én flis i kartet tegnet i dobbel tetthet */
export function flislerret(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  return c;
}

/* En flerflate som sti i lerretet g. u er utsnittet lerretet viser, og s er ruter per meter. Fylles med g.fill('evenodd'), så hull
   blir hull. */
export function sti(g: Flate, koord: Flerflate, u: Utsnitt, s: number) {
  g.beginPath();
  for (const flate of koord)
    for (const ring of flate) {
      ring.forEach(([x, y], i) =>
        i ? g.lineTo((x - u[0]) * s, (u[3] - y) * s) : g.moveTo((x - u[0]) * s, (u[3] - y) * s)
      );
      g.closePath();
    }
}

/* Et bilde fra en kilde (PNG) som piksler, skalert til w x h ruter. pakkUt tegner i en tegneflate fra flate, som kan brukes fram til
   neste await. */
export async function pakkUt(buf: ArrayBuffer, w: number, h: number, flate: (w: number, h: number) => Flate) {
  const bm = await createImageBitmap(new Blob([buf]));
  try {
    const g = flate(w, h);
    g.drawImage(bm, 0, 0, w, h);
    return g.getImageData(0, 0, w, h).data;
  } finally {
    if (bm.close) bm.close();
  }
}
export const bildePiksler = (buf: ArrayBuffer, w: number, h: number) => pakkUt(buf, w, h, hentFlate);
/* Et lerret på w x h piksler fra plassen i en fargetabell per piksel (indeks), med fargene [rød, grønn, blå] per plass. Plass 0 er
   gjennomsiktig. */
export function palettLerret(indeks: Uint8Array, w: number, h: number, farger: number[][]): HTMLCanvasElement {
  const g = tegneflate(w, h),
    d = g.createImageData(w, h),
    o = d.data;
  for (let q = 0; q < indeks.length; q++) {
    const v = indeks[q];
    if (!v) continue;
    const f = farger[v];
    o.set(f, 4 * q);
    o[4 * q + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return g.canvas;
}

/* Et bilde fra en kilde (PNG) lest inn, så det kan tegnes i et lerret */
export const lesBilde = (buf: ArrayBuffer) => createImageBitmap(new Blob([buf]));
