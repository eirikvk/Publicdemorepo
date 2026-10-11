/* Gull for grått areal: arealet per trinn i kommunen (gull.graa), og kryssingen med utbyggingen (gull.graakryss og gull.graaIPlan).
   Grått areal krysses med utbyggingen for seg, ikke som en kolonne, fordi det også teller planlagt utbygging der det alt er bebygd,
   og grønt i bebygd område. */
import { BLOKK, blokkAv, nummer } from '../generelt/glissen.ts';
import { katalog } from '../katalog.ts';
import { ruteKm2, ruteX, ruteY } from '../solv/felles.ts';
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
  ruteKm2: number;
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
  /* Blokk for blokk: dagens klasser har alle blokkene, planen og egne områder bare dem de har noe i */
  for (const [nokkel, KL] of R.kl.blokker) {
    const [bx, by] = blokkAv(nokkel),
      PL = R.pl.blokker.get(nokkel),
      ET = nE ? R.egetType!.blokker.get(nokkel) : undefined,
      EG = nE ? R.eget!.blokker.get(nokkel) : undefined;
    for (let q = 0; q < KL.length; q++) {
      const c = KL[q];
      if (c < 1 || c > 3) continue;
      const b = PL ? PL[q] : 0,
        ty = ET ? ET[q] : 0,
        s = ty === 1 ? 1 : ty === 2 ? 0 : b;
      if (c !== 1 && !b && !s) continue;
      const i = nummer(R.kl, bx * BLOKK + (q % BLOKK), by * BLOKK + Math.floor(q / BLOKK)),
        k = graaVed(D, ruteX(R, i), ruteY(R, i)),
        e = EG ? EG[q] : 0;
      if (c === 1) {
        bebygd++;
        if (!k) gront++;
      }
      if (s) legg(S, e, k, c);
      if (b) legg(P, e, k, c);
    }
  }
  return { nr: R.nr, S, P, bebygd, gront, antallEgne: nE, delvis, ruteKm2: ruteKm2(R.z) };
}

/* Det temasiden, oversikten og kartet viser: tilstanden, arealet samlet og per trinn, og andelen av landarealet. D er grått areal
   for kommunen og land landarealet i km². */
export function byggGraa(D: Graa | null, land: number) {
  return bildetall(D, H => ({ sum: H.sum, trinn: H.trinn, andelLand: andel(H.sum, land) }));
}
/* Det temasiden viser fra kryssingen K med utbyggingen: grønt i bebygd område, og planlagt utbygging på grått areal */
export function byggGraaIPlan(K: Graakryss) {
  return {
    gront: { km2: K.gront * K.ruteKm2, delvis: K.delvis },
    plan: K.S.tot
      ? {
          km2: K.S.tot * K.ruteKm2,
          graa: K.S.graa * K.ruteKm2,
          gron: K.S.gron * K.ruteKm2,
          gront: K.S.gront * K.ruteKm2,
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
