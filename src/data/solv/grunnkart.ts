/* Sølv for grunnkartet fra NIBIO: dagens klasser i to former.
   Per blokk (solv.klasser): klassen per rute på 21 meter i blokkene på nivå 9, i samme rutenett som planen. Laget av de fire
   kartbildene fra NIBIO som dekker blokken, eller lagret ferdig sammen med siden for noen kommuner (bronse.klassefil). Det lagrede
   er laget med den samme funksjonen, så det er samme svar.
   For hele kommunen zoomet ut (Oversikt), fra to kilder side om side: blokkene satt sammen (solv.klassekart) og det sammensatte
   kartet av flisene som er hentet (solv.sammensatt). Gull velger mellom dem (gull.dagensKlasser).
   Kartbildene fra NIBIO leses som de er: klassen leses av fargen (klasserIFlis i klasser.ts). */
import { overlapper, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import {
  FLISNIVA,
  HALV,
  OPPLOSNINGER,
  PLANNIVA,
  RUTE_M,
  flisAvNavn,
  flisUtsnitt,
  flisnavn,
  fliserI,
  type Flis,
  type Piksler,
  type Plassering
} from './felles.ts';
import { KLASSETABELL, klasserIFlis } from './klasser.ts';
import {
  bildePiksler,
  flatePiksler,
  flislerret,
  lesBilde,
  palettLerret,
  sti,
  tegneflate,
  tegnUtsnitt
} from './raster.ts';

/* Dagens klasser zoomet ut: lerretet med klassene i rene farger, utsnittet det dekker (ext) og meter per piksel (res). dynamisk sier
   at det fylles på med det som hentes (det sammensatte kartet). */
export interface Oversikt {
  ext: Utsnitt;
  res: number;
  lerret: HTMLCanvasElement;
  dynamisk?: boolean;
}

/* Dagens klasser i en blokk på nivå 9: 512 x 512 ruter, plassert i flisnettet som planen (Planruter i felles.ts). kl er klassen per
   rute som i klasserIFlis: 0 ukjent, ellers plassen i ALLE pluss én (1 bebygd, 2 jordbruk, 3 natur, 4–6 vann). */
export interface Klasser extends Plassering {
  h: number;
  kl: Uint8Array;
}
const iBlokk = (tc: Flis): Plassering & { h: number } => ({
  z: tc[0],
  cx0: tc[1] * 512,
  cy0: tc[2] * 512,
  w: 512,
  h: 512
});

/* Tabellen solv.klasser: dagens klasser i blokken tc [9, x, y], laget av de fire kartbildene fra NIBIO på nivå 10 som dekker den
   (bronse.grunnkartflis). Én rute er 2 x 2 piksler i kartbildene. Fargen i ruta er snittet av de fire, vektet med dekningen, og
   klassen leses av fargen som ellers (klasserIFlis): det det er mest av, når fargen er en blanding. */
export async function klasser(tc: Flis): Promise<Klasser> {
  if (tc[0] !== PLANNIVA || FLISNIVA !== PLANNIVA + 1)
    throw new Error('blokkene er på nivå 9, og kartbildene på nivå 10');
  const P = new Uint8ClampedArray(512 * 512 * 4);
  await Promise.all(
    [0, 1, 2, 3].map(async d => {
      const i = d & 1,
        j = d >> 1,
        buf = await katalog.bronse.grunnkartflis([FLISNIVA, 2 * tc[1] + i, 2 * tc[2] + j]);
      halver(await bildePiksler(buf, 512, 512), P, 256 * i, 256 * j);
    })
  );
  return { ...iBlokk(tc), kl: klasserIFlis(P) };
}
/* Kartbildet K på 512 x 512 piksler inn i P på 512 x 512, halvert, med øverste venstre hjørne i (ox, oy): hver piksel i P er snittet
   av 2 x 2 piksler i K, vektet med dekningen */
function halver(K: Piksler, P: Uint8ClampedArray, ox: number, oy: number) {
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      let a = 0,
        r = 0,
        g = 0,
        b = 0;
      for (let k = 0; k < 4; k++) {
        const i = 4 * ((2 * y + (k >> 1)) * 512 + 2 * x + (k & 1)),
          v = K[i + 3];
        a += v;
        r += K[i] * v;
        g += K[i + 1] * v;
        b += K[i + 2] * v;
      }
      if (!a) continue;
      const o = 4 * ((oy + y) * 512 + ox + x);
      P[o] = r / a;
      P[o + 1] = g / a;
      P[o + 2] = b / a;
      P[o + 3] = a / 4;
    }
}
/* Det lagrede svaret for solv.klasser: filen for blokken (bronse.klassefil), et bilde med fargetabellen KLASSETABELL. Klassen
   leses av fargen som for kartbildene. null når blokken ikke er lagret. */
export async function lagredeKlasser(tc: Flis): Promise<Klasser | null> {
  const buf = await katalog.bronse.klassefil(tc);
  return buf ? { ...iBlokk(tc), kl: klasserIFlis(await bildePiksler(buf, 512, 512)) } : null;
}

/* Hvor mye av hver rute i blokken tc flaten koord dekker, som alfa fra 0 til 255 */
const flateIBlokk = (koord: Flerflate, tc: Flis) =>
  flatePiksler(koord, { u: flisUtsnitt(tc), res: RUTE_M, w: 512, h: 512 });
/* Dagens klasser K klippet til flaten koord (kommunen): ruter flaten dekker mindre enn halvparten av (HALV), blir ukjent (0) */
export function klasserIFlate(K: Klasser, koord: Flerflate): Uint8Array {
  const M = flateIBlokk(koord, [K.z, K.cx0 / 512, K.cy0 / 512]),
    kl = K.kl.slice();
  for (let q = 0; q < kl.length; q++) if (M[4 * q + 3] < HALV) kl[q] = 0;
  return kl;
}
/* Tabellen solv.blokker: blokkene på nivå 9 der kommunen nr har minst én rute etter halvregelen, som [9, x, y] */
export async function blokker(nr: string): Promise<Flis[]> {
  const g = await katalog.solv.grense(nr);
  return fliserI(g.ext, PLANNIVA).filter(tc => {
    const M = flateIBlokk(g.koord, tc);
    for (let i = 3; i < M.length; i += 4) if (M[i] >= HALV) return true;
    return false;
  });
}
/* Det lagrede svaret for solv.blokker: blokkene i registeret over de lagrede klassene, eller null når kommunen ikke står der */
export async function lagredeBlokker(nr: string): Promise<Flis[] | null> {
  const reg = await katalog.bronse.klasseregister(),
    L = reg && reg.kommuner && reg.kommuner[nr];
  return L ? L.map(([x, y]): Flis => [PLANNIVA, x, y]) : null;
}
/* Tabellen solv.klassekart: dagens klasser for kommunen nr zoomet ut, satt sammen av blokkene (solv.blokker og solv.klasser) og
   klippet til kommunen, så det er tomt utenfor. Én piksel er 1, 2, 4 eller flere ruter, så det blir høyst 2048 piksler på lengste
   side. */
export async function klassekart(nr: string): Promise<Oversikt> {
  const [B, G] = await Promise.all([katalog.solv.blokker(nr), katalog.solv.grense(nr)]);
  if (!B.length) throw new Error('ingen blokker');
  const x0 = Math.min(...B.map(t => t[1])),
    y0 = Math.min(...B.map(t => t[2])),
    nx = Math.max(...B.map(t => t[1])) - x0 + 1,
    ny = Math.max(...B.map(t => t[2])) - y0 + 1;
  let f = 1; /* ruter per piksel */
  while ((Math.max(nx, ny) * 512) / f > 2048) f *= 2;
  const s = 512 / f,
    g = tegneflate(nx * s, ny * s),
    a = flisUtsnitt([PLANNIVA, x0, y0]),
    b = flisUtsnitt([PLANNIVA, x0 + nx - 1, y0 + ny - 1]);
  g.imageSmoothingQuality = 'high';
  await Promise.all(
    B.map(async tc => {
      const c = palettLerret((await katalog.solv.klasser(tc)).kl, 512, 512, KLASSETABELL);
      g.drawImage(c, (tc[1] - x0) * s, (tc[2] - y0) * s, s, s);
      c.width = 0;
    })
  );
  const ext: Utsnitt = [a[0], b[1], b[2], a[3]];
  g.globalCompositeOperation = 'destination-in';
  sti(g, G.koord, ext, 1 / (RUTE_M * f));
  g.fill('evenodd');
  g.globalCompositeOperation = 'source-over';
  return { lerret: g.canvas, ext, res: RUTE_M * f };
}

/* Det sammensatte kartet: lerretet (c) med klassene i rene farger, meter per piksel, utsnittet det dekker, flisene som er lagt inn
   (som «nivå/x/y», se flisnavn), og det samme som Oversikt (ov), til kartet og utregningene */
export interface Samling {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  res: number;
  ext: [number, number, number, number];
  har: Set<string>;
  ov: Oversikt;
}
/* Tabellen solv.sammensatt: dagens klasser for kommunen nr, satt sammen av kartbildene fra NIBIO som er hentet. Kilden er det
   brukeren har sett på: flisene som ligger i cachen (bronse.grunnkartflis). Det er et uttalt unntak fra regelen om å vente på det
   man bygger på, for det som er hentet, er selve kilden. Tabellen er voksende: datamotoren legger inn nye fliser etter hvert som de
   hentes (tegnISamling), uten å vente på at kartet står stille. Det sammensatte kartet dekker kommunens utsnitt. */
export async function sammensatt(nr: string): Promise<Samling> {
  const s = nySamling((await katalog.solv.grense(nr)).ext);
  await fyllSamling(s);
  return s;
}
/* Alle fliser cachen har som berører det sammensatte kartet s, og som ikke er lagt inn, legges inn, én om gangen og uten nye kall.
   Det gjentas til det ikke er flere, for nye fliser kan komme mens bildene leses inn. Et bilde som ikke kan leses, hoppes over. */
export async function fyllSamling(s: Samling) {
  const provd = new Set<string>();
  for (;;) {
    const nye = katalog.bronse.grunnkartflis
      .alle()
      .filter(([n]) => !s.har.has(n) && !provd.has(n) && overlapper(flisUtsnitt(flisAvNavn(n)), s.ext));
    if (!nye.length) return;
    for (const [n, buf] of nye) {
      provd.add(n);
      try {
        const bm = await lesBilde(buf);
        if (!s.har.has(n)) tegnISamling(s, flisAvNavn(n), bm);
        if (bm.close) bm.close();
      } catch (e) {
        /* hoppes over */
      }
    }
  }
}
/* Et tomt sammensatt kart over utsnittet e: høyst 2048 piksler på den lengste siden, og ikke finere enn flisene fra NIBIO */
export function nySamling(e: Utsnitt): Samling {
  const res = Math.max(OPPLOSNINGER[FLISNIVA] / 2, Math.max(e[2] - e[0], e[3] - e[1]) / 2048),
    g = tegneflate(Math.ceil((e[2] - e[0]) / res), Math.ceil((e[3] - e[1]) / res)),
    c = g.canvas;
  const ext: [number, number, number, number] = [e[0], e[3] - c.height * res, e[0] + c.width * res, e[3]];
  return { c, g, res, ext, har: new Set<string>(), ov: { lerret: c, ext, res, dynamisk: true } };
}
/* Flisen tc, lest inn som bilde bm, inn i det sammensatte kartet s. Gir stedet i lerretet [x, y, b, h] der den ble lagt. Flisen legges
   på hele piksler. Ellers blir kantpikselen halvt gjennomsiktig fra begge naboflisene, og skjøten vises som en lys stripe. */
export function tegnISamling(s: Samling, tc: Flis, bm: ImageBitmap): [number, number, number, number] {
  s.har.add(flisnavn(tc));
  const u = flisUtsnitt(tc),
    px = (v: number) => Math.round((v - s.ext[0]) / s.res),
    py = (v: number) => Math.round((s.ext[3] - v) / s.res);
  const X = px(u[0]),
    Y = py(u[3]),
    W = px(u[2]) - X,
    H = py(u[1]) - Y;
  s.g.drawImage(bm, X, Y, W, H);
  return [X, Y, W, H];
}

/* Hvor dagens klasser i en flis tegnes fra: kartbildet fra NIBIO for flisen (flis), eller dagens klasser zoomet ut (ov), som
   klippes mot kommunen (koord) */
export interface Dagenskilde {
  flis?: ArrayBuffer;
  ov?: Oversikt | null;
  koord?: Flerflate | null;
}
/* Dagens klasser i flisen tc på 512 x 512 piksler, i de rene fargene fra NIBIO, til kartlagene. Zoomet ut bare innenfor kommunen.
   null hvis kilden k ikke har noe. */
export async function dagensKlasserIFlis(tc: Flis, k: Dagenskilde): Promise<Uint8ClampedArray | null> {
  const c = flislerret(),
    g = c.getContext('2d', { willReadFrequently: true })!,
    ov = k.ov;
  if (k.flis) g.drawImage(await lesBilde(k.flis), 0, 0, 512, 512);
  else if (ov && k.koord) {
    const u = flisUtsnitt(tc),
      r = (ov.ext[2] - ov.ext[0]) / ov.lerret.width,
      s = 512 / (u[2] - u[0]);
    tegnUtsnitt(g, ov.lerret, (u[0] - ov.ext[0]) / r, (ov.ext[3] - u[3]) / r, (u[2] - u[0]) / r, (u[3] - u[1]) / r);
    g.globalCompositeOperation = 'destination-in';
    sti(g, k.koord, u, s);
    g.fill('evenodd');
    g.globalCompositeOperation = 'source-over';
  } else return null;
  return g.getImageData(0, 0, 512, 512).data;
}
