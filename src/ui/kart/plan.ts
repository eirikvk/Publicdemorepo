/* Kartlaget for planlagt utbygging: natur og jordbruk som kommuneplanen (og egne områder) setter av. Planen hentes fra DiBK som
   fliser i samme rutenett (data/bronse/dibk-kommuneplan.ts). For hver flis legges planen oppå dagens klasser i nettleseren, og bare
   natur og jordbruk som ligger i slike områder, tegnes. Zoomet ut tegnes laget fra utbyggingen (gull.utbygging). */
import type ImageTile from 'ol/ImageTile.js';
import type { LoadFunction } from 'ol/Tile.js';
import type { TileCoord } from 'ol/tilecoord.js';
import { ol } from './ol.ts';
import { kommuneplanUrl } from '../../data/bronse/dibk-kommuneplan.ts';
import type { Utsnitt } from '../../data/generelt/geometri.ts';
import { BLOKK, blokkAv, nummer, verdi as rute } from '../../data/generelt/glissen.ts';
import { HALV, UTM, type Flis } from '../../data/solv/felles.ts';
import { JOR, NAT, klasserIFlis } from '../../data/solv/klasser.ts';
import { planIFlis } from '../../data/solv/kommuneplan.ts';
import type { Del } from '../../data/solv/egne.ts';
import type { Utbygging } from '../../data/gull/utbygging.ts';
import { bildePiksler, flislerret, sti } from '../../data/solv/raster.ts';
import { katalog } from '../../data/katalog.ts';
import { utenPlan } from '../../data/motor/egne.ts';
import { dagensKlasser, lagret } from '../../data/motor/grunnkart.ts';
import { utbyggingen } from '../../data/motor/plan.ts';
import { verdi } from '../../data/motor/valgt.ts';
import { abonner, app, endret, tidSlutt } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { ui } from '../tilstand.ts';
import { SVAKEST, TOM, fargPiksel, friskOpp, nyttSiden, plannett, type Flistegner } from './felles.ts';

const planUrl = (tc: TileCoord) => kommuneplanUrl(plannett.getTileCoordExtent(tc));

/* Egne områder i flisen med utsnittet u, som én verdi per piksel: 1 utbygging, 2 ikke utbygging. null hvis ingen ligger der. Flatene
   og typen deres kommer fra solv.egne. */
function egenMaske(u: Utsnitt) {
  const deler: Del[] = [],
    E = verdi(katalog.solv.egne);
  for (const x of E ? E.flater : [])
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

/* Zoomet ut er mange planfelt mindre enn en skjermpiksel. Flisene på nivå 9 og grovere tegnes derfor fra utbyggingen for hele
   kommunen (21 meter per rute). En flispiksel får farge bare hvis det faktisk ligger planlagt utbygging innenfor den, og styrken
   følger hvor stor del av pikselen det gjelder. Feltene blir dermed aldri større enn de er, og de forsvinner heller ikke: små felt
   vises som svake enkeltpiksler. tom sier at ingenting er tegnet. */
type Planbilde = HTMLCanvasElement & { tom?: boolean };
function grovPlanFlis(tc: TileCoord): Planbilde | null {
  const R = utbyggingen();
  if (!R) return null;
  const [z, x, y] = tc,
    f = 2 ** (R.z - z),
    D = ui.visSmale ? R.alle : R.ryddet,
    F = [rgb('pnat'), rgb('pjor')];
  /* Rutene med planlagt utbygging telles per flispiksel. Bare blokkene i utbyggingen som har planlagt utbygging, finnes, og bare de
     som ligger i flisen, gås gjennom. */
  const A = new Uint32Array(262144),
    B = new Uint32Array(262144),
    X0 = x * 512 * f,
    Y0 = y * 512 * f;
  for (const [nokkel, blokk] of D.blokker) {
    const [bx, by] = blokkAv(nokkel);
    if ((bx + 1) * BLOKK <= X0 || bx * BLOKK >= X0 + 512 * f || (by + 1) * BLOKK <= Y0 || by * BLOKK >= Y0 + 512 * f)
      continue;
    for (let q = 0; q < blokk.length; q++) {
      const v = blokk[q];
      if (v !== 1 && v !== 2) continue;
      const X = bx * BLOKK + (q % BLOKK),
        Y = by * BLOKK + Math.floor(q / BLOKK);
      if (X < X0 || Y < Y0 || X >= X0 + 512 * f || Y >= Y0 + 512 * f || nummer(D, X, Y) < 0) continue;
      const p = Math.floor((Y - Y0) / f) * 512 + Math.floor((X - X0) / f);
      if (v === 1) A[p]++;
      else B[p]++;
    }
  }
  const c: Planbilde = flislerret(),
    g = c.getContext('2d')!,
    ut = g.createImageData(512, 512),
    o = ut.data;
  let tegnet = false;
  for (let p = 0; p < 262144; p++) {
    const a = A[p],
      b = B[p];
    if (!a && !b) continue;
    tegnet = true;
    const q = F[b > a ? 1 : 0],
      i = 4 * p,
      andel = (a + b) / (f * f);
    o[i] = q[0];
    o[i + 1] = q[1];
    o[i + 2] = q[2];
    o[i + 3] = Math.round(255 * Math.max(SVAKEST, Math.sqrt(andel)));
  }
  g.putImageData(ut, 0, 0);
  c.tom = !tegnet;
  return c;
}
/* Kartets egen regel for smale striper zoomet inn: en piksel vises når ruta den ligger i, eller en av de fire nabo­rutene, er
   et felt som ble beholdt i utbyggingen. Tallene bruker selve rutenettet (ryddStriper i gull/utbygging.ts). */
function iEllerInntil(R: Utbygging, x: number, y: number) {
  if (x < 0 || y < 0 || x >= R.w || y >= R.h) return false;
  const i = y * R.w + x,
    r = (j: number) => rute(R.ryddet, j);
  return !!(
    r(i) ||
    (x > 0 && r(i - 1)) ||
    (x < R.w - 1 && r(i + 1)) ||
    (y > 0 && r(i - R.w)) ||
    (y < R.h - 1 && r(i + R.w))
  );
}
async function lastPlanFlis(tile: ImageTile) {
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
    const [K, planBuf] = await Promise.all([
      dagensKlasser(tile.getTileCoord() as Flis),
      katalog.bronse.planflis(tile.getTileCoord() as Flis)
    ]);
    if (!K) throw new Error('mangler dagens klasser');
    /* Planen og dagens klasser leses per piksel med de samme reglene som tallene (planIFlis og klasserIFlis i sølv) */
    const P = await bildePiksler(planBuf, 512, 512),
      t0 = performance.now(),
      c = flislerret(),
      g = c.getContext('2d')!,
      ut = g.createImageData(512, 512),
      o = ut.data;
    const pjor = rgb('pjor'),
      pnat = rgb('pnat');
    /* Smale striper skjules ved å kreve at punktet ligger i eller inntil et felt som overlevde ryddingen i rutenettet. */
    const [tz, tx, ty] = tile.getTileCoord(),
      R = !ui.visSmale && utbyggingen(),
      sh = R ? tz - R.z : 0;
    let tegnet = false;
    const vent =
      !ui.visSmale &&
      !R &&
      app.valgt &&
      !lagret(app.valgt.nr); /* rutenettet lages av det som er hentet, og flisen tegnes på nytt når det er klart */
    const EM = egenMaske(
      plannett.getTileCoordExtent(tile.getTileCoord())
    ); /* egne områder i flisen: 1 utbygging, 2 ikke utbygging */
    if (!vent) {
      const kl = klasserIFlis(K),
        pl = planIFlis(P);
      for (let py = 0, q = 0; py < 512; py++)
        for (let px = 0; px < 512; px++, q++) {
          const e = EM ? EM[q] : 0,
            k = kl[q] - 1;
          if (e === 2 || k < 0 || (e !== 1 && !pl[q]))
            continue; /* tatt ut av planen, hav, eller utenfor planområdene */
          if (k !== JOR && k !== NAT) continue; /* allerede bebygd i dag, eller vann */
          if (e !== 1 && R && !iEllerInntil(R, ((tx * 512 + px) >> sh) - R.cx0, ((ty * 512 + py) >> sh) - R.cy0))
            continue;
          fargPiksel(o, 4 * q, k === JOR ? pjor : pnat);
          tegnet = true;
        }
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
export const planLag = new ol.layer.Tile({
  className: 'plan',
  properties: { tittel: 'Planlagt utbygging' },
  source: nyPlanKilde(),
  visible: false
});
/* Ny kilde: alle flisene tegnes på nytt, også de som ikke kunne tegnes før dagens klasser fantes */
export const tegnPlan = () => planLag.setSource(nyPlanKilde());

/* Smale striper i kartet, under Tekniske valg */
export function settSmale(paa: boolean) {
  ui.visSmale = paa;
  endret();
}

/* Laget følger tilstanden: det vises når grensen er hentet og det finnes planlagt utbygging å vise, og tegnes på nytt når
   utbyggingen er regnet ut på nytt eller smale striper slås av eller på. */
const ny = nyttSiden();
abonner(() => {
  const G = verdi(katalog.solv.grense);
  if (ny('grense', G) && G) planLag.setExtent(G.ext);
  const nyttRutenett = ny('rutenett', utbyggingen()),
    nyeStriper = ny('smale', ui.visSmale);
  if (nyttRutenett || nyeStriper) friskOpp(planLag);
  planLag.setVisible(!!G && !utenPlan());
});
