/* Datamotoren, planlagt utbygging: om DiBK har kommuneplanen, og samordningen av planrutenettet. Kommuneplanen hentes i
   bronse/dibk-kommuneplan.ts, planrutenettet bygges i solv/planrutenett.ts, og tallene sidene viser, lages i gull/planlagt.ts.
   Kartlaget for planen ligger i ui/kart/plan.ts. */
import { hentKommuneplanFlis, hentPlandekning, hentPlaninfo, kommuneplanUrl } from '../bronse/dibk-kommuneplan.ts';
import {
  BILDE_PLANDEKNING,
  PLANNIVA,
  RUTE_M,
  flisUtsnitt,
  fliserI,
  rutenett,
  type Flis,
  type Kommune
} from '../solv/felles.ts';
import type { Blokk } from '../solv/planrutenett.ts';
import { byggPlanRaster, planDekning, tellBlokk } from '../solv/planrutenett.ts';
import { flislerret, sti, tegneflate } from '../solv/raster.ts';
import { byggPlanSum } from '../gull/planlagt.ts';
import { mine, utenPlan } from './egne.ts';
import { regnGraa } from './graa.ts';
import { dagensKlasser, samle } from './grunnkart.ts';
import { NATURTEMA, regnNatur } from './naturtema.ts';
import { app, endret, tidSlutt, valgNr, type Grense, type Tilstand } from './tilstand.ts';

/* Kommunen har ingen kommuneplan hos DiBK */
export const ingenPlan = () =>
  !!app.planInfo && !!app.valgt && app.planInfo.nr === app.valgt.nr && app.planInfo.tilstand === 'ingen';

/* Ikke alle kommuner har kommuneplanen sin hos DiBK. Ett lite bilde av hele kommunen viser hvor mye av flaten planlaget dekker, se
   planDekning i solv/planrutenett.ts. Finnes det en plan, hentes navnet på den med ett oppslag i et punkt midt i det dekkede området. */
export async function sjekkPlan(k: Kommune, grense: Grense, mitt: number) {
  app.planInfo = { nr: k.nr, tilstand: 'sjekker' };
  endret();
  try {
    const { res, w, h, u } = rutenett(grense.ext, ...BILDE_PLANDEKNING);
    const buf = await hentPlandekning(k, u, w, h);
    if (mitt !== valgNr) return;
    const a = tegneflate(w, h),
      b = tegneflate(w, h);
    a.drawImage(await createImageBitmap(new Blob([buf])), 0, 0, w, h);
    sti(b, grense.koord, u, 1 / res);
    b.fill('evenodd');
    const { dekning, finnes, treff } = planDekning(a.getImageData(0, 0, w, h).data, b.getImageData(0, 0, w, h).data);
    let plan = null;
    if (finnes)
      try {
        const q = treff[treff.length >> 1];
        plan = await hentPlaninfo(k, u, w, h, q % w, Math.floor(q / w));
      } catch (e) {}
    if (mitt !== valgNr) return;
    app.planInfo = { nr: k.nr, tilstand: finnes ? 'ok' : 'ingen', dekning, plan };
  } catch (e) {
    if (mitt !== valgNr) return;
    app.planInfo = { nr: k.nr, tilstand: 'feil' };
  }
  endret();
  regnAlt();
}

/* Planrutenettet regnes ut i nettleseren: planflisene på nivå 9 (21 meter per piksel) legges oppå dagens klasser, og pikslene telles.
   Med lagret oversiktsbilde gjelder det hele kommunen. Uten gjelder det den delen av kommunen nettleseren har hentet kart for, og
   tallene regnes ut på nytt hver gang det kommer mer kart. Det gir et anslag til illustrasjon, ikke offisiell statistikk. */
let regnNr = 0;
async function hentBlokk(tc: Flis, fliser: Flis[] | null): Promise<Blokk> {
  const [K, buf] = await Promise.all([
    dagensKlasser(tc),
    ingenPlan() ? null : hentKommuneplanFlis(kommuneplanUrl(flisUtsnitt(tc)))
  ]);
  if (!K) throw new Error('mangler dagens klasser');
  const g = flislerret().getContext('2d', { willReadFrequently: true })!;
  if (buf) g.drawImage(await createImageBitmap(new Blob([buf])), 0, 0, 512, 512);
  return { ...tellBlokk(K, g.getImageData(0, 0, 512, 512).data, tc, fliser), utenPlan: !buf };
}
/* Samordner utregningen: finner ut hva som kan regnes ut nå, henter blokkene som mangler, bygger rutenettet og sier fra. */
async function regnPlan() {
  const mitt = ++regnNr,
    Z = PLANNIVA;
  const sett = (tilstand: NonNullable<Tilstand['planTall']>['tilstand']) => {
    app.planTall = { tilstand };
    endret();
  };
  if (!app.grense || utenPlan()) return sett('tom');
  const E = mine();
  if (app.planRaster && app.planRaster.nr !== app.valgt!.nr) app.planRaster = null;
  if (!app.ov) return sett(app.oversikter[app.valgt!.nr] ? 'tom' : 'zoom');
  const dyn = !!app.ov.dynamisk,
    sm = dyn ? samle : null,
    nr = app.valgt!.nr,
    denne = app.ov;
  if (dyn && !sm) return;
  if (!(dyn && app.planRaster)) sett('regner'); /* nye tall erstatter de gamle uten at teksten blinker */
  /* Rutenettet bygges av blokker på 512 x 512 ruter, én per flis på nivå 9. En blokk regnes bare ut på nytt når det har kommet nye
     fliser innenfor den, så et nytt utsnitt koster én eller to blokker og ikke hele det hentede området. */
  const blokker = dyn ? sm!.blokker : denne.blokker || (denne.blokker = new Map()),
    under = new Map<string, Flis[] | null>();
  if (dyn)
    for (const v of sm!.har) {
      const [z, x, y] = v.split('/').map(Number),
        k = `${x >> (z - Z)}/${y >> (z - Z)}`;
      if (!under.has(k)) under.set(k, []);
      under.get(k)!.push([z, x, y]);
    }
  else fliserI(denne.ext, Z).forEach(tc => under.set(`${tc[1]}/${tc[2]}`, null));
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
    m = RUTE_M;
  app.planRaster = byggPlanRaster(
    nr,
    [...under.keys()].map(k => k.split('/').map(Number)),
    blokker,
    dyn,
    E,
    Math.round(dyn ? Math.max(m, sm!.res) : m)
  );
  const R = app.planRaster;
  E.forEach((g, i) => {
    g.tall = R.egneTall[i];
  });
  tidSlutt('plantall', tStart);
  app.planSum = byggPlanSum(app.planRaster);
  sett('ok');
}
/* Planrutenettet, og så kryssingen med temaene og grått areal, som følger det */
export const regnAlt = () =>
  regnPlan().then(() => {
    NATURTEMA.forEach(regnNatur);
    regnGraa();
  });
