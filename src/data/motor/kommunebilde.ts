/* Datamotoren, felles for temaene som hentes som ett bilde av hele kommunen: inngrepsfri natur og grått areal. Flyten er den samme
   for begge, og står bare her:
   1. Er kommunen valgt før, brukes resultatet fra da. Resultatene for de tre siste kommunene huskes så lenge siden er åpen.
   2. Ellers hentes bildene av kommunen i rutenettet BILDE_TEMA (bronse), og kommunens flate tegnes i samme rutenett som maske.
   3. Bildene tolkes til klasse per rute og antall ruter per klasse innenfor kommunen (sølv), og antallet regnes om til areal
      avrundet til nærmeste 10 dekar (gull).
   4. Resultatet legges i tilstanden. Svar som kommer etter at en annen kommune er valgt, kastes.
   Det som er eget for hvert tema, gis inn som et oppsett, se inon.ts og graa.ts. */
import { arealFraRuter, type Bildetema } from '../gull/felles.ts';
import { husk } from '../generelt/minne.ts';
import { BILDE_TEMA, m2PerKm2, rutenett, type Kommune, type Piksler, type Rutebilde } from '../solv/felles.ts';
import { bildePiksler, flatePiksler } from '../solv/raster.ts';
import { endret, tidSlutt, valgNr, type Grense } from './tilstand.ts';

/* Resultatet for et tema i én kommune: mens det hentes eller når det feilet, bare tilstanden. Når det er hentet, også rutenettet,
   arealet samlet (sum) og det som er eget for temaet (E). */
export type Kommunebilde<E> = Bildetema | (Bildetema & Rutebilde & E);

/* Det som er eget for hvert tema. S er det sølv gir for bildene, med antall ruter per klasse (n), og E det som legges i tilstanden
   i tillegg til arealet samlet og rutenettet. */
export interface Oppsett<S extends { n: ArrayLike<number> }, E> {
  navn: string /* i tidtakingen */;
  hent: (k: Kommune, R: Rutebilde) => Promise<ArrayBuffer[]> /* bildene av kommunen, fra bronse */;
  tolk: (bilder: Piksler[], maske: Piksler) => S /* bildene og kommunens maske tolket i sølv */;
  resultat: (S: S, km2: number[]) => E /* det som er eget for temaet, med arealet per klasse i km² */;
  sett: (D: Kommunebilde<E>) => void /* legger resultatet i tilstanden */;
  ferdig: () => void /* når resultatet er lagt i tilstanden, også fra minnet */;
}

/* Gir funksjonen som sjekker temaet for kommunen k med grensen grense. mitt er nummeret på valget, se valgNr. */
export function kommunebilde<S extends { n: ArrayLike<number> }, E>(o: Oppsett<S, E>) {
  const minne = new Map<string, Kommunebilde<E>>();
  return async (k: Kommune, grense: Grense, mitt: number) => {
    const har = minne.get(k.nr);
    if (har) {
      husk(minne, k.nr, har, 3);
      o.sett(har);
      o.ferdig();
      return;
    }
    o.sett({ nr: k.nr, tilstand: 'henter' });
    endret();
    try {
      const R = rutenett(grense.ext, ...BILDE_TEMA);
      const bilder = await o.hent(k, R);
      if (mitt !== valgNr) return;
      const t0 = performance.now(),
        P: Piksler[] = [];
      for (const b of bilder) P.push(await bildePiksler(b, R.w, R.h));
      const S = o.tolk(P, flatePiksler(grense.koord, R)),
        A = arealFraRuter(S.n, R.res, m2PerKm2(grense.ext)),
        D: Bildetema & Rutebilde & E = { nr: k.nr, tilstand: 'ok', ...o.resultat(S, A.km2), sum: A.sum, ...R };
      o.sett(D);
      husk(minne, k.nr, D, 3);
      tidSlutt(o.navn + ', kommunebilde', t0);
    } catch (e) {
      if (mitt !== valgNr) return;
      o.sett({ nr: k.nr, tilstand: 'feil' });
    }
    o.ferdig();
  };
}
