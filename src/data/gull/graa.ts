/* Gull for grått areal: arealet per trinn i kommunen (gull.graa), og kryssingen med utbyggingen (gull.graakryss og gull.graaIPlan).
   Grått areal krysses med utbyggingen for seg, ikke som en kolonne, fordi det også teller planlagt utbygging der det alt er bebygd,
   og grønt i bebygd område. */
import { BLOKK, blokkAv, nummer } from '../generelt/glissen.ts';
import { katalog } from '../katalog.ts';
import { bitAv, flisnavn, ruteKm2, ruteX, ruteY, type Flis } from '../solv/felles.ts';
import { graaVed, type Graatrinn } from '../solv/graa.ts';
import { andel, arealFraRuter, bildetall, landareal, tellIBiter, tiDekar, type Kommunebilde } from './felles.ts';
import type { Utbygging } from './utbygging.ts';

/* Grått areal for kommunen: når det er hentet, areal per trinn (plass 1–6) i km² */
export type Graa = Kommunebilde<{ trinn: number[] }>;
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
   dag, og uten regelen om smale striper. Midtpunktet i hver rute slås opp i bitene av grått areal.
   gront er ruter som er bebygd i grunnkartet, men ikke grå: grønne arealer som parker og idrettsanlegg. R er utbyggingen, bit
   biten av grått areal med navnet (z/x/y), og delvis om bare en del av kommunen er hentet. */
export function kryssGraa(R: Utbygging, bit: (navn: string) => Graatrinn | undefined, delvis: boolean): Graakryss {
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
      EG = nE ? R.eget!.blokker.get(nokkel) : undefined,
      D = bit(flisnavn(blokkensBit(R, bx, by)));
    for (let q = 0; q < KL.length; q++) {
      const c = KL[q];
      if (c < 1 || c > 3) continue;
      const b = PL ? PL[q] : 0,
        ty = ET ? ET[q] : 0,
        s = ty === 1 ? 1 : ty === 2 ? 0 : b;
      if (c !== 1 && !b && !s) continue;
      const i = nummer(R.kl, bx * BLOKK + (q % BLOKK), by * BLOKK + Math.floor(q / BLOKK)),
        k = D ? graaVed(D, ruteX(R, i), ruteY(R, i)) : 0,
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

/* Biten blokken (bx, by) i utbyggingen R ligger i. En blokk i utbyggingen er en flis på nivå 10 og ligger i én bit. */
const blokkensBit = (R: Utbygging, bx: number, by: number): Flis => bitAv([R.z, bx, by]);
/* Bitene utbyggingen R har ruter i som krysses: bebygd i dag, eller med planlagt utbygging */
function biterIUtbygging(R: Utbygging): Flis[] {
  const ut = new Map<string, Flis>();
  for (const [nokkel, KL] of R.kl.blokker) {
    const [bx, by] = blokkAv(nokkel),
      PL = R.pl.blokker.get(nokkel),
      ET = R.egetType ? R.egetType.blokker.get(nokkel) : undefined;
    let noe = !!PL || !!ET;
    for (let q = 0; q < KL.length && !noe; q++) noe = KL[q] === 1;
    if (!noe) continue;
    const b = blokkensBit(R, bx, by);
    ut.set(flisnavn(b), b);
  }
  return [...ut.values()];
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
  const R = await katalog.gull.utbygging(nr);
  if (!R) return null;
  const B = new Map<string, Graatrinn>();
  for (const b of biterIUtbygging(R)) B.set(flisnavn(b), await katalog.solv.graabit(b));
  return kryssGraa(R, n => B.get(n), R.delvis);
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
  return { ...byggGraa({ nr, tilstand: 'ok', trinn: A.km2, sum: A.sum }, land), sum: A.sum, trinn: A.km2 };
}

/* Grått areal i villreinområdene: arealet av villreinområdene i kommunen (villrein), det grå arealet i dem (sum), og andelen av
   villreinområdene som er grå, i prosent */
export interface GraaIVillrein {
  villrein: number;
  sum: number;
  andel: number | null;
}
/* Tabellen gull.graaIVillrein: villreinområdene (solv.villrein) tegnet i bitene av grått areal (solv.graabit) og klippet mot
   kommunen, som inngrepsfri natur i villreinområdene (gull.inonIVillrein). En rute hører til villreinområdene når de dekker minst
   halve ruta. Alle trinnene er grått areal, også grått uten oppgitt andel vegetasjon. null når kommunen ikke har villreinområder. */
export async function graaIVillrein(nr: string): Promise<GraaIVillrein | null> {
  const [S, V, g] = await Promise.all([katalog.solv.graa(nr), katalog.solv.villrein(nr), katalog.solv.grense(nr)]);
  if (!V.omrader.length) return null;
  const T = await tellIBiter(
      S.biter,
      tc => katalog.solv.graabit(tc).then(D => D.kl),
      V.omrader,
      g.koord,
      1,
      v => (v > 0 ? 0 : null),
      0
    ),
    sum = tiDekar((T.n[0] * S.res * S.res) / S.skala),
    villrein = tiDekar((T.alle * S.res * S.res) / S.skala);
  return { villrein, sum, andel: andel(sum, villrein) };
}

/* Grønne arealer i bebyggelse: grått areal med minst halvparten vegetasjon (de to øverste trinnene i kartet over grå arealer, laget
   «andel med vegetasjon»), arealet og andelen av det grå arealet og av landarealet */
export interface GronneArealer {
  km2: number;
  andelAvGraa: number | null;
  andelLand: number | null;
}
/* Tabellen gull.gronneArealer: grønne arealer i bebyggelse i kommunen nr, av gull.graa (trinn 4 og 5, 50–100 % vegetasjon) */
export async function gronneArealer(nr: string): Promise<GronneArealer> {
  const [G, land] = await Promise.all([katalog.gull.graa(nr), landareal(nr)]),
    km2 = tiDekar((G.trinn[4] || 0) + (G.trinn[5] || 0));
  return { km2, andelAvGraa: andel(km2, G.sum), andelLand: andel(km2, land) };
}
