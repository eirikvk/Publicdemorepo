/* Gull for grått areal: arealet per trinn i kommunen, regnet én gang og lagret (gull.graaAreal), det temasiden viser (gull.graa), og
   kryssingen med utbyggingen (gull.graakryss og gull.graaIPlan).
   Grått areal krysses med utbyggingen for seg, ikke som en kolonne, fordi det også teller planlagt utbygging der det alt er bebygd,
   og grønt i bebygd område. Kryssingen regnes for et utvalg av utbyggingen (Utvalg i gull/utbygging.ts): den nye planen eller den
   gamle, i hele kommunen eller i ett eget område, med den samme funksjonen. Nøkkelen er utvalget, som 5001 eller 5001/gammel. */
import { HEL, andelVed } from '../generelt/dekning.ts';
import { BLOKK, blokkAv, nummer } from '../generelt/glissen.ts';
import { egenKopi } from '../generelt/kopi.ts';
import { katalog } from '../katalog.ts';
import { bitAv, flisnavn, ruteKm2, ruteX, ruteY, type Flis } from '../solv/felles.ts';
import { graaVed, type Graatrinn } from '../solv/graa.ts';
import { BITRES, tellIBitene, tellIKommune } from '../solv/kommune.ts';
import { andel, arealFraRuter, bildetall, landareal, tiDekar, type Kommunebilde } from './felles.ts';
import { lesUtvalg, type Utbygging, type Utvalg } from './utbygging.ts';

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
/* Kryssingen for et utvalg (tall), og for hele kommunen det som er bebygd (bebygd) og grønt i bebygd område (gront), uansett plan */
export interface Graakryss {
  nr: string;
  tall: Graatall;
  bebygd: number;
  gront: number;
  antallEgne: number;
  ruteKm2: number;
}

/* Planlagt utbygging krysset med grått areal: hvor mye av all planlagt utbygging på land som ligger på areal som alt er grått, altså
   gjenbruk, og hvor mye av det som er minst halvparten vegetasjon (trinn 4 og 5). Regnes for planen og rutene i utvalget U. Her er
   alle ruter med planlagt utbygging på land med, også der det er bebygd i dag, og uten regelen om smale striper: i den gamle planen
   kommuneplanen (pl), og i den nye det samme med egne områder oppå (et område som utbygging tar all land i ruta, og som ikke
   utbygging ingen). Midtpunktet i hver rute slås opp i bitene av grått areal.
   For hele kommunen telles også det som er bebygd i grunnkartet, og gront: ruter som er bebygd, men ikke grå, altså grønne arealer som
   parker og idrettsanlegg. R er utbyggingen, og bit biten av grått areal med navnet (z/x/y). */
export function kryssGraa(
  U: Pick<Utvalg, 'R' | 'plan' | 'omrade'>,
  bit: (navn: string) => Graatrinn | undefined,
  utenBebygd = false
): Graakryss {
  const R = U.R,
    nE = R.egetType ? R.antallEgne : 0,
    ny = U.plan === 'ny',
    o = U.omrade,
    /* bebygd og grønt i bebygd telles for hele kommunen, når den som kaller, ikke har dem fra før (utenBebygd) */
    helKommune = o === null && !utenBebygd,
    tall: Graatall = { tot: 0, graa: 0, gron: 0, gront: 0 };
  let bebygd = 0,
    gront = 0;
  /* Blokk for blokk: dagens klasser har alle blokkene, planen og egne områder bare dem de har noe i. For et eget område trengs bare
     blokkene området har ruter i. */
  for (const [nokkel, KL] of R.kl.blokker) {
    const EG = nE ? R.eget!.blokker.get(nokkel) : undefined;
    if (o !== null && !EG) continue;
    const PL = R.pl.blokker.get(nokkel),
      ET = nE && ny ? R.egetType!.blokker.get(nokkel) : undefined;
    if (!PL && !ET && !helKommune) continue;
    const [bx, by] = blokkAv(nokkel),
      D = bit(flisnavn(blokkensBit(R, bx, by))),
      A = R.andeler.get(nokkel),
      f = R.faktorer.get(nokkel) ?? 1;
    for (let q = 0; q < KL.length; q++) {
      const c = KL[q];
      if (c < 1 || c > 3) continue;
      if (o !== null && EG![q] !== o) continue;
      const b = PL ? PL[q] : 0,
        ty = ET ? ET[q] : 0,
        s = ty === 1 ? 1 : ty === 2 ? 0 : b;
      if (!s && !(helKommune && c === 1)) continue;
      /* vekten: kommunens andel i ruta langs grensen, og målestokken */
      const x = q & (BLOKK - 1),
        y = q >> 9,
        i = nummer(R.kl, bx * BLOKK + x, by * BLOKK + y),
        k = D ? graaVed(D, ruteX(R, i), ruteY(R, i)) : 0,
        w = (A ? Math.fround(andelVed(A, x, y) / HEL) /* som før, da vekten lå i en Float32Array */ : 1) * f;
      if (helKommune && c === 1) {
        bebygd += w;
        if (!k) gront += w;
      }
      if (!s) continue;
      tall.tot += w;
      if (k) tall.graa += w;
      else if (c === 1) tall.gront += w;
      if (k === 4 || k === 5) tall.gron += w;
    }
  }
  /* kommuneplanen alene har ingen egne områder, og er den samme uansett dem (se cache.ts) */
  return { nr: R.nr, tall, bebygd, gront, antallEgne: ny ? nE : 0, ruteKm2: ruteKm2(R.z) };
}

/* Biten blokken (bx, by) i utbyggingen R ligger i. En blokk i utbyggingen er en flis på nivå 10 og ligger i én bit. */
const blokkensBit = (R: Utbygging, bx: number, by: number): Flis => bitAv([R.z, bx, by]);
/* Bitene utbyggingen R har ruter i som krysses: bebygd i dag, eller med planlagt utbygging. For et eget område (omrade) bare bitene
   området har ruter i, og uten bebygd (utenBebygd) bare bitene med planlagt utbygging. */
function biterIUtbygging(R: Utbygging, omrade: number | null, utenBebygd: boolean): Flis[] {
  const ut = new Map<string, Flis>();
  for (const [nokkel, KL] of R.kl.blokker) {
    if (omrade !== null && !(R.eget && R.eget.blokker.has(nokkel))) continue;
    const [bx, by] = blokkAv(nokkel),
      PL = R.pl.blokker.get(nokkel),
      ET = R.egetType ? R.egetType.blokker.get(nokkel) : undefined;
    let noe = !!PL || !!ET;
    for (let q = 0; q < KL.length && !noe && !utenBebygd && omrade === null; q++) noe = KL[q] === 1;
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
  const T = K.tall;
  return {
    gront: { km2: K.gront * K.ruteKm2 },
    plan: T.tot
      ? {
          km2: T.tot * K.ruteKm2,
          graa: T.graa * K.ruteKm2,
          gron: T.gron * K.ruteKm2,
          gront: T.gront * K.ruteKm2,
          andelGraa: andel(T.graa, T.tot),
          antallEgne: K.antallEgne
        }
      : null
  };
}

/* Tabellen gull.graakryss: planlagt utbygging krysset med grått areal i utvalget n (som 5001 eller 5001/gammel). null uten
   utbygging. */
export async function graakryss(n: string): Promise<Graakryss | null> {
  const u = lesUtvalg(n),
    R = await katalog.gull.utbygging(u.nr);
  if (!R) return null;
  /* Bebygd og grønt i bebygd er de samme for begge planene, så den nye planen med egne områder tar dem fra kommuneplanen alene, som
     huskes mellom endringene (se cache.ts), og teller bare den planlagte utbyggingen. */
  const G =
      u.plan === 'ny' && u.omrade === null && R.antallEgne ? await katalog.gull.graakryss(u.nr + '/gammel') : null,
    B = new Map<string, Graatrinn>();
  for (const b of biterIUtbygging(R, u.omrade, !!G)) B.set(flisnavn(b), await katalog.solv.graabit(b));
  const K = kryssGraa({ R, plan: u.plan, omrade: u.omrade }, n => B.get(n), !!G);
  return egenKopi(
    G ? { ...K, bebygd: G.bebygd, gront: G.gront } : K
  ); /* mot feilen i JavaScript-motoren (generelt/kopi.ts) */
}
/* Tabellen gull.graaIPlan: det temasiden viser fra kryssingen for utvalget n, se byggGraaIPlan. null uten utbygging. */
export type GraaIPlan = ReturnType<typeof byggGraaIPlan>;
export async function graaIPlan(n: string): Promise<GraaIPlan | null> {
  const K = await katalog.gull.graakryss(n);
  return K ? egenKopi(byggGraaIPlan(K)) : null;
}
/* Tabellen gull.graa: det temasiden, oversikten og kartet viser for kommunen nr: ok med tallene, eller ingen når kartet over grå
   arealer ikke har noe i kommunen. Arealet samlet (sum) og per trinn (trinn) står med uansett. */
export type Graavisning = ReturnType<typeof byggGraa> & { sum: number; trinn: number[] };
export async function graa(nr: string): Promise<Graavisning> {
  const [A, land] = await Promise.all([katalog.gull.graaAreal(nr), landareal(nr)]);
  return { ...byggGraa({ nr, tilstand: 'ok', trinn: A.km2, sum: A.sum }, land), sum: A.sum, trinn: A.km2 };
}
/* Arealet av grått areal i kommunen: km² per trinn (plass 1–6, plass 0 er ikke grått og står tom) og samlet, rundet til 10 dekar */
export interface GraaAreal {
  km2: number[];
  sum: number;
}
/* Tabellen gull.graaAreal: arealet av grått areal per trinn i kommunen nr. Rutene på 10,6 meter (solv.graabit) telles per trinn i
   kommunen, og en rute langs grensen telles med den delen av den som ligger i kommunen (solv.kommunebiter), rettet for
   målestokken. Antall ruter ganger arealet av en rute er arealet. */
export async function graaAreal(nr: string): Promise<GraaAreal> {
  const S = await tellIKommune(
    nr,
    7,
    tc => katalog.solv.graabit(tc).then(D => D.kl),
    t => t || null,
    0
  );
  return arealFraRuter(S.n, S.res, S.skala);
}

/* Grått areal i villreinområdene: arealet av villreinområdene i kommunen (villrein), det grå arealet i dem (sum), og andelen av
   villreinområdene som er grå, i prosent */
export interface GraaIVillrein {
  villrein: number;
  sum: number;
  andel: number | null;
}
/* Tabellen gull.graaIVillrein: det grå arealet (solv.graabit) i villreinområdene i kommunen, talt med andelen av hver rute som
   ligger i villreinområdene og i kommunen (solv.villreinAndel), som inngrepsfri natur i villreinområdene (gull.inonIVillrein). Der
   områder overlapper, telles ruta én gang. Alle trinnene er grått areal, også grått uten oppgitt andel vegetasjon. null når kommunen
   ikke har villreinområder. */
export async function graaIVillrein(nr: string): Promise<GraaIVillrein | null> {
  const R = await katalog.gull.villreinAreal(nr);
  if (!(R.sum > 0)) return null;
  const V = await katalog.solv.villreinAndel(nr);
  const n = await tellIBitene(
      V.biter[0],
      1,
      tc => katalog.solv.graabit(tc).then(D => D.kl),
      v => (v > 0 ? 0 : null),
      0
    ),
    sum = tiDekar((n[0] * BITRES * BITRES) / 1e6),
    villrein = tiDekar(R.sum);
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
