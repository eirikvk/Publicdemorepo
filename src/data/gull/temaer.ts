/* Gull for naturtemaene: kryssingen med planrutenettet (hvor mye planlagt utbygging som ligger i hvert område), og tallene
   temasidene viser. Bygger på områdene, arealet og maskene i sølv (solv/temaer.ts) og planrutenettet (solv/planrutenett.ts). Arealer
   er i km², kryssinger i ruter. */
import { omriss, type FlateMedUtsnitt } from '../generelt/geometri.ts';
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { HALV, RUTE, ruteX, ruteY } from '../solv/felles.ts';
import type { Planrutenett } from '../solv/planrutenett.ts';
import {
  NATURTEMA,
  naturMaske,
  type Kartlagt,
  type Maske,
  type Naturtema,
  type Omrade,
  type TemaOmrade,
  type Temaomrader
} from '../solv/temaer.ts';
import { andel, landareal } from './felles.ts';

/* Ruter med planlagt utbygging per verdikategori, for hele kommunen (alt) og per eget område (eg) */
export interface Kryss {
  alt: Int32Array;
  eg: Int32Array[];
}
/* Ruter med planlagt utbygging på natur (nat), og hvor mange av dem som ligger utenfor det kartlagte (ukjent) */
export interface Ukjent {
  nat: number;
  ukjent: number;
}
/* Det samme for hele kommunen og per eget område, for planen med egne områder og for planen alene (plan) */
export interface Gap extends Ukjent {
  eg: Ukjent[];
  plan: (Ukjent & { eg: Ukjent[] }) | null;
}
/* Kryssingen av et tema med planrutenettet: per verdikategori for planen med egne områder (S) og planen alene (P), gap, og ruter
   per område med planlagt utbygging (plan) og i smale striper (smal) */
export interface Kryssing {
  kryss: { S: Kryss; P: Kryss | null };
  gap: Gap | null;
  plan: Int32Array;
  smal: Int32Array;
}
/* Det som er hentet og regnet ut for et naturtema i en kommune: områdene, arealet samlet og per verdikategori, det kartlagte og
   verdsatt natur innenfor det (inne), og kryssingen med planen når den er regnet ut (regnet) */
export interface TemaData {
  nr: string;
  omrader: TemaOmrade[];
  sum: number;
  klasser?: number[] | null;
  ufullstendig?: boolean;
  ekstra?: Kartlagt | null;
  inne?: number[];
  regnet: boolean;
  plan: Int32Array;
  smal: Int32Array;
  kryss: { S: Kryss; P: Kryss | null } | null;
  gap: Gap | null;
}
/* Gir masken til et område. lag() lager den, og den som kaller, kan huske den per område (nokkel). */
export type HuskMaske = (nokkel: object, lag: () => Maske | null) => Maske | null;

/* Kryssing med planrutenettet: midtpunktet i hver rute med planlagt utbygging slås opp i maskene for temaets områder. En rute telles
   én gang per tema, i det første området den treffer. D er temaets data (områdene og eventuelt kartleggingen), R planrutenettet,
   nK antall verdikategorier, medDekning om utbygging på natur skal deles i kartlagt og ikke kartlagt, og kommune flaten uklippede
   områder klippes mot.
   Gir ruter per område (plan, og smal for ruter i smale striper), per verdikategori for planen med egne områder (S) og planen alene
   (P), og gap: ruter med planlagt utbygging på natur, og hvor mange av dem som ligger utenfor det kartlagte. Maskene lages med
   naturMaske i sølv. maske(nokkel, lag) gir masken: den som kaller, kan huske maskene per område (nokkel) og bare kalle lag() første
   gang. */
export function kryssNatur(
  D: Pick<TemaData, 'omrader' | 'ekstra'>,
  R: Planrutenett,
  nK: number,
  medDekning: boolean,
  kommune: FlateMedUtsnitt,
  maske: HuskMaske
): Kryssing {
  const B = R.basis || null,
    nE = R.eget ? R.antallEgne : 0,
    O = D.omrader;
  const tom = (): Kryss => ({ alt: new Int32Array(nK), eg: Array.from({ length: nE }, () => new Int32Array(nK)) }),
    S = tom(),
    P = tom();
  const plan = new Int32Array(O.length),
    smal = new Int32Array(O.length);
  const fjernet = (i: number) =>
    B!.ryddet[i] && R.alle[i] !== 1 && R.alle[i] !== 2; /* i planen, tatt ut av et eget område */
  if (O.length) {
    const treff = (i: number) => {
      /* nummeret til området ruta ligger i, eller -1 */
      const x = ruteX(R, i),
        y = ruteY(R, i);
      for (let a = 0; a < O.length; a++) {
        const o = O[a];
        if (x < o.ext[0] || x > o.ext[2] || y < o.ext[1] || y > o.ext[3]) continue;
        const M = maske(o, () => naturMaske(o, o.uklippet ? kommune : null));
        if (!M) continue;
        const px = Math.floor((x - M.u[0]) / M.res),
          py = Math.floor((M.u[3] - y) / M.res);
        if (px < 0 || py < 0 || px >= M.w || py >= M.h || M.a[py * M.w + px] < HALV) continue;
        return a;
      }
      return -1;
    };
    for (const i of R.celler) {
      const a = treff(i);
      if (a < 0) continue;
      const v = O[a].v || 0,
        e = nE ? R.eget![i] : 0;
      if (R.ryddet[i]) {
        plan[a]++;
        S.alt[v]++;
        if (e) S.eg[e - 1][v]++;
      } else smal[a]++;
      if (B && B.ryddet[i]) {
        P.alt[v]++;
        if (e) P.eg[e - 1][v]++;
      }
    }
    if (B)
      for (const i of B.celler) {
        if (!fjernet(i)) continue;
        const a = treff(i);
        if (a < 0) continue;
        const v = O[a].v || 0,
          e = R.eget![i];
        P.alt[v]++;
        if (e) P.eg[e - 1][v]++;
      }
  }
  let gap: Gap | null = null;
  if (medDekning && D.ekstra) {
    /* ruter med planlagt utbygging på natur, uten smale striper, delt på kartlagt og ikke kartlagt */
    const E = D.ekstra,
      M =
        E.flate && E.flate.length ? maske(E, () => naturMaske({ koord: E.flate!, ext: omriss(E.flate!) }, null)) : null;
    const ukjentRute = (i: number) => {
      if (!M) return true;
      const px = Math.floor((ruteX(R, i) - M.u[0]) / M.res),
        py = Math.floor((M.u[3] - ruteY(R, i)) / M.res);
      return px < 0 || py < 0 || px >= M.w || py >= M.h || M.a[py * M.w + px] < HALV;
    };
    const ny = (): Ukjent & { eg: Ukjent[] } => ({
        nat: 0,
        ukjent: 0,
        eg: Array.from({ length: nE }, () => ({ nat: 0, ukjent: 0 }))
      }),
      G = ny(),
      GP = ny();
    const tell = (T: Ukjent & { eg: Ukjent[] }, i: number, uk: boolean) => {
      const e = nE ? R.eget![i] : 0;
      T.nat++;
      if (uk) T.ukjent++;
      if (e) {
        T.eg[e - 1].nat++;
        if (uk) T.eg[e - 1].ukjent++;
      }
    };
    for (const i of R.celler) {
      const s = R.ryddet[i] === 1,
        b = !!B && B.ryddet[i] === 1;
      if (!s && !b) continue;
      const uk = ukjentRute(i);
      if (s) tell(G, i, uk);
      if (b) tell(GP, i, uk);
    }
    if (B) for (const i of B.celler) if (B.ryddet[i] === 1 && fjernet(i)) tell(GP, i, ukjentRute(i));
    gap = { nat: G.nat, ukjent: G.ukjent, eg: G.eg, plan: B ? GP : null };
  }
  return { kryss: { S, P: B ? P : null }, gap, plan, smal };
}

/* Arealet av et tema som er summen av områdene: verneområder og villreinområder. Overlapper to områder, telles overlappet to
   ganger. */
export const samletAreal = (omrader: Omrade[]) => summen(omrader.map(o => o.km2));

/* Tallene en temaside og oversikten viser for et naturtema. D er temaets data, klasser verdikategoriene hvis temaet har det,
   medDekning om temaet har kartleggingsgrad, samlet om bare berørte områder skal listes, og land landarealet i km². Arealer er i
   km², andeler i prosent, og ruter med planlagt utbygging står både som antall og som km².
   Gir arealet i kommunen og andelen av landarealet, per verdikategori antall lokaliteter og planlagt utbygging, arealet med stor
   eller svært stor verdi, kartleggingsgraden, helhetsbildet (landarealet delt i kartlagt og ikke kartlagt, og verdsatt natur i hver
   del), planlagt utbygging innenfor og i smale striper, antall områder som berøres, planlagt utbygging på natur som ikke er kartlagt,
   og områdene som skal listes (med plassen i listen over alle områder). */
export function byggNaturTall(
  D: TemaData,
  klasser: [navn: string, farge: string][] | undefined,
  medDekning: boolean,
  samlet: boolean,
  land: number
) {
  const o = D.omrader,
    E = D.ekstra,
    sum = D.sum || 0,
    harKlasser = !!(klasser && D.klasser && o.length),
    P = D.plan; /* ruter med planlagt utbygging per område, fra kryssNatur */
  const perKlasse = harKlasser
    ? klasser.map((_, v) => {
        let antall = 0,
          plan = 0;
        o.forEach((x, i) => {
          if (x.v !== v) return;
          antall++;
          plan += P[i];
        });
        return { antall, km2: D.klasser![v], plan, planKm2: plan * RUTE };
      })
    : null;
  let helhet = null;
  if (medDekning && E && E.km2 > 0 && D.inne && D.klasser && land > 0 && o.length > 0) {
    const L = land,
      K = Math.min(E.km2, L),
      U = Math.max(0, L - K),
      inne = D.inne,
      ute = D.klasser.map((a, v) => Math.max(0, a - inne[v])),
      si = summen(inne),
      su = summen(ute);
    helhet = {
      L,
      K,
      U,
      inne,
      ute,
      si,
      su,
      andelKartlagt: andel(K, L),
      andelIkkeKartlagt: andel(U, L),
      andelInne: andel(si, K),
      andelUte: andel(su, U)
    };
  }
  const plan = summen(P),
    smal = summen(D.smal),
    G = D.gap;
  return {
    sum,
    andelLand: andel(sum, land),
    antall: o.length,
    klasser: perKlasse,
    hoyVerdi: harKlasser ? D.klasser![0] + D.klasser![1] : null,
    kartlagt: E ? { km2: E.km2, andelLand: andel(Math.min(E.km2, land), land), fra: E.fra, til: E.til } : null,
    helhet,
    plan,
    planKm2: plan * RUTE,
    smal,
    smalKm2: smal * RUTE,
    berort: o.filter((_, i) => P[i]).length,
    gap: G ? { nat: G.nat, natKm2: G.nat * RUTE, ukjentKm2: G.ukjent * RUTE, andel: andel(G.ukjent, G.nat) } : null,
    vises: (samlet
      ? o
          .map((_, i) => i)
          .filter(i => P[i])
          .sort((a, b) => P[b] - P[a])
      : o.map((_, i) => i)
    ).map(i => ({
      omr: o[i],
      nr: i,
      planKm2: P[i] * RUTE
    }))
  };
}
/* Det temasiden viser, fra byggNaturTall */
export type NaturTall = ReturnType<typeof byggNaturTall>;

/* Kryssingen før den er regnet ut: ingen ruter med planlagt utbygging i n områder */
const ikkeKrysset = (n: number) => ({
  regnet: false,
  plan: new Int32Array(n),
  smal: new Int32Array(n),
  kryss: null,
  gap: null
});
/* Et naturtema i kommunen nr: dataene (D) og tallene temasiden og oversikten viser (N). O er områdene fra sølv. Arealet per
   verdikategori kommer fra sølv for verdsatt natur, og er summen av områdene for de andre. Det kartlagte og planrutenettet tas med
   når de finnes: kommer de senere, regnes gull ut på nytt. Maskene til områdene huskes i solv.naturmaske. */
export type Naturtemaet = { D: TemaData; N: NaturTall };
async function naturtemaet(tema: Naturtema, nr: string, O: Temaomrader): Promise<Naturtemaet> {
  const [land, g, A] = await Promise.all([
      landareal(nr),
      katalog.solv.grense(nr),
      tema.samlet ? katalog.solv.verdsattNaturAreal(nr) : { sum: samletAreal(O.omrader), klasser: undefined }
    ]),
    omrader = O.omrader,
    ekstra = tema.dekning ? katalog.solv.kartlagt.naa(nr) : undefined,
    inne = tema.dekning && tema.klasser ? katalog.solv.verdsattNaturIKartlagt.naa(nr) || undefined : undefined,
    R = katalog.solv.planrutenett.naa(nr),
    navn = new Map<object, string>(omrader.map((o, i) => [o, `${tema.id}/${nr}/${i}`]));
  if (ekstra) navn.set(ekstra, 'kartlagt/' + nr);
  const K = R
    ? kryssNatur({ omrader, ekstra }, R, tema.klasser ? tema.klasser.length : 1, !!tema.dekning, g, (o, lag) =>
        katalog.solv.naturmaske.straks(navn.get(o)!, lag)
      )
    : null;
  const D: TemaData = {
    nr,
    omrader,
    sum: A.sum,
    klasser: tema.samlet ? (tema.klasser ? A.klasser : null) : undefined,
    ufullstendig: O.ufullstendig,
    ekstra,
    inne,
    ...(K ? { ...K, regnet: true } : ikkeKrysset(omrader.length))
  };
  return { D, N: byggNaturTall(D, tema.klasser, !!tema.dekning, !!tema.samlet, land) };
}
const [VERN, REIN, VERDI] = NATURTEMA;
/* Tabellene gull.verneomrader, gull.villrein og gull.verdsattNatur */
export async function verneomrader(nr: string): Promise<Naturtemaet> {
  return naturtemaet(VERN, nr, await katalog.solv.verneomrader(nr));
}
export async function villrein(nr: string): Promise<Naturtemaet> {
  return naturtemaet(REIN, nr, await katalog.solv.villrein(nr));
}
export async function verdsattNatur(nr: string): Promise<Naturtemaet> {
  return naturtemaet(VERDI, nr, await katalog.solv.verdsattNatur(nr));
}
