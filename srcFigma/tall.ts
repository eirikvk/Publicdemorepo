/* Tallene tvillingen viser, lest fra datamotoren for valgt kommune. Alt er regnet ut i gull (src/data/gull). Her slås tabellene bare
   opp, med tilstanden (henter, feil, ingen, mangler eller ok), og ingenting hentes eller regnes ut. Arealer er i km², andeler i
   prosent, som i datamotoren. Svarene fra grunnkartet med detaljklassene finnes bare for kommunene der detaljklassene er lagret. */
import type { Rad, Tabell } from '../src/data/cache.ts';
import type { Bildetall } from '../src/data/gull/felles.ts';
import type { PlanPerOkosystem } from '../src/data/gull/okosystemer.ts';
import type { Sammenligning } from '../src/data/gull/syntetisk.ts';
import type { TemaIPlan, Temaet } from '../src/data/gull/temaer.ts';
import { TEMATABELLER, katalog } from '../src/data/katalog.ts';
import { bildetallet, valgt, verdi } from '../src/data/motor/valgt.ts';

/* Et tall som hentes: henter, feil, ingen (kommunen har ikke noe av det), mangler (ikke regnet ut for kommunen, og hvorfor) eller
   ok med verdien */
export type Svar<T> =
  { s: 'henter' } | { s: 'feil' } | { s: 'ingen' } | { s: 'mangler'; hvorfor: string } | { s: 'ok'; v: T };
export const fraRad = <T>(r: Rad<T> | null): Svar<T> =>
  !r || r.status === 'henter' ? { s: 'henter' } : r.status === 'feil' ? { s: 'feil' } : { s: 'ok', v: r.verdi as T };

/* Svarene fra grunnkartet med detaljklassene (gull/okosystemer.ts). Er detaljklassene ikke lagret for kommunen, hentes de fra NIBIO,
   og da tar det litt tid. De mangler bare når kommunen ikke har noen blokker (svaret er null). Planlagt utbygging per økosystemtype
   er ingen når kommunen ikke har planlagt utbygging. */
function fraGrunnkart<T>(t: Tabell<string, T | null>): Svar<T> {
  const S = fraRad(valgt(t));
  if (S.s !== 'ok') return S;
  return S.v ? { s: 'ok', v: S.v } : { s: 'mangler', hvorfor: 'Kunne ikke regnes ut for kommunen' };
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
/* Grått areal i villreinområdene (gull.graaIVillrein), med ingen når kommunen ikke har villreinområder */
export function graaIVillrein() {
  const S = fraRad(valgt(katalog.gull.graaIVillrein));
  return S.s === 'ok' && !S.v ? ({ s: 'ingen' } as const) : S;
}
/* Grønne arealer i bebyggelse (gull.gronneArealer) */
export const gronneArealer = () => fraRad(valgt(katalog.gull.gronneArealer));
/* Lokalitetene i verdsatt natur som skal vurderes per lokalitet eller per naturtype (gull.verdsattVurderes) */
export const verdsattVurderes = () => fraRad(valgt(katalog.gull.verdsattVurderes));
/* Verneområdene med gruppen for verneformen (gull.verneformer) */
export const verneformer = () => fraRad(valgt(katalog.gull.verneformer));
export const graaIPlan = () => verdi(katalog.gull.graaIPlan);

/* Kortene på oversikten (natur, jordbruk, bebygd nå og endringen fra 2017), nedbyggingen per landklasse og regnskapet per
   hovedøkosystem, fra de syntetiske tabellene. Og planlagt utbygging. */
export const oversiktKort = () => fraRad(valgt(katalog.gull.oversiktKort));
export const nedbygging = () => fraRad(valgt(katalog.gull.nedbygging));
export const okosystemregnskap = () => fraRad(valgt(katalog.gull.okosystemregnskap));
/* Kommunen sammenlignet med resten av Norge, fra de syntetiske tabellene for alle kommunene. Ingen når kommunen ikke er med. */
export function sammenligning(): Svar<Sammenligning> {
  const S = fraRad(valgt(katalog.gull.sammenligning));
  return S.s === 'ok' && !S.v ? { s: 'ingen' } : (S as Svar<Sammenligning>);
}
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
    /* Andelen vernet er bare land: grunnkartets land innenfor verneområdene av landarealet (avklart 15. oktober). Arealet er alt
       som er vernet, også sjø. */
    case 'verneomrader': {
      const T = naturtema('vern').T,
        V = vernetNatur();
      if (T.s === 'ok' && !T.v.antall) return { s: 'ingen' };
      return T.s === 'ok'
        ? fra(V, v => ({ km2: T.v.sum, andel: v.andelLand }))
        : fra(T, () => ({ km2: 0, andel: null }));
    }
    case 'villrein':
    case 'verdsatte-naturtyper': {
      const T = naturtema(id === 'villrein' ? 'rein' : 'verdi').T;
      return T.s === 'ok' && !T.v.antall ? { s: 'ingen' } : fra(T, v => ({ km2: v.sum, andel: v.andelLand }));
    }
    case 'inngrepsfri-natur':
      return fra(inon(), v => ({ km2: v.sum, andel: v.andelLand }));
    case 'bynatur':
      return fra(graa(), v => ({ km2: v.sum, andel: v.andelLand }));
  }
  return { s: 'ingen' };
}
