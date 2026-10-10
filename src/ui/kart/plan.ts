/* Kartlaget for planlagt utbygging: natur og jordbruk som kommuneplanen (og egne områder) setter av. Planen hentes fra DiBK som
   fliser i samme rutenett (data/bronse/dibk-kommuneplan.js). For hver flis legges planen oppå dagens klasser i nettleseren, og bare
   natur og jordbruk som ligger i slike områder, tegnes. Zoomet ut tegnes laget fra planrutenettet i datamotoren. */
import type ImageTile from 'ol/ImageTile.js';
import type { LoadFunction } from 'ol/Tile.js';
import type { TileCoord } from 'ol/tilecoord.js';
import { ol } from './ol.ts';
import { hentKommuneplanFlis, kommuneplanUrl } from '../../data/bronse/dibk-kommuneplan.ts';
import { HALV, SYNLIG, UTM, type Flis, type Utsnitt } from '../../data/solv/felles.ts';
import { JOR, NAT, klasseAv } from '../../data/solv/klasser.ts';
import type { Del } from '../../data/solv/egne.ts';
import type { Planrutenett } from '../../data/solv/planrutenett.ts';
import { flislerret, sti } from '../../data/solv/raster.ts';
import { mine, utenPlan } from '../../data/motor/egne.ts';
import { dagensKlasser } from '../../data/motor/grunnkart.ts';
import { abonner, app, endret, gjeldende, tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { SVAKEST, TOM, friskOpp, nyttSiden, plannett, type Flistegner } from './felles.ts';

const planUrl = (tc: TileCoord) => kommuneplanUrl(plannett.getTileCoordExtent(tc));

/* Egne områder i flisen med utsnittet u, som én verdi per piksel: 1 utbygging, 2 ikke utbygging. null hvis ingen ligger der. */
function egenMaske(u: Utsnitt) {
  const deler: Del[] = [];
  for (const x of mine())
    if (ol.extent.intersects(x.ext, u))
      for (const del of x.deler) if (ol.extent.intersects(del.ext, u)) deler.push(del);
  if (!deler.length) return null;
  const c = flislerret(),
    g = c.getContext('2d', { willReadFrequently: true })!,
    s = 512 / (u[2] - u[0]);
  for (const type of ['fri', 'bygg']) {
    g.fillStyle = type === 'bygg' ? '#f00' : '#0f0';
    for (const del of deler)
      if (del.type === type) {
        sti(g, del.koord, u, s);
        g.fill('evenodd');
      }
  }
  const a = g.getImageData(0, 0, 512, 512).data,
    ut = new Uint8Array(262144);
  for (let i = 0, q = 0; i < a.length; i += 4, q++) if (a[i + 3] >= HALV) ut[q] = a[i] > a[i + 1] ? 1 : 2;
  return ut;
}

/* Zoomet ut er mange planfelt mindre enn en skjermpiksel. Flisene på nivå 9 og grovere tegnes derfor fra planrutenettet for hele
   kommunen (21 meter per rute). En flispiksel får farge bare hvis det faktisk ligger planlagt utbygging innenfor den, og styrken
   følger hvor stor del av pikselen det gjelder. Feltene blir dermed aldri større enn de er, og de forsvinner heller ikke: små felt
   vises som svake enkeltpiksler. tom sier at ingenting er tegnet. */
type Planbilde = HTMLCanvasElement & { tom?: boolean };
function grovPlanFlis(tc: TileCoord): Planbilde | null {
  const R = app.planRaster;
  if (!R) return null;
  const [z, x, y] = tc,
    f = 2 ** (R.z - z),
    D = ui.visSmale ? R.alle : R.ryddet,
    F = [rgb('pnat'), rgb('pjor')];
  const c: Planbilde = flislerret(),
    g = c.getContext('2d')!,
    ut = g.createImageData(512, 512),
    o = ut.data;
  let tegnet = false;
  for (let py = 0; py < 512; py++) {
    const Y = (y * 512 + py) * f - R.cy0;
    if (Y + f <= 0 || Y >= R.h) continue;
    for (let px = 0; px < 512; px++) {
      const X = (x * 512 + px) * f - R.cx0;
      if (X + f <= 0 || X >= R.w) continue;
      let a = 0,
        b = 0;
      for (let j = Math.max(0, Y), jm = Math.min(R.h, Y + f); j < jm; j++)
        for (let i = Math.max(0, X), im = Math.min(R.w, X + f), rad = j * R.w; i < im; i++) {
          const v = D[rad + i];
          if (v === 1) a++;
          else if (v === 2) b++;
        }
      if (!a && !b) continue;
      tegnet = true;
      const q = F[b > a ? 1 : 0],
        i = 4 * (py * 512 + px),
        andel = (a + b) / (f * f);
      o[i] = q[0];
      o[i + 1] = q[1];
      o[i + 2] = q[2];
      o[i + 3] = Math.round(255 * Math.max(SVAKEST, Math.sqrt(andel)));
    }
  }
  g.putImageData(ut, 0, 0);
  c.tom = !tegnet;
  return c;
}
/* Kartets egen regel for smale striper zoomet inn: en piksel vises når ruta den ligger i, eller en av de fire nabo­rutene, er
   et felt som ble beholdt i planrutenettet. Tallene bruker selve rutenettet (ryddStriper i solv/planrutenett.js). */
function iEllerInntil(R: Planrutenett, x: number, y: number) {
  if (x < 0 || y < 0 || x >= R.w || y >= R.h) return false;
  const i = y * R.w + x,
    r = R.ryddet;
  return !!(
    r[i] ||
    (x > 0 && r[i - 1]) ||
    (x < R.w - 1 && r[i + 1]) ||
    (y > 0 && r[i - R.w]) ||
    (y < R.h - 1 && r[i + R.w])
  );
}
async function lastPlanFlis(tile: ImageTile, src: string) {
  try {
    if (tile.getTileCoord()[0] <= 9) {
      const t0 = performance.now(),
        c = grovPlanFlis(tile.getTileCoord());
      tidSlutt('planfliser', t0);
      if (!c) throw new Error('rutenettet er ikke klart');
      if (c.tom) {
        tile.setState(TOM);
        return;
      }
      tile.setImage(c);
      return;
    } /* lerretet brukes direkte som flisbilde, uten å pakke det som PNG og lese det inn igjen */
    const [K, planBuf] = await Promise.all([dagensKlasser(tile.getTileCoord() as Flis), hentKommuneplanFlis(src)]);
    if (!K) throw new Error('mangler dagens klasser');
    const c = flislerret(),
      g = c.getContext('2d', { willReadFrequently: true })!,
      bm = await createImageBitmap(new Blob([planBuf])),
      t0 = performance.now();
    g.drawImage(bm, 0, 0, 512, 512);
    const P = g.getImageData(0, 0, 512, 512).data,
      ut = g.createImageData(512, 512),
      o = ut.data;
    const pjor = rgb('pjor'),
      pnat = rgb('pnat');
    /* Smale striper skjules ved å kreve at punktet ligger i eller inntil et felt som overlevde ryddingen i rutenettet. */
    const [tz, tx, ty] = tile.getTileCoord(),
      R = !ui.visSmale && gjeldende(app.planRaster),
      sh = R ? tz - R.z : 0;
    let tegnet = false;
    const vent =
      !ui.visSmale &&
      !R &&
      app.valgt &&
      !app.oversikter[
        app.valgt.nr
      ]; /* rutenettet lages av det som er hentet, og flisen tegnes på nytt når det er klart */
    const EM = egenMaske(
      plannett.getTileCoordExtent(tile.getTileCoord())
    ); /* egne områder i flisen: 1 utbygging, 2 ikke utbygging */
    if (!vent)
      for (let py = 0, i = 0, q = 0; py < 512; py++)
        for (let px = 0; px < 512; px++, i += 4, q++) {
          const e = EM ? EM[q] : 0;
          if (e === 2 || K[i + 3] < SYNLIG || (e !== 1 && P[i + 3] < HALV))
            continue; /* tatt ut av planen, hav, eller utenfor planområdene */
          const k = klasseAv(K[i], K[i + 1], K[i + 2]);
          if (k !== JOR && k !== NAT) continue; /* allerede bebygd i dag, eller vann */
          if (e !== 1 && R && !iEllerInntil(R, ((tx * 512 + px) >> sh) - R.cx0, ((ty * 512 + py) >> sh) - R.cy0))
            continue;
          const f = k === JOR ? pjor : pnat;
          o[i] = f[0];
          o[i + 1] = f[1];
          o[i + 2] = f[2];
          o[i + 3] = 255;
          tegnet = true;
        }
    if (!tegnet) {
      tile.setState(TOM);
      tidSlutt('planfliser', t0);
      return;
    } /* de fleste fliser har ingen planlagt utbygging. Tomme fliser tegnes ikke, så laget koster ingenting der. */
    g.putImageData(ut, 0, 0);
    tile.setImage(c);
    tidSlutt('planfliser', t0);
  } catch (e) {
    tile.setState(3);
  }
}
const nyPlanKilde = () =>
  new ol.source.XYZ({
    tileUrlFunction: planUrl,
    tileGrid: plannett,
    tilePixelRatio: 2,
    tileLoadFunction: lastPlanFlis as Flistegner as LoadFunction,
    transition: 0,
    projection: UTM
  });
export const planLag = new ol.layer.Tile({ className: 'plan', source: nyPlanKilde(), visible: false });
/* Ny kilde: alle flisene tegnes på nytt, også de som ikke kunne tegnes før dagens klasser fantes */
export const tegnPlan = () => planLag.setSource(nyPlanKilde());

/* Smale striper i kartet, under Tekniske valg */
export function settSmale(paa: boolean) {
  ui.visSmale = paa;
  endret();
}

/* Laget følger tilstanden: det vises når grensen er hentet og det finnes planlagt utbygging å vise, og tegnes på nytt når
   planrutenettet er regnet ut på nytt eller smale striper slås av eller på. */
const ny = nyttSiden();
abonner(() => {
  if (ny('grense', app.grense) && app.grense) planLag.setExtent(app.grense.ext);
  const nyttRutenett = ny('rutenett', app.planRaster),
    nyeStriper = ny('smale', ui.visSmale);
  if (nyttRutenett || nyeStriper) friskOpp(planLag);
  planLag.setVisible(!!app.grense && !utenPlan());
});
