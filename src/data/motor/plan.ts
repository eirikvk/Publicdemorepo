/* Datamotoren, planlagt utbygging: utregningen av planrutenettet, som datamotoren legger i katalogen selv (solv.planrutenett), fordi
   det bygges opp etter hvert som det kommer mer kart. Kommuneplanen hentes i bronse/dibk-kommuneplan.ts, planrutenettet bygges i
   solv/planrutenett.ts, og tallene sidene viser, lages i gull/planlagt.ts. Kartlaget for planen ligger i ui/kart/plan.ts.
   Når et nytt planrutenett legges inn, er gull for kommunen utdatert, og det sidene viser, regnes ut på nytt (se kommune.ts). */
import { kommuneplanUrl } from '../bronse/dibk-kommuneplan.ts';
import { begynt, feilet, glem, legg, se, utdaterGull } from '../cache.ts';
import { katalog } from '../katalog.ts';
import { PLANNIVA, RUTE_M, flisUtsnitt, fliserI, type Flis } from '../solv/felles.ts';
import { byggPlanRaster, tellBlokk, type Blokk } from '../solv/planrutenett.ts';
import { bildePiksler } from '../solv/raster.ts';
import { mine, utenPlan } from './egne.ts';
import { dagensKlasser, lagret, oversikt, samlingen } from './grunnkart.ts';
import { valgtNr } from './valgt.ts';
import { endret, tidSlutt } from './tilstand.ts';

/* Kommunen har ingen kommuneplan hos DiBK */
export function ingenPlan() {
  const nr = valgtNr(),
    r = nr ? se(katalog.solv.planinfo, nr) : null;
  return !!r && r.status === 'ok' && !r.verdi!.finnes;
}
/* Planrutenettet for valgt kommune: det siste som er regnet ut, også mens det regnes ut på nytt */
export function planrutenett() {
  const nr = valgtNr(),
    r = nr ? se(katalog.solv.planrutenett, nr) : null;
  return r && r.verdi ? r.verdi : null;
}
/* Hvor langt utregningen av planlagt utbygging er kommet: tom (ingenting å regne på), zoom (zoom inn for å få kart), regner, feil
   eller ok */
export function planTall(): 'tom' | 'zoom' | 'regner' | 'feil' | 'ok' {
  const nr = valgtNr(),
    g = nr ? se(katalog.solv.grense, nr) : null;
  if (!nr || !g || g.status !== 'ok' || utenPlan()) return 'tom';
  const r = se(katalog.solv.planrutenett, nr);
  if (r) return r.status === 'henter' ? 'regner' : r.status;
  if (!oversikt()) return lagret(nr) ? 'tom' : 'zoom';
  return 'regner';
}

/* Planrutenettet regnes ut i nettleseren: planflisene på nivå 9 (21 meter per piksel) legges oppå dagens klasser, og pikslene telles.
   Med lagret oversiktsbilde gjelder det hele kommunen. Uten gjelder det den delen av kommunen nettleseren har hentet kart for, og
   tallene regnes ut på nytt hver gang det kommer mer kart. Det gir et anslag til illustrasjon, ikke offisiell statistikk. */
let regnNr = 0;
async function hentBlokk(tc: Flis, fliser: Flis[] | null): Promise<Blokk> {
  const [K, buf] = await Promise.all([
    dagensKlasser(tc),
    ingenPlan() ? null : katalog.bronse.planflis(kommuneplanUrl(flisUtsnitt(tc)))
  ]);
  if (!K) throw new Error('mangler dagens klasser');
  const P = buf
    ? await bildePiksler(buf, 512, 512)
    : new Uint8ClampedArray(512 * 512 * 4); /* uten plan: ingen piksler satt */
  return { ...tellBlokk(K, P, tc, fliser), utenPlan: !buf };
}
/* Samordner utregningen for valgt kommune: finner ut hva som kan regnes ut nå, regner ut blokkene som mangler, bygger rutenettet og
   legger det i katalogen. Uten plan og uten egne områder finnes det ikke noe planrutenett. */
async function regnPlan() {
  const mitt = ++regnNr,
    Z = PLANNIVA,
    nr = valgtNr(),
    g = nr ? se(katalog.solv.grense, nr) : null;
  if (!nr || !g || g.status !== 'ok') return endret();
  if (utenPlan()) {
    if (se(katalog.solv.planrutenett, nr)) {
      glem(katalog.solv.planrutenett, k => k === nr);
      utdaterGull(nr);
    }
    return endret();
  }
  const E = mine(),
    ov = oversikt();
  if (!ov) return endret();
  const dyn = !!ov.dynamisk,
    sm = dyn ? samlingen() : null;
  if (dyn && !sm) return;
  begynt(
    katalog.solv.planrutenett,
    nr,
    dyn
  ); /* nye tall i det sammensatte kartet erstatter de gamle uten at teksten blinker */
  /* Rutenettet bygges av blokker på 512 x 512 ruter, én per flis på nivå 9. En blokk regnes bare ut på nytt når det har kommet nye
     fliser innenfor den, så et nytt utsnitt koster én eller to blokker og ikke hele det hentede området. */
  const blokker = katalog.solv.planblokker.straks(nr, () => new Map<string, Blokk>()),
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
    if (mitt === regnNr) feilet(katalog.solv.planrutenett, nr);
    return;
  }
  if (mitt !== regnNr || nr !== valgtNr()) return;
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
  legg(katalog.solv.planrutenett, nr, { ...R, egneIder: E.map(x => x.id) });
}
/* Planrutenettet for valgt kommune regnes ut, hvis det kan. Et nytt planrutenett gjør gull for kommunen utdatert. */
export const regnAlt = () => regnPlan();
