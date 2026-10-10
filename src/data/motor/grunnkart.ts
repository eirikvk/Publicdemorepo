/* Datamotoren, dagens klasser: hvilken arealklasse hver piksel har i dag, fra grunnkartet til NIBIO. Planlagt utbygging legges oppå
   dette, og kartlagene for planlagt utbygging, inngrepsfri natur og grått areal tegnes oppå det.
   Dagens klasser kommer fra tre steder:
   - Zoomet inn: kartbildene fra NIBIO, én flis om gangen.
   - Zoomet ut, i kommuner med lagret oversiktsbilde: bildet av hele kommunen (app.ov.buf).
   - Zoomet ut ellers: det sammensatte kartet, som datamotoren setter sammen av flisene som er hentet (app.ov.lerret, dynamisk).
   Bildene har klassene i rene farger (DATAFARGE i solv/klasser.ts). Klassen leses av fargen med klasseAv. Kartet får egne kopier i
   visningsfargene, se ui/kart/grunnkart.ts. */
import { FLISNIVA, grunnkartUrl, hentGrunnkartFlis, hentOversiktsbilde } from '../bronse/nibio-grunnkart.ts';
import { opptatt } from '../bronse/henting.ts';
import { OPPLOSNINGER, ORIGO, flisUtsnitt, overlapper, type Flis, type Kommune, type Utsnitt } from '../solv/felles.ts';
import type { Blokk } from '../solv/planrutenett.ts';
import { flislerret, sti, tegnUtsnitt } from '../solv/raster.ts';
import { regnAlt } from './plan.ts';
import { app, endret, tidSlutt, valgNr, varsle } from './tilstand.ts';

/* Det lagrede oversiktsbildet for valgt kommune. res er meter per piksel. */
let ovBilde: Promise<ImageBitmap> | null = null;
const ovBildet = () => ovBilde || (ovBilde = createImageBitmap(new Blob([app.ov!.buf!])));
export async function hentOversikt(k: Kommune, mitt: number) {
  app.ov = null;
  ovBilde = null;
  samle = null;
  if (!app.oversikter[k.nr]) return;
  try {
    const buf = await hentOversiktsbilde(k);
    if (mitt !== valgNr) return;
    const ext = app.oversikter[k.nr];
    app.ov = { buf, ext, res: (ext[2] - ext[0]) / new DataView(buf).getUint32(16) /* bredden i PNG-hodet */ };
    endret();
    regnAlt(); /* planlagt utbygging regnes ut for hele kommunen med en gang */
  } catch (e) {
    if (mitt === valgNr) {
      delete app.oversikter[k.nr];
      endret();
    }
  }
}

/* Kommuner uten lagret oversiktsbilde: datamotoren setter sammen sitt eget av flisene som er hentet. Zoomer man ut igjen, finnes
   dermed dagens klasser for det man alt har sett, og planlagt utbygging kan regnes ut for den delen. Det hentes ingenting nytt for
   dette. Lerretet c har klassene i rene farger. Samlingen beholdes for de fire sist besøkte kommunene. */
/* Et sammensatt kart: lerretet (c) med klassene i rene farger, meter per piksel, utsnittet det dekker, flisene som er lagt inn, og
   planrutenettet per flis på nivå 9 */
export interface Samling {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  res: number;
  ext: Utsnitt;
  har: Set<string>;
  blokker: Map<string, Blokk>;
}
export let samle: Samling | null = null;
const samlinger = new Map<string, Samling>();
export function nySamling(nr: string, ext: Utsnitt) {
  let s = samlinger.get(nr);
  if (!s) {
    const res = Math.max(OPPLOSNINGER[FLISNIVA] / 2, Math.max(ext[2] - ext[0], ext[3] - ext[1]) / 2048),
      c = document.createElement('canvas');
    c.width = Math.ceil((ext[2] - ext[0]) / res);
    c.height = Math.ceil((ext[3] - ext[1]) / res);
    s = {
      c,
      g: c.getContext('2d', { willReadFrequently: true })!,
      res,
      ext: [ext[0], ext[3] - c.height * res, ext[0] + c.width * res, ext[3]],
      har: new Set() /* flisene som er lagt inn, som «nivå/x/y» */,
      blokker: new Map() /* planrutenettet per flis på nivå 9, se plan.ts */
    };
  }
  samlinger.delete(nr);
  samlinger.set(nr, s);
  if (samlinger.size > 4) {
    const eldst = samlinger.keys().next().value as string,
      g = samlinger.get(eldst)!;
    g.c.width = 0;
    g.blokker.clear();
    samlinger.delete(eldst);
    varsle('samlingFjernet', g.c);
  }
  samle = s;
  if (s.har.size) {
    app.ov = { lerret: s.c, ext: s.ext, res: s.res, dynamisk: true };
    endret();
    regnAlt();
  }
  fyllSamling(s);
}
/* Fliser nettleseren alt har, lastes ikke på nytt, og kom derfor aldri inn i det sammensatte kartet for en kommune man byttet til
   etterpå. Når en kommune velges, legges derfor alle hentede fliser som berører den, inn fra minnet. Én om gangen, uten nye kall. */
async function fyllSamling(s: Samling) {
  const str = 256 * OPPLOSNINGER[FLISNIVA];
  for (const [url, buf] of [...hentGrunnkartFlis.lager]) {
    if (s !== samle) return;
    let b: number[];
    try {
      b = new URL(url).searchParams.get('bbox')!.split(',').map(Number);
    } catch (e) {
      continue;
    }
    if (!b || b.length !== 4 || !(b[2] > b[0]) || !overlapper(b, s.ext)) continue;
    const z = FLISNIVA + Math.round(Math.log2(str / (b[2] - b[0]))),
      side = 256 * OPPLOSNINGER[z];
    await leggISamling([z, Math.round((b[0] - ORIGO[0]) / side), Math.round((ORIGO[1] - b[3]) / side)], buf);
  }
}
/* En flis fra NIBIO inn i det sammensatte kartet. Kalles av kartet for hver flis det henter, og av fyllSamling. Kartet får beskjed
   (hendelsen nyFlis) om hvor flisen ble lagt, så det kan fargelegge sin kopi. */
export function leggISamling(tc: Flis, buf: ArrayBuffer): Promise<void> {
  const s = samle,
    n = tc.join('/');
  if (!s || s.har.has(n)) return Promise.resolve();
  return createImageBitmap(new Blob([buf]))
    .then(bm => {
      if (s !== samle || s.har.has(n)) {
        if (bm.close) bm.close();
        return;
      }
      const t0 = performance.now();
      s.har.add(n);
      /* Flisen legges på hele piksler. Ellers blir kantpikselen halvt gjennomsiktig fra begge naboflisene, og skjøten vises som en lys stripe. */
      const u = flisUtsnitt(tc),
        px = (v: number) => Math.round((v - s.ext[0]) / s.res),
        py = (v: number) => Math.round((s.ext[3] - v) / s.res);
      const X = px(u[0]),
        Y = py(u[3]),
        W = px(u[2]) - X,
        H = py(u[1]) - Y;
      s.g.drawImage(bm, X, Y, W, H);
      if (bm.close) bm.close();
      if (!app.ov || app.ov.lerret !== s.c) {
        app.ov = { lerret: s.c, ext: s.ext, res: s.res, dynamisk: true };
        endret();
      }
      varsle('nyFlis', s.c, [X, Y, W, H]);
      planleggRegning();
      tidSlutt('sammensatt kart', t0);
    })
    .catch(() => {});
}

/* Utregningen etter nye fliser gjøres når kartet har stått stille litt og ingenting lastes lenger, så kartet ikke hakker mens man
   flytter det. Starter man å flytte igjen, venter den til neste stopp. */
let regnTimer: ReturnType<typeof setTimeout> | undefined;
export let regningVenter = false;
export function planleggRegning() {
  regningVenter = true;
  clearTimeout(regnTimer);
  regnTimer = setTimeout(async () => {
    if (app.kartFlyttes) return; /* kartetFlyttes(false) tar opp tråden igjen */
    if (opptatt()) return planleggRegning(); /* tallene venter til alt er hentet */
    regningVenter = false;
    const t0 = performance.now();
    await regnAlt();
    tidSlutt('utregning etter nye fliser', t0);
  }, 400);
}
/* Kartet sier fra når det begynner og slutter å flytte seg */
export function kartetFlyttes(paa: boolean) {
  app.kartFlyttes = paa;
  if (paa) clearTimeout(regnTimer);
  else if (regningVenter) planleggRegning();
}
/* Ny kommune: utregningen for den forrige gjelder ikke lenger */
export const stoppRegning = () => {
  clearTimeout(regnTimer);
  regningVenter = false;
};

/* Dagens klasser i flisen tc på 512 x 512 piksler, i de rene fargene fra NIBIO. null hvis de ikke finnes ennå. */
export async function dagensKlasser(tc: Flis): Promise<Uint8ClampedArray | null> {
  const c = flislerret(),
    g = c.getContext('2d', { willReadFrequently: true })!;
  if (tc[0] >= FLISNIVA)
    g.drawImage(
      await createImageBitmap(new Blob([await hentGrunnkartFlis(grunnkartUrl(flisUtsnitt(tc)))])),
      0,
      0,
      512,
      512
    );
  else if (app.ov && app.ov.buf) {
    const u = flisUtsnitt(tc),
      r = app.ov.res;
    tegnUtsnitt(
      g,
      await ovBildet(),
      (u[0] - app.ov.ext[0]) / r,
      (app.ov.ext[3] - u[3]) / r,
      (u[2] - u[0]) / r,
      (u[3] - u[1]) / r
    );
  } else if (app.ov && app.ov.lerret && app.grense) {
    /* det sammensatte kartet: bare det som er hentet, og bare innenfor kommunen */
    const u = flisUtsnitt(tc),
      r = (app.ov.ext[2] - app.ov.ext[0]) / app.ov.lerret.width,
      s = 512 / (u[2] - u[0]);
    tegnUtsnitt(
      g,
      app.ov.lerret,
      (u[0] - app.ov.ext[0]) / r,
      (app.ov.ext[3] - u[3]) / r,
      (u[2] - u[0]) / r,
      (u[3] - u[1]) / r
    );
    g.globalCompositeOperation = 'destination-in';
    sti(g, app.grense.koord, u, s);
    g.fill('evenodd');
    g.globalCompositeOperation = 'source-over';
  } else return null;
  const t0 = performance.now(),
    data = g.getImageData(0, 0, 512, 512).data;
  tidSlutt('dagens klasser', t0);
  return data;
}
