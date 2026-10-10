/* Gull for grått areal: arealet per trinn i kommunen (gull.graa), og kryssingen med utbyggingen (gull.graakryss og gull.graaIPlan).
   Grått areal krysses med utbyggingen for seg, ikke som en kolonne, fordi det også teller planlagt utbygging der det alt er bebygd,
   og grønt i bebygd område. */
import { katalog } from '../katalog.ts';
import { RUTE, ruteX, ruteY } from '../solv/felles.ts';
import { graaVed, type Graatrinn } from '../solv/graa.ts';
import { andel, arealFraRuter, bildetall, landareal, type Kommunebilde } from './felles.ts';
import type { Utbygging } from './utbygging.ts';

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
   gront er ruter som er bebygd i grunnkartet, men ikke grå: grønne arealer som parker og idrettsanlegg. R er utbyggingen, D
   resultatet av tolkGraa og delvis om bare en del av kommunen er hentet. */
export function kryssGraa(R: Utbygging, D: Graatrinn, delvis: boolean): Graakryss {
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

/* Det temasiden, oversikten og kartet viser: tilstanden, arealet samlet og per trinn, og andelen av landarealet. D er grått areal
   for kommunen og land landarealet i km². */
export function byggGraa(D: Graa | null, land: number) {
  return bildetall(D, H => ({ sum: H.sum, trinn: H.trinn, andelLand: andel(H.sum, land) }));
}
/* Det temasiden viser fra kryssingen K med utbyggingen: grønt i bebygd område, og planlagt utbygging på grått areal */
export function byggGraaIPlan(K: Graakryss) {
  return {
    gront: { km2: K.gront * RUTE, delvis: K.delvis },
    plan: K.S.tot
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
  };
}

/* Tabellen gull.graakryss: planlagt utbygging krysset med grått areal i kommunen nr. null uten utbygging. */
export async function graakryss(nr: string): Promise<Graakryss | null> {
  const [R, D] = await Promise.all([katalog.gull.utbygging(nr), katalog.solv.graa(nr)]);
  return R ? kryssGraa(R, D, R.delvis) : null;
}
/* Tabellen gull.graaIPlan: det temasiden viser fra kryssingen, se byggGraaIPlan. null uten utbygging. */
export type GraaIPlan = ReturnType<typeof byggGraaIPlan>;
export async function graaIPlan(nr: string): Promise<GraaIPlan | null> {
  const K = await katalog.gull.graakryss(nr);
  return K ? byggGraaIPlan(K) : null;
}
/* Tabellen gull.graa: det temasiden, oversikten og kartet viser for kommunen nr: ok med tallene, eller ingen når kartet over grå
   arealer ikke har noe i kommunen. Arealet samlet (sum) og per trinn (trinn) står med uansett. */
export type Graavisning = ReturnType<typeof byggGraa> & { sum: number; trinn: number[] };
export async function graa(nr: string): Promise<Graavisning> {
  const [S, land] = await Promise.all([katalog.solv.graa(nr), landareal(nr)]),
    A = arealFraRuter(S.n, S.res, S.skala);
  return { ...byggGraa({ ...S, nr, tilstand: 'ok', trinn: A.km2, sum: A.sum }, land), sum: A.sum, trinn: A.km2 };
}
