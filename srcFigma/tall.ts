/* Tallene tvillingen viser, lest fra datamotoren for valgt kommune. Alt er regnet ut i src/data (gull, og sølv for SSBs arealklasser
   hver for seg). Her settes de bare sammen til det sidene trenger, og ingenting hentes eller regnes på nytt. Arealer er i km²,
   andeler i prosent, som i datamotoren. */
import type { Rad } from '../src/data/cache.ts';
import { summen } from '../src/data/generelt/tall.ts';
import type { Bildetall } from '../src/data/gull/felles.ts';
import type { TemaIPlan, Temaet } from '../src/data/gull/temaer.ts';
import { TEMATABELLER, katalog } from '../src/data/katalog.ts';
import { bildetallet, valgt, verdi } from '../src/data/motor/valgt.ts';
import type { Arealdetaljer } from '../src/data/solv/ssb.ts';

/* Et tall som hentes: henter, feil, ingen (kommunen har ikke noe av det) eller ok med verdien */
export type Svar<T> = { s: 'henter' } | { s: 'feil' } | { s: 'ingen' } | { s: 'ok'; v: T };
export const fraRad = <T>(r: Rad<T> | null): Svar<T> =>
  !r || r.status === 'henter' ? { s: 'henter' } : r.status === 'feil' ? { s: 'feil' } : { s: 'ok', v: r.verdi as T };

/* SSBs arealklasser hver for seg (solv.arealdetaljer), og summer over dem */
export const arealklasser = () => fraRad(valgt(katalog.solv.arealdetaljer));
type Klasse = Arealdetaljer['klasser'][number];
/* Arealet i år nummer t (0 er 2017, -1 er nyeste) for klassene som passer */
export function summer(D: Arealdetaljer, passer: (k: Klasse) => boolean, t = -1) {
  const i = t < 0 ? D.aar.length + t : t;
  return summen(D.klasser.filter(passer).map(k => k.km2[i]));
}
export const landet = (D: Arealdetaljer, t = -1) => summer(D, k => k.klasse !== 'vann', t);
export const SKOG = (k: Klasse) => k.kode.startsWith('17.');
export const MYR = (k: Klasse) => k.kode === '19';
/* Et areal i nyeste år og i 2017, med andelen av landarealet i nyeste år */
export function arealet(D: Arealdetaljer, passer: (k: Klasse) => boolean) {
  const na = summer(D, passer),
    for_ = summer(D, passer, 0);
  return { km2: na, km2Fra: for_, andel: (na / landet(D)) * 100, fra: D.aar[0], til: D.aar[D.aar.length - 1] };
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

/* Inngrepsfri natur og grått areal: bilder av kommunen, med ingen når kommunen ikke har noe */
function bilde<T>(r: Rad<Bildetall<T>> | null): Svar<T> {
  const B = bildetallet(r);
  return B.tilstand === 'ok' ? { s: 'ok', v: B as T } : { s: B.tilstand };
}
export const inon = () => bilde(valgt(katalog.gull.inon));
export const graa = () => bilde(valgt(katalog.gull.graa));
export const graaIPlan = () => verdi(katalog.gull.graaIPlan);

/* Utbredelsen fra SSB (natur, jordbruk, bebygd nå), forskjellen fra 2017, og planlagt utbygging */
export const utbredelse = () => fraRad(valgt(katalog.gull.utbredelse));
export const endring = () => verdi(katalog.gull.endring);
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
    case 'vatmark': {
      const A = arealklasser();
      return fra(A, D => {
        const a = arealet(D, id === 'skog' ? SKOG : MYR);
        return { km2: a.km2, andel: a.andel };
      });
    }
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
