/* Tallene tvillingen viser, lest fra datamotoren for valgt kommune. Alt er regnet ut i gull (src/data/gull). Her slås tabellene bare
   opp, med tilstanden (henter, feil, ingen, mangler eller ok), og ingenting hentes eller regnes ut. Arealer er i km², andeler i
   prosent, som i datamotoren. Svarene fra grunnkartet med detaljklassene finnes bare for kommunene der detaljklassene er lagret. */
import type { Rad, Tabell } from '../src/data/cache.ts';
import type { EgenRad } from '../src/data/gull/egne.ts';
import type { Bildetall } from '../src/data/gull/felles.ts';
import type { Landssammenligning } from '../src/data/gull/landstall.ts';
import type { PlanPerOkosystem } from '../src/data/gull/okosystemer.ts';
import type { Sammenligning } from '../src/data/gull/naturregnskap.ts';
import type { TemaIPlan, Temaet } from '../src/data/gull/temaer.ts';
import { TEMATABELLER, katalog } from '../src/data/katalog.ts';
import { egneRutenett, mine } from '../src/data/motor/egne.ts';
import { planTall } from '../src/data/motor/plan.ts';
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
/* Naturtemaene gruppert: vernet areal per verneform på land og i sjø (fra grunnkartet, så det kan mangle som svarene over),
   villreinområdene med andelen, og verdsatt natur per naturtype */
export const vernLandSjo = () => fraGrunnkart(katalog.gull.vernLandSjo);
export const villreinPerOmrade = () => fraRad(valgt(katalog.gull.villreinPerOmrade));
export const verdsattPerNaturtype = () => fraRad(valgt(katalog.gull.verdsattPerNaturtype));

/* Inngrepsfri natur og grått areal: bilder av kommunen, med ingen når kommunen ikke har noe */
function bilde<T>(r: Rad<Bildetall<T>> | null): Svar<T> {
  const B = bildetallet(r);
  return B.tilstand === 'ok' ? { s: 'ok', v: B as T } : { s: B.tilstand };
}
export const inon = () => bilde(valgt(katalog.gull.inon));
/* Inngrepsfri natur for hvert år Miljødirektoratet har status for (gull.inonUtvikling). Regnes først når siden spør, så den leses bare
   på siden for inngrepsfri natur. */
export const inonUtvikling = () => fraRad(valgt(katalog.gull.inonUtvikling));
/* Det samme i villreinområdene (gull.inonIVillreinUtvikling), med ingen når kommunen ikke har villreinområder */
export function inonIVillreinUtvikling() {
  const S = fraRad(valgt(katalog.gull.inonIVillreinUtvikling));
  return S.s === 'ok' && !S.v ? ({ s: 'ingen' } as const) : S;
}
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

/* Natur, jordbruk og bebygd nå og endringen fra 2017 (kortene på oversikten), nedbyggingen per landklasse og regnskapet per
   hovedøkosystem, fra de syntetiske tabellene, de samme som hovedsiden bruker. Og planlagt utbygging. */
export const utbredelse = () => fraRad(valgt(katalog.gull.utbredelse));
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

/* Kommunen mot Norge fra tallene for alle kommunene, regnet ut på forhånd (gull.landssammenligning): kommunens del av
   villreinområdene, plassen på kartleggingsgrad og inngrepsfri natur, gjennomsnittet for temaene og arealet av naturtypene i Norge.
   Regnes først når siden spør. */
export const landssammenligning = (): Svar<Landssammenligning> => fraRad(valgt(katalog.gull.landssammenligning));
/* Andelen av landarealet i Norge for temaet id under «Utforsk naturen», fra tallene for alle kommunene. Skog og våtmark har sine
   egne tall fra SSB (gull.sammenligning). null når temaet ikke har et tall for Norge. */
export const SNITT: Record<string, keyof Landssammenligning['snitt']> = {
  verneomrader: 'vern',
  villrein: 'villrein',
  'verdsatte-naturtyper': 'verdsatt',
  'inngrepsfri-natur': 'inon',
  bynatur: 'graa'
};

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

/* Egne områder i valgt kommune (tegnet eller lastet opp) og sammenligningen med kommuneplanen (gull.egneRader og
   gull.egneOkosystemer). Radene er de samme analysene for kommuneplanen alene (plan) og planen med egne områder (ny), og
   forskjellen (endring). rader er null til utbyggingen er regnet ut med områdene som finnes nå. Fordelingen per økosystemtype (oko)
   kan komme senere enn resten, fordi grunnkartet med detaljklassene kan måtte hentes fra NIBIO, og venter sier at den regnes ut (ikke
   når utbyggingen feilet). */
export function egne() {
  const omrader = mine(),
    R = egneRutenett(),
    rader = R ? verdi(katalog.gull.egneRader) : null,
    O = R ? valgt(katalog.gull.egneOkosystemer) : null;
  return {
    omrader,
    rader,
    oko: O && O.status === 'ok' ? O.verdi : null,
    venter: omrader.length > 0 && (!O || O.status === 'henter') && planTall() !== 'feil'
  };
}
/* Raden i sammenligningen for hele kommunen med fargen farge (pnat for natur, graa2 for grått areal, vern for verneområdene og så
   videre), når den er regnet ut */
export const egenRad = (farge: string): EgenRad | null => {
  const R = egne().rader;
  return (R && R.kommune.find(r => r.farge === farge)) || null;
};
