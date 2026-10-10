/* Datamotoren, planlagt utbygging: samordningen av planrutenettet og kryssingene som følger det. Om DiBK har kommuneplanen, står i
   datasettet solv.planinfo. Kommuneplanen hentes i bronse/dibk-kommuneplan.ts, planrutenettet bygges i solv/planrutenett.ts, og
   tallene sidene viser, lages i gull/planlagt.ts. Kartlaget for planen ligger i ui/kart/plan.ts. */
import { kommuneplanUrl } from '../bronse/dibk-kommuneplan.ts';
import { PLANNIVA, RUTE_M, flisUtsnitt, fliserI, type Flis } from '../solv/felles.ts';
import { byggPlanRaster, tellBlokk, type Blokk } from '../solv/planrutenett.ts';
import { bildePiksler } from '../solv/raster.ts';
import type { Naturtema } from './naturtema.ts';
import { begynt, feilet, hent, hentStraks, legg, se, utgave } from './katalog.ts';
import {
  GRAA,
  GRAAKRYSS,
  GRENSE,
  KARTLAGT,
  PLANBLOKKER,
  PLANFLIS,
  PLANINFO,
  PLANRUTENETT,
  TEMAKRYSS,
  TEMAOMRADER,
  type Kryssnokkel
} from './datasett.ts';
import { mine, utenPlan } from './egne.ts';
import { dagensKlasser, oversikt, samlingen } from './grunnkart.ts';
import { NATURTEMA } from './naturtema.ts';
import { app, endret, tidSlutt } from './tilstand.ts';

/* Kommunen har ingen kommuneplan hos DiBK */
export function ingenPlan() {
  const e = app.valgt && se(PLANINFO, app.valgt.nr);
  return !!e && e.status === 'ok' && !e.verdi!.finnes;
}

/* Planrutenettet regnes ut i nettleseren: planflisene på nivå 9 (21 meter per piksel) legges oppå dagens klasser, og pikslene telles.
   Med lagret oversiktsbilde gjelder det hele kommunen. Uten gjelder det den delen av kommunen nettleseren har hentet kart for, og
   tallene regnes ut på nytt hver gang det kommer mer kart. Det gir et anslag til illustrasjon, ikke offisiell statistikk. */
let regnNr = 0;
async function hentBlokk(tc: Flis, fliser: Flis[] | null): Promise<Blokk> {
  const [K, buf] = await Promise.all([
    dagensKlasser(tc),
    ingenPlan() ? null : hent(PLANFLIS, kommuneplanUrl(flisUtsnitt(tc)))
  ]);
  if (!K) throw new Error('mangler dagens klasser');
  const P = buf
    ? await bildePiksler(buf, 512, 512)
    : new Uint8ClampedArray(512 * 512 * 4); /* uten plan: ingen piksler satt */
  return { ...tellBlokk(K, P, tc, fliser), utenPlan: !buf };
}
/* Samordner utregningen for valgt kommune: finner ut hva som kan regnes ut nå, regner ut blokkene som mangler, bygger rutenettet og
   legger det i katalogen. Hvor langt det er kommet, leses av planTall i gulldata.ts. */
async function regnPlan() {
  const mitt = ++regnNr,
    Z = PLANNIVA,
    nr = app.valgt ? app.valgt.nr : null,
    g = nr ? se(GRENSE, nr) : null;
  if (!nr || !g || g.status !== 'ok' || utenPlan()) return endret();
  const E = mine(),
    ov = oversikt();
  if (!ov) return endret();
  const dyn = !!ov.dynamisk,
    sm = dyn ? samlingen() : null;
  if (dyn && !sm) return;
  begynt(PLANRUTENETT, nr, dyn); /* nye tall i det sammensatte kartet erstatter de gamle uten at teksten blinker */
  /* Rutenettet bygges av blokker på 512 x 512 ruter, én per flis på nivå 9. En blokk regnes bare ut på nytt når det har kommet nye
     fliser innenfor den, så et nytt utsnitt koster én eller to blokker og ikke hele det hentede området. */
  const blokker = hentStraks(PLANBLOKKER, nr, () => new Map<string, Blokk>()),
    under = new Map<string, Flis[] | null>();
  if (dyn)
    for (const v of sm!.har) {
      const [z, x, y] = v.split('/').map(Number),
        k = `${x >> (z - Z)}/${y >> (z - Z)}`;
      if (!under.has(k)) under.set(k, []);
      under.get(k)!.push([z, x, y]);
    }
  else fliserI(ov.ext, Z).forEach(tc => under.set(`${tc[1]}/${tc[2]}`, null));
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
    if (mitt === regnNr) feilet(PLANRUTENETT, nr);
    return;
  }
  if (mitt !== regnNr || nr !== (app.valgt && app.valgt.nr)) return;
  const t0 = performance.now(),
    m = RUTE_M;
  const R = byggPlanRaster(
    nr,
    [...under.keys()].map(k => k.split('/').map(Number)),
    blokker,
    dyn,
    E,
    Math.round(dyn ? Math.max(m, sm!.res) : m)
  );
  tidSlutt('plantall', t0);
  legg(PLANRUTENETT, nr, { ...R, egneIder: E.map(x => x.id) });
}

/* Det kryssingen av et naturtema bygger på, for valgt kommune: planrutenettet, og det kartlagte når temaet har kartleggingsgrad,
   med utgavene av det kryssingen regnes ut av. null uten planrutenett eller uten noe å krysse med. */
export function temagrunnlag(tema: Naturtema): Kryssnokkel | null {
  const nr = app.valgt && app.valgt.nr,
    e = nr ? se(PLANRUTENETT, nr) : null;
  if (!nr || !e || !e.verdi || utenPlan()) return null;
  const v = tema.dekning ? se(KARTLAGT, nr) : null,
    kartlagt = v && v.status === 'ok' ? v.verdi! : null;
  return {
    tema,
    nr,
    R: e.verdi,
    kartlagt,
    utgaver: [e.utgave, utgave(TEMAOMRADER, { tema, nr }), kartlagt ? v!.utgave : 0]
  };
}
/* Det samme for grått areal: planrutenettet, når grått areal er hentet */
export function graagrunnlag() {
  const nr = app.valgt && app.valgt.nr,
    e = nr ? se(PLANRUTENETT, nr) : null,
    G = nr ? se(GRAA, nr) : null;
  if (!nr || !e || !e.verdi || utenPlan() || !G || G.status !== 'ok') return null;
  return { nr, R: e.verdi, utgaver: [e.utgave, G.utgave] };
}
/* Kryssingene som følger planrutenettet regnes ut med en gang, så de er klare når en side spør: naturtemaene som er hentet, og grått
   areal. */
export function regnKryss() {
  const nr = app.valgt && app.valgt.nr;
  if (!nr) return;
  for (const tema of NATURTEMA) {
    const K = temagrunnlag(tema),
      O = se(TEMAOMRADER, { tema, nr });
    if (K && O && O.status === 'ok') hent(TEMAKRYSS, K).catch(() => {});
  }
  const G = graagrunnlag();
  if (G) hent(GRAAKRYSS, G).catch(() => {});
  endret();
}
/* Planrutenettet, og så kryssingene, som følger det */
export const regnAlt = () => regnPlan().then(regnKryss);
