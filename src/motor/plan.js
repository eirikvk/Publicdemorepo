/* Planlagt utbygging: kommuneplanen fra DiBK som kartlag, hentingen til planrutenettet og samordningen av utregningen. Selve
   utregningen ligger i solv/planrutenett.js. */
import { ol } from './ol.js';
import { hentKommuneplanFlis, hentPlandekning, hentPlaninfo, kommuneplanUrl } from '../bronse/dibk-kommuneplan.js';
import { BILDE_PLANDEKNING, PLANNIVA, PLAN_FINNES, RUTE, RUTE_M, rutenett } from '../solv/felles.js';
import { JOR, KL, NAT, klasseAv } from '../solv/klasser.js';
import { byggPlanRaster, planDekning, tellBlokk } from '../solv/planrutenett.js';
import { tegneflate } from '../solv/raster.js';
import { egenMaske, mine, utenPlan } from './egne.js';
import { SVAKEST, UTM, app, endret, gjeldende, rgb, tidSlutt, valgNr } from './felles.js';
import { dagensKlasser, fargeleggFliser } from './fliser.js';
import { regnGraa } from './graa.js';
import { TOM, friskOpp, kommuneSti, lerret, plannett } from './grunnlag.js';
import { NATURLAG, regnNatur } from './naturtema.js';
import { samle, tegnOversikt } from './oversikt.js';
/* Kartlaget: kommuneplanen fra DiBK (se bronse/dibk-kommuneplan.js), hentet som fliser i samme rutenett. For hver flis legges
   planen oppå dagens klasser i nettleseren, og bare natur og jordbruk som ligger i slike områder, tegnes. Zoomet ut brukes
   oversiktsbildet som dagens klasser: det lagrede, eller det nettleseren selv har satt sammen av flisene den har hentet. */
const planUrl = tc => kommuneplanUrl(plannett.getTileCoordExtent(tc));

/* Zoomet ut er mange planfelt mindre enn en skjermpiksel. Flisene på nivå 9 og grovere tegnes derfor fra et rutenett
   for hele kommunen (21 meter per rute, laget av arealutregningen). En flispiksel får farge bare hvis det faktisk ligger
   planlagt utbygging innenfor den, og styrken følger hvor stor del av pikselen det gjelder. Feltene blir dermed aldri
   større enn de er, og de forsvinner heller ikke: små felt vises som svake enkeltpiksler. */

function grovPlanFlis(tc) {
  const R = app.planRaster;
  if (!R) return null;
  const [z, x, y] = tc,
    f = 2 ** (R.z - z),
    D = app.visSmale ? R.alle : R.ryddet,
    F = [rgb('pnat'), rgb('pjor')];
  const c = lerret(),
    g = c.getContext('2d'),
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
function iEllerInntil(R, x, y) {
  /* ligger ruta i et beholdt felt, eller rett ved siden av et? */
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
async function lastPlanFlis(tile, src) {
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
    const [K, planBuf] = await Promise.all([dagensKlasser(tile.getTileCoord()), hentKommuneplanFlis(src)]);
    if (!K) throw new Error('mangler dagens klasser');
    const c = lerret(),
      g = c.getContext('2d', { willReadFrequently: true }),
      bm = await createImageBitmap(new Blob([planBuf])),
      t0 = performance.now();
    g.drawImage(bm, 0, 0, 512, 512);
    const P = g.getImageData(0, 0, 512, 512).data,
      ut = g.createImageData(512, 512),
      o = ut.data;
    const pjor = rgb('pjor'),
      pnat = rgb('pnat'); /* uavhengig av hvilke klasser som vises i kartet */
    /* Smale striper skjules ved å kreve at punktet ligger i eller inntil et felt som overlevde ryddingen i rutenettet. */
    const [tz, tx, ty] = tile.getTileCoord(),
      R = !app.visSmale && gjeldende(app.planRaster),
      sh = R ? tz - R.z : 0;
    let tegnet = false;
    const vent =
      !app.visSmale &&
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
          if (e === 2 || K[i + 3] < 100 || (e !== 1 && P[i + 3] < 128))
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
    tileLoadFunction: lastPlanFlis,
    transition: 0,
    projection: UTM
  });
export const planLag = new ol.layer.Tile({ className: 'plan', source: nyPlanKilde(), visible: false });
export const tegnPlan = () => planLag.setSource(nyPlanKilde());
/* Omtrentlig areal, regnet ut i nettleseren: planflisene på nivå 9 (21 meter per piksel) legges oppå dagens klasser,
   og pikslene telles. Med lagret oversiktsbilde gjelder det hele kommunen. Uten gjelder det den delen av kommunen
   nettleseren har hentet kart for, og tallene regnes ut på nytt hver gang det kommer mer kart.
   Det gir et anslag til illustrasjon, ikke offisiell statistikk. */
let regnNr = 0;

async function hentBlokk(tc, fliser) {
  const [K, buf] = await Promise.all([dagensKlasser(tc), ingenPlan() ? null : hentKommuneplanFlis(planUrl(tc))]);
  if (!K) throw new Error('mangler dagens klasser');
  const g = lerret().getContext('2d', { willReadFrequently: true });
  if (buf) g.drawImage(await createImageBitmap(new Blob([buf])), 0, 0, 512, 512);
  return { ...tellBlokk(K, g.getImageData(0, 0, 512, 512).data, tc, fliser), utenPlan: !buf };
}
/* Samordner utregningen: finner ut hva som kan regnes ut nå, henter blokkene som mangler, bygger rutenettet og ber om ny tegning. */
async function regnPlan() {
  const mitt = ++regnNr,
    Z = PLANNIVA;
  const sett = tilstand => {
    app.planTall = { tilstand };
    endret();
  };
  if (!app.klipp || utenPlan())
    return sett('tom'); /* knappen for planlagt utbygging styrer bare kartlaget, ikke tallene */
  const E = mine();
  if (app.planRaster && app.planRaster.nr !== app.valgt.nr) app.planRaster = null;
  if (!app.ov) return sett(app.oversikter[app.valgt.nr] ? 'tom' : 'zoom');
  const dyn = !!app.ov.dynamisk,
    sm = dyn ? samle : null,
    nr = app.valgt.nr,
    denne = app.ov;
  if (dyn && !sm) return;
  if (!(dyn && app.planRaster)) sett('regner'); /* nye tall erstatter de gamle uten at teksten blinker */
  /* Rutenettet bygges av blokker på 512 x 512 ruter, én per flis på nivå 9. En blokk regnes bare ut på nytt når det har kommet nye
     fliser innenfor den, så et nytt utsnitt koster én eller to blokker og ikke hele det hentede området. */
  const blokker = dyn ? sm.blokker : denne.blokker || (denne.blokker = new Map()),
    under = new Map();
  if (dyn)
    for (const v of sm.har) {
      const [z, x, y] = v.split('/').map(Number),
        k = `${x >> (z - Z)}/${y >> (z - Z)}`;
      if (!under.has(k)) under.set(k, []);
      under.get(k).push([z, x, y]);
    }
  else plannett.forEachTileCoord(denne.ext, Z, tc => under.set(`${tc[1]}/${tc[2]}`, null));
  try {
    await Promise.all(
      [...under].map(async ([k, fliser]) => {
        const har = blokker.get(k),
          sig = fliser ? fliser.length : -1;
        if (har && har.sig === sig && har.kl && har.pl && har.utenPlan === ingenPlan()) return;
        const [x, y] = k.split('/').map(Number),
          blokk = await hentBlokk([Z, x, y], fliser);
        blokker.set(k, blokk);
      })
    );
  } catch (e) {
    if (mitt === regnNr) sett('feil');
    return;
  }
  if (mitt !== regnNr || nr !== (app.valgt && app.valgt.nr)) return;
  const tStart = performance.now(),
    m = RUTE_M,
    km2 = v => v * RUTE;
  app.planRaster = byggPlanRaster(
    nr,
    [...under.keys()].map(k => k.split('/').map(Number)),
    blokker,
    dyn,
    E,
    Math.round(dyn ? Math.max(m, sm.res) : m)
  );
  E.forEach((g, i) => {
    g.tall = app.planRaster.egneTall[i];
  });
  friskOpp(planLag);
  tidSlutt('plantall', tStart);
  app.planSum = { nr, nat: km2(app.planRaster.sum.rn), jor: km2(app.planRaster.sum.rj), delvis: dyn, egne: E.length };
  sett('ok');
}
/* Ikke alle kommuner har kommuneplanen sin hos DiBK. Ett lite bilde av hele kommunen viser hvor mye av flaten planlaget dekker, se
   planDekning i solv/planrutenett.js. Finnes det en plan, hentes navnet på den med ett oppslag i et punkt midt i det dekkede området. */

export const ingenPlan = () =>
  !!app.planInfo && !!app.valgt && app.planInfo.nr === app.valgt.nr && app.planInfo.tilstand === 'ingen';
export async function sjekkPlan(k, geom, mitt) {
  app.planInfo = { nr: k.nr, tilstand: 'sjekker' };
  endret();
  try {
    const { res, w, h, u } = rutenett(geom.getExtent(), ...BILDE_PLANDEKNING);
    const buf = await hentPlandekning(k, u, w, h);
    if (mitt !== valgNr) return;
    const a = tegneflate(w, h),
      b = tegneflate(w, h);
    a.drawImage(await createImageBitmap(new Blob([buf])), 0, 0, w, h);
    kommuneSti(b, geom, u, 1 / res);
    b.fill('evenodd');
    const { dekning, treff } = planDekning(a.getImageData(0, 0, w, h).data, b.getImageData(0, 0, w, h).data);
    let kilde = '';
    if (dekning >= PLAN_FINNES)
      try {
        const q = treff[treff.length >> 1];
        const j = await hentPlaninfo(k, u, w, h, q % w, Math.floor(q / w));
        const f = (j.features || []).map(x => x.properties || {}).find(x => x['arealplanId.kommunenummer'] === k.nr);
        if (f) {
          const d = /^(\d{4})-(\d\d)-(\d\d)/.exec(f['kopidata.kopidato'] || ''),
            vert = f['kopidata.originalDatavert'];
          kilde = `plan ${f['arealplanId.planidentifikasjon']}${vert ? ' fra ' + vert : ''}${d ? `, kopiert til DiBK ${d[3]}.${d[2]}.${d[1]}` : ''}`;
        }
      } catch (e) {}
    if (mitt !== valgNr) return;
    app.planInfo = { nr: k.nr, tilstand: dekning < PLAN_FINNES ? 'ingen' : 'ok', dekning, kilde };
  } catch (e) {
    if (mitt !== valgNr) return;
    app.planInfo = { nr: k.nr, tilstand: 'feil' };
  }
  endret();
  visPlan();
  if (ingenPlan()) nyttSlor();
}
export const regnAlt = () =>
  regnPlan().then(() => {
    NATURLAG.forEach(regnNatur);
    regnGraa();
  }); /* påvirkningen på naturlagene følger plantallene */
/* Planlaget vises når det er slått på, grensen er hentet og det finnes noe planlagt utbygging å vise. */
export const visPlanLag = () => planLag.setVisible(app.planPaa && !!app.klipp && !utenPlan());
export const visPlan = () => {
  visPlanLag();
  regnAlt();
};
export const nyttSlor = () => {
  if (KL.some(([id]) => !app.vis[id])) {
    tegnOversikt();
    fargeleggFliser();
  }
}; /* sløret over skjulte klasser følger planlaget */ /* resten av kartet står urørt når laget slås på */
