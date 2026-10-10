/* Datamotoren, dagens klasser: hvilken arealklasse hver piksel har i dag, fra grunnkartet til NIBIO. Planlagt utbygging legges oppå
   dette, og kartlagene for planlagt utbygging, inngrepsfri natur og grått areal tegnes oppå det.
   Dagens klasser kommer fra tre steder, alle i katalogen (datasett.ts):
   - Zoomet inn: kartbildene fra NIBIO, én flis om gangen (bronse.grunnkartflis).
   - Zoomet ut, i kommuner med lagret oversiktsbilde: bildet av hele kommunen (bronse.oversiktsbilde).
   - Zoomet ut ellers: det sammensatte kartet, satt sammen av flisene som er hentet (solv.sammensatt).
   Bildene har klassene i rene farger (DATAFARGE i solv/klasser.ts). Klassen leses av fargen med klasseAv. Kartet får egne kopier i
   visningsfargene, se ui/kart/grunnkart.ts. */
import { FLISNIVA, grunnkartUrl } from '../bronse/nibio-grunnkart.ts';
import { opptatt } from '../bronse/henting.ts';
import { overlapper, type Utsnitt } from '../generelt/geometri.ts';
import { OPPLOSNINGER, ORIGO, flisUtsnitt, type Flis } from '../solv/felles.ts';
import { flislerret, sti, tegnUtsnitt } from '../solv/raster.ts';
import { alle, ferdig, hent, se, vedNy } from './katalog.ts';
import {
  GRENSE,
  GRUNNKARTFLIS,
  OVERSIKTSBILDE,
  OVERSIKTSREGISTER,
  OVERSIKT_LEST,
  SAMMENSATT,
  type Oversikt,
  type Samling
} from './datasett.ts';
import { regnAlt } from './plan.ts';
import { app, endret, tidSlutt, varsle } from './tilstand.ts';

/* Utsnittet det lagrede oversiktsbildet for kommunen nr dekker, når kommunen står i registeret og bildet ikke har feilet */
export function lagretUtsnitt(nr: string): Utsnitt | null {
  const reg = ferdig(OVERSIKTSREGISTER, ''),
    ext = reg && reg.kommuner && reg.kommuner[nr];
  if (!ext) return null;
  const e = se(OVERSIKTSBILDE, nr);
  return e && e.status === 'feil' ? null : ext;
}
export const lagret = (nr: string) => !!lagretUtsnitt(nr);

/* Det sammensatte kartet for valgt kommune, når det finnes */
export function samlingen(): Samling | null {
  const e = app.valgt && se(SAMMENSATT, app.valgt.nr);
  return e && e.status === 'ok' ? e.verdi! : null;
}
/* Dagens klasser zoomet ut for valgt kommune: det lagrede oversiktsbildet, eller det sammensatte kartet når det har fått fliser */
export function oversikt(): Oversikt | null {
  const nr = app.valgt && app.valgt.nr;
  if (!nr) return null;
  if (lagret(nr)) return ferdig(OVERSIKTSBILDE, nr);
  const s = samlingen();
  return s && s.har.size ? s.ov : null;
}

/* Kommuner uten lagret oversiktsbilde: datamotoren setter sammen sitt eget av flisene som er hentet. Zoomer man ut igjen, finnes
   dermed dagens klasser for det man alt har sett, og planlagt utbygging kan regnes ut for den delen. Det hentes ingenting nytt for
   dette. Velges kommunen igjen, brukes samlingen fra sist, og alle fliser katalogen har som berører kommunen, legges inn. */
export async function startSamling(nr: string) {
  const s = await hent(SAMMENSATT, nr);
  if (s !== samlingen()) return;
  if (s.har.size) {
    endret();
    regnAlt();
  }
  fyllSamling(s);
}
/* Flisen [z, x, y] en adresse til NIBIO gjelder, lest av utsnittet i adressen, og utsnittet */
function flisAv(url: string): { tc: Flis; b: number[] } | null {
  let b: number[];
  try {
    b = new URL(url).searchParams.get('bbox')!.split(',').map(Number);
  } catch (e) {
    return null;
  }
  if (!b || b.length !== 4 || !(b[2] > b[0])) return null;
  const z = FLISNIVA + Math.round(Math.log2((256 * OPPLOSNINGER[FLISNIVA]) / (b[2] - b[0]))),
    side = 256 * OPPLOSNINGER[z];
  return { tc: [z, Math.round((b[0] - ORIGO[0]) / side), Math.round((ORIGO[1] - b[3]) / side)], b };
}
/* Alle fliser katalogen har som berører samlingen, legges inn, én om gangen og uten nye kall */
async function fyllSamling(s: Samling) {
  for (const [url, buf] of alle(GRUNNKARTFLIS)) {
    if (s !== samlingen()) return;
    const f = flisAv(url);
    if (f && overlapper(f.b, s.ext)) await leggISamling(f.tc, buf);
  }
}
/* Hver ny flis fra NIBIO legges inn i det sammensatte kartet for valgt kommune */
vedNy(GRUNNKARTFLIS, (buf, url) => {
  const f = flisAv(url);
  if (f) leggISamling(f.tc, buf);
});
/* En flis inn i det sammensatte kartet. Kartet får beskjed (hendelsen nyFlis) om hvor flisen ble lagt, så det kan fargelegge sin
   kopi. */
function leggISamling(tc: Flis, buf: ArrayBuffer): Promise<void> {
  const s = samlingen(),
    n = tc.join('/');
  if (!s || s.har.has(n)) return Promise.resolve();
  return createImageBitmap(new Blob([buf]))
    .then(bm => {
      if (s !== samlingen() || s.har.has(n)) {
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
      if (s.har.size === 1) endret(); /* det sammensatte kartet finnes nå */
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
    g = c.getContext('2d', { willReadFrequently: true })!,
    nr = app.valgt && app.valgt.nr,
    ov = oversikt(),
    grense = nr ? se(GRENSE, nr) : null;
  if (tc[0] >= FLISNIVA)
    g.drawImage(
      await createImageBitmap(new Blob([await hent(GRUNNKARTFLIS, grunnkartUrl(flisUtsnitt(tc)))])),
      0,
      0,
      512,
      512
    );
  else if (ov && ov.buf && nr) {
    const u = flisUtsnitt(tc),
      r = ov.res;
    tegnUtsnitt(
      g,
      await hent(OVERSIKT_LEST, nr),
      (u[0] - ov.ext[0]) / r,
      (ov.ext[3] - u[3]) / r,
      (u[2] - u[0]) / r,
      (u[3] - u[1]) / r
    );
  } else if (ov && ov.lerret && grense && grense.status === 'ok') {
    /* det sammensatte kartet: bare det som er hentet, og bare innenfor kommunen */
    const u = flisUtsnitt(tc),
      r = (ov.ext[2] - ov.ext[0]) / ov.lerret.width,
      s = 512 / (u[2] - u[0]);
    tegnUtsnitt(g, ov.lerret, (u[0] - ov.ext[0]) / r, (ov.ext[3] - u[3]) / r, (u[2] - u[0]) / r, (u[3] - u[1]) / r);
    g.globalCompositeOperation = 'destination-in';
    sti(g, grense.verdi!.koord, u, s);
    g.fill('evenodd');
    g.globalCompositeOperation = 'source-over';
  } else return null;
  const t0 = performance.now(),
    data = g.getImageData(0, 0, 512, 512).data;
  tidSlutt('dagens klasser', t0);
  return data;
}
