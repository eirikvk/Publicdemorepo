/* Gull for grått areal: arealet per trinn i kommunen, og kryssingen med planrutenettet. */
import { RUTE, ruteX, ruteY } from '../solv/felles.ts';
import { graaVed, type Graatrinn } from '../solv/graa.ts';
import type { Planrutenett } from '../solv/planrutenett.ts';
import { andel, bildetall, type Kommunebilde } from './felles.ts';

/* Grått areal for kommunen: når det er hentet, areal per trinn (plass 1–6) i km², og trinnet per rute i kommunebildet */
export type Graa = Kommunebilde<{ kl: Uint8Array; trinn: number[] }>;
/* Ruter med planlagt utbygging på land (tot), på grått areal (graa), på grått areal med minst halvparten vegetasjon (gron), og på
   grønt i bebygd område (gront) */
export interface Graatall {
  tot: number;
  graa: number;
  gron: number;
  gront: number;
}
/* Kryssingen for planen med egne områder (S) og planen alene (P), for hele kommunen og per eget område (eg) */
export interface Graakryss {
  nr: string;
  S: Graatall & { eg: Graatall[] };
  P: Graatall & { eg: Graatall[] };
  bebygd: number;
  gront: number;
  antallEgne: number;
  delvis: boolean;
}

/* Planlagt utbygging krysset med grått areal: hvor mye av all planlagt utbygging på land som ligger på areal som alt er grått, altså
   gjenbruk, og hvor mye av det som er minst halvparten vegetasjon (trinn 4 og 5). Regnes for planen med egne områder (S) og planen
   alene (P), for hele kommunen og per eget område. Her er alle ruter med planlagt utbygging på land med, også der det er bebygd i
   dag, og uten regelen om smale striper. Midtpunktet i hver rute slås opp i bildet av grått areal.
   gront er ruter som er bebygd i grunnkartet, men ikke grå: grønne arealer som parker og idrettsanlegg. R er planrutenettet, D
   resultatet av tolkGraa og delvis om bare en del av kommunen er hentet. */
export function kryssGraa(R: Planrutenett, D: Graatrinn, delvis: boolean): Graakryss {
  const nE = R.egetType ? R.antallEgne : 0,
    tom = (): Graatall => ({ tot: 0, graa: 0, gron: 0, gront: 0 }),
    ny = () => ({ ...tom(), eg: Array.from({ length: nE }, tom) }),
    S = ny(),
    P = ny();
  const en = (x: Graatall, k: number, c: number) => {
      x.tot++;
      if (k) x.graa++;
      else if (c === 1) x.gront++;
      if (k === 4 || k === 5) x.gron++;
    },
    legg = (T: Graatall & { eg: Graatall[] }, e: number, k: number, c: number) => {
      en(T, k, c);
      if (e) en(T.eg[e - 1], k, c);
    };
  let bebygd = 0,
    gront = 0;
  for (let i = 0; i < R.kl.length; i++) {
    const c = R.kl[i];
    if (c < 1 || c > 3) continue;
    const b = R.pl[i],
      ty = nE ? R.egetType![i] : 0,
      s = ty === 1 ? 1 : ty === 2 ? 0 : b;
    if (c !== 1 && !b && !s) continue;
    const k = graaVed(D, ruteX(R, i), ruteY(R, i)),
      e = nE ? R.eget![i] : 0;
    if (c === 1) {
      bebygd++;
      if (!k) gront++;
    }
    if (s) legg(S, e, k, c);
    if (b) legg(P, e, k, c);
  }
  return { nr: R.nr, S, P, bebygd, gront, antallEgne: nE, delvis };
}

/* Det temasiden og oversikten viser: tilstanden, arealet samlet og per trinn, andelen av landarealet, grønt i bebygd område og
   planlagt utbygging på grått areal. D er grått areal for kommunen, K kryssingen med planen (eller null) og land landarealet i km². */
export function byggGraa(D: Graa | null, K: Graakryss | null, land: number) {
  return bildetall(D, H => ({
    sum: H.sum,
    trinn: H.trinn,
    andelLand: andel(H.sum, land),
    gront: K ? { km2: K.gront * RUTE, delvis: K.delvis } : null,
    plan:
      K && K.S.tot
        ? {
            km2: K.S.tot * RUTE,
            graa: K.S.graa * RUTE,
            gron: K.S.gron * RUTE,
            gront: K.S.gront * RUTE,
            andelGraa: andel(K.S.graa, K.S.tot),
            delvis: K.delvis,
            antallEgne: K.antallEgne
          }
        : null
  }));
}
