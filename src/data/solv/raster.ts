/* Sølv, felles standard: fra flater til ruter. Flatene tegnes i et lerret (canvas) i nettleseren, og dekningen leses per rute som
   alfa fra 0 til 255. Lerretet glatter kantene, så en rute i kanten av en flate får delvis dekning. Dette er den eneste filen i
   sølv og gull som bruker nettleseren. Skal beregningene kjøres et annet sted, er det denne som må byttes ut. */
import type { Flerflate, Utsnitt } from '../generelt/geometri.ts';
import type { Piksler, Rutebilde } from './felles.ts';

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
export function laanFlate<T>(w: number, h: number, bruk: (g: CanvasRenderingContext2D) => T): T {
  const n = `${w}x${h}`;
  let g = flater.get(n);
  if (g) {
    flater.delete(n);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = true;
    g.fillStyle = '#000';
    g.clearRect(0, 0, w, h);
    g.beginPath();
  } else g = tegneflate(w, h);
  try {
    return bruk(g);
  } finally {
    flater.set(n, g);
    /* høyst fire størrelser: den som er brukt lengst siden, frigjøres */
    for (const [k, x] of flater) {
      if (flater.size <= 4) break;
      x.canvas.width = 0;
      flater.delete(k);
    }
  }
}

/* Et lerret på 512 x 512 piksler: én flis i utbyggingen, eller én flis i kartet tegnet i dobbel tetthet */
export function flislerret(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  return c;
}

/* Tegner utsnittet (sx, sy, sw, sh) av et bilde over hele lerretet g på 512 x 512. Utsnittet klippes til bildet her, og målet krympes
   tilsvarende. Standarden sier at nettleseren skal gjøre det selv, men Safari har tegnet ingenting når utsnittet stikker utenfor
   bildet, og det gjør det for alle fliser langs kanten av kommunen når kartet er zoomet ut. */
export function tegnUtsnitt(
  g: CanvasRenderingContext2D,
  bilde: CanvasImageSource & { width: number; height: number },
  sx: number,
  sy: number,
  sw: number,
  sh: number
) {
  const x0 = Math.max(0, sx),
    y0 = Math.max(0, sy),
    x1 = Math.min(bilde.width, sx + sw),
    y1 = Math.min(bilde.height, sy + sh);
  if (!(x1 > x0 && y1 > y0)) return;
  const fx = 512 / sw,
    fy = 512 / sh;
  g.drawImage(bilde, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * fx, (y0 - sy) * fy, (x1 - x0) * fx, (y1 - y0) * fy);
}

/* En flerflate som sti i lerretet g. u er utsnittet lerretet viser, og s er ruter per meter. Fylles med g.fill('evenodd'), så hull
   blir hull. */
export function sti(g: CanvasRenderingContext2D, koord: Flerflate, u: Utsnitt, s: number) {
  g.beginPath();
  for (const flate of koord)
    for (const ring of flate) {
      ring.forEach(([x, y], i) =>
        i ? g.lineTo((x - u[0]) * s, (u[3] - y) * s) : g.moveTo((x - u[0]) * s, (u[3] - y) * s)
      );
      g.closePath();
    }
}

/* En flerflate tegnet i rutenettet R, som piksler: dekningen av hver rute står i alfa. Kommunens flate brukes slik som maske. */
export function flatePiksler(koord: Flerflate, R: Rutebilde) {
  return laanFlate(R.w, R.h, g => {
    sti(g, koord, R.u, 1 / R.res);
    g.fill('evenodd');
    return g.getImageData(0, 0, R.w, R.h).data;
  });
}
/* Flere flerflater tegnet i rutenettet R, hver for seg, så der de overlapper, er dekningen den samme som for én (unionen). Klippet
   mot flaten innenfor (kommunen). Dekningen av hver rute står i alfa. */
export function flaterPiksler(flater: Flerflate[], R: Rutebilde, innenfor: Flerflate) {
  return laanFlate(R.w, R.h, g => {
    for (const koord of flater) {
      sti(g, koord, R.u, 1 / R.res);
      g.fill('evenodd');
    }
    g.globalCompositeOperation = 'destination-in';
    sti(g, innenfor, R.u, 1 / R.res);
    g.fill('evenodd');
    return g.getImageData(0, 0, R.w, R.h).data;
  });
}
/* Et bilde fra en kilde (PNG) som piksler, skalert til w x h ruter */
export async function bildePiksler(buf: ArrayBuffer, w: number, h: number) {
  const bm = await createImageBitmap(new Blob([buf]));
  try {
    return laanFlate(w, h, g => {
      g.drawImage(bm, 0, 0, w, h);
      return g.getImageData(0, 0, w, h).data;
    });
  } finally {
    if (bm.close) bm.close();
  }
}
/* Arealet en tegning dekker, i kvadratmeter i kartet: summen av dekningen (alfa) i rutene, med ruter på res meter */
export function dekketM2(d: Piksler, res: number) {
  let sum = 0;
  for (let i = 3; i < d.length; i += 4) sum += d[i];
  return (sum / 255) * res * res;
}

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
