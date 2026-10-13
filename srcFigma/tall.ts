/* Tallene tvillingen viser, lest fra datamotoren for valgt kommune. Alt er regnet ut i gull (src/data/gull). Her slås tabellene bare
   opp, med tilstanden (henter, feil, ingen, mangler eller ok), og ingenting hentes eller regnes ut. Arealer er i km², andeler i
   prosent, som i datamotoren. Svarene fra grunnkartet med detaljklassene finnes bare for kommunene der detaljklassene er lagret. */
import type { Rad, Tabell } from '../src/data/cache.ts';
import type { Bildetall } from '../src/data/gull/felles.ts';
import type { PlanPerOkosystem } from '../src/data/gull/okosystemer.ts';
import type { TemaIPlan, Temaet } from '../src/data/gull/temaer.ts';
import { TEMATABELLER, katalog } from '../src/data/katalog.ts';
import { bildetallet, valgt, verdi } from '../src/data/motor/valgt.ts';

/* Et tall som hentes: henter, feil, ingen (kommunen har ikke noe av det), mangler (ikke regnet ut for kommunen, og hvorfor) eller
   ok med verdien */
export type Svar<T> =
  { s: 'henter' } | { s: 'feil' } | { s: 'ingen' } | { s: 'mangler'; hvorfor: string } | { s: 'ok'; v: T };
export const fraRad = <T>(r: Rad<T> | null): Svar<T> =>
  !r || r.status === 'henter' ? { s: 'henter' } : r.status === 'feil' ? { s: 'feil' } : { s: 'ok', v: r.verdi as T };

/* Svarene fra grunnkartet med detaljklassene (gull/okosystemer.ts). De mangler når kommunen ikke har lagrede detaljklasser (svaret
   er null). Planlagt utbygging per økosystemtype er ingen når kommunen ikke har planlagt utbygging. */
function fraGrunnkart<T>(t: Tabell<string, T | null>): Svar<T> {
  const S = fraRad(valgt(t));
  if (S.s !== 'ok') return S;
  return S.v ? { s: 'ok', v: S.v } : { s: 'mangler', hvorfor: 'Regnet ut bare for Trondheim foreløpig' };
}
/* Svarene som bygger på dagens klasser for hele kommunen (de syntetiske tabellene): mangler til kartet for kommunen er hentet */
function fraKartet<T>(t: Tabell<string, T | null>): Svar<T> {
  const S = fraRad(valgt(t));
  if (S.s !== 'ok') return S;
  return S.v ? { s: 'ok', v: S.v } : { s: 'mangler', hvorfor: 'Regnes ut når kartet for kommunen er hentet' };
}
export const skog = () => fraGrunnkart(katalog.gull.skog);
export const vatmark = () => fraGrunnkart(katalog.gull.vatmark);
export const vernetNatur = () => fraGrunnkart(katalog.gull.vernetNatur);
export function planPerOkosystem(): Svar<PlanPerOkosystem> {
  const S = fraGrunnkart(katalog.gull.planPerOkosystem);
  return S.s === 'ok' && S.v.ingenPlan ? { s: 'ingen' } : S;
}

/* Naturtemaene fra Miljødirektoratet: temaet (gull) og planlagt utbygging i det, når planen er regnet ut for de samme områdene */
export function naturtema(id: 'vern' | 'rein' | 'verdi') {
  const tab = TEMATABELLER[id],
    T = fraRad(valgt(tab.tall)),
    I = valgt(tab.iPlan);
  return { T, plan: T.s === 'ok' ? planIn(T.v, I) : null };
}
const planIn = (T: Temaet, I: Rad<TemaIPlan | null> | null) =>
  I && I.status === 'ok' && I.verdi && I.verdi.omrader === T.omrader ? I.verdi.N : null;
/* Kartleggingen av verdsatt natur */
export const kartleggingen = () => fraRad(valgt(TEMATABELLER.verdi.kartlagt!));
/* Naturtemaene gruppert: vernet areal per verneform, villreinområdene med andelen, og verdsatt natur per naturtype */
export const vernPerVerneform = () => fraRad(valgt(katalog.gull.vernPerVerneform));
export const villreinPerOmrade = () => fraRad(valgt(katalog.gull.villreinPerOmrade));
export const verdsattPerNaturtype = () => fraRad(valgt(katalog.gull.verdsattPerNaturtype));

/* Inngrepsfri natur og grått areal: bilder av kommunen, med ingen når kommunen ikke har noe */
function bilde<T>(r: Rad<Bildetall<T>> | null): Svar<T> {
  const B = bildetallet(r);
  return B.tilstand === 'ok' ? { s: 'ok', v: B as T } : { s: B.tilstand };
}
export const inon = () => bilde(valgt(katalog.gull.inon));
/* Inngrepsfri natur i villreinområdene (gull.inonIVillrein), med ingen når kommunen ikke har villreinområder */
export function inonIVillrein() {
  const S = fraRad(valgt(katalog.gull.inonIVillrein));
  return S.s === 'ok' && !S.v ? ({ s: 'ingen' } as const) : S;
}
export const graa = () => bilde(valgt(katalog.gull.graa));
export const graaIPlan = () => verdi(katalog.gull.graaIPlan);

/* Kortene på oversikten (natur, jordbruk, bebygd nå og endringen fra 2017) og nedbyggingen per landklasse, fra de syntetiske
   tabellene. De bebygde klassene som økte mest og regnskapsoppstillingen, fra SSB. Og planlagt utbygging. */
export const oversiktKort = () => fraKartet(katalog.gull.oversiktKort);
export const nedbygging = () => fraKartet(katalog.gull.nedbygging);
export const bebygdOkning = () => verdi(katalog.gull.bebygdOkning);
export const oppstilling = () => fraRad(valgt(katalog.gull.oppstilling));
export const plansum = () => verdi(katalog.gull.plansum);
export const planlagt = () => verdi(katalog.gull.planlagt);
export const kommuneplan = () => verdi(katalog.gull.kommuneplan);

/* Det flisene under «Utforsk naturen» viser for hvert tema: arealet og andelen av landarealet, eller hvordan det går */
export function temaflis(id: string): Svar<{ km2: number; andel: number | null }> {
  const fra = <T>(
    S: Svar<T>,
    f: (v: T) => { km2: number; andel: number | null }
  ): Svar<{ km2: number; andel: number | null }> => (S.s === 'ok' ? { s: 'ok', v: f(S.v) } : S);
  switch (id) {
    case 'skog':
      return fra(skog(), v => ({ km2: v.km2, andel: v.andel }));
    case 'vatmark':
      return fra(vatmark(), v => ({ km2: v.km2, andel: v.andel }));
    case 'verneomrader':
    case 'villrein':
    case 'verdsatte-naturtyper': {
      const T = naturtema(id === 'verneomrader' ? 'vern' : id === 'villrein' ? 'rein' : 'verdi').T;
      return T.s === 'ok' && !T.v.antall ? { s: 'ingen' } : fra(T, v => ({ km2: v.sum, andel: v.andelLand }));
    }
    case 'inngrepsfri-natur':
      return fra(inon(), v => ({ km2: v.sum, andel: v.andelLand }));
    case 'bynatur':
      return fra(graa(), v => ({ km2: v.sum, andel: v.andelLand }));
  }
  return { s: 'ingen' };
}
