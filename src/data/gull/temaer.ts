/* Gull for naturtemaene, i deler som bygger på hverandre:
   - områdene i kommunen med arealet (gull.verneomrader, gull.villrein og gull.verdsattNatur)
   - kartleggingen av verdsatt natur (gull.verdsattNaturIKartlagt og gull.verdsattNaturKartlagt)
   - kolonnen for hvert tema i utbyggingen: hvilket område hver rute med planlagt utbygging ligger i (gull.utbyggingIVerneomrader
     og de andre)
   - summene over kolonnen: planlagt utbygging i temaet, samlet og per område (gull.verneomraderIPlan og de andre)
   - planlagt utbygging på natur utenfor det kartlagte (gull.utbyggingUtenforKartlagt)
   Delene er delt der det kommer inn en ny kilde: det kartlagte og utbyggingen kommer senere enn områdene, og siden viser områdene med
   en gang. Bygger på områdene, arealet og oppslagene i sølv (solv/temaer.ts) og utbyggingen (gull/utbygging.ts). Arealer er i km²,
   kryssinger i ruter. */
import { omriss, type Flatesok } from '../generelt/geometri.ts';
import { verdi } from '../generelt/glissen.ts';
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { ruteKm2, ruteX, ruteY } from '../solv/felles.ts';
import {
  NATURTEMA,
  VURDERES,
  klasseAreal,
  verneformgruppe,
  iOmradet,
  naturSok,
  type Kartlagt,
  type Omradesok,
  type Naturtema,
  type Omrade,
  type TemaOmrade,
  type Temaomrader
} from '../solv/temaer.ts';
import { andel, landareal } from './felles.ts';
import type { Utbygging } from './utbygging.ts';

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
/* Kryssingen av et tema med utbyggingen: per verdikategori for planen med egne områder (S) og planen alene (P), og ruter per område
   med planlagt utbygging (plan) og i smale striper (smal) */
export interface Kryssing {
  kryss: { S: Kryss; P: Kryss | null };
  plan: Int32Array;
  smal: Int32Array;
  ruteKm2: number;
}
/* Gir oppslaget for et område. lag() lager det, og den som kaller, kan huske det per område (nokkel). */
export type HuskSok = (nokkel: object, lag: () => Omradesok | null) => Omradesok | null;

/* Om midtpunktet i ruta i i utbyggingen R ligger i området S */
const iSoket = (S: Omradesok, R: Utbygging, i: number) => iOmradet(S, ruteX(R, i), ruteY(R, i));

/* Kolonnen for et tema i utbyggingen: hvilket område hver rad ligger i, som plassen i O, eller -1. Midtpunktet i ruta slås opp i
   områdene, og ruta hører til det første området den ligger i. kommune gir oppslaget i kommunen, som uklippede områder klippes
   mot. Oppslagene lages med naturSok i sølv. sok(nokkel, lag) gir oppslaget: den som kaller, kan huske det per område (nokkel) og bare kalle lag() første
   gang. */
export function temaKolonne(O: TemaOmrade[], R: Utbygging, kommune: () => Flatesok, sok: HuskSok): Int32Array {
  const treff = new Int32Array(R.rader.length).fill(-1);
  for (let r = 0; r < R.rader.length && O.length; r++) {
    const i = R.rader[r],
      x = ruteX(R, i),
      y = ruteY(R, i);
    for (let a = 0; a < O.length; a++) {
      const o = O[a];
      if (x < o.ext[0] || x > o.ext[2] || y < o.ext[1] || y > o.ext[3]) continue;
      const S = sok(o, () => naturSok(o, o.uklippet ? kommune() : null));
      if (!S || !iSoket(S, R, i)) continue;
      treff[r] = a;
      break;
    }
  }
  return treff;
}

/* Summene for et tema over radene i utbyggingen R, med kolonnen treff fra temaKolonne. O er områdene og nK antall verdikategorier.
   En rute telles én gang per tema, i området den hører til. Gir ruter per område (plan, og smal for ruter i smale striper), og per
   verdikategori for planen med egne områder (S) og planen alene (P), for hele kommunen og per eget område. */
export function kryssNatur(O: TemaOmrade[], R: Utbygging, treff: Int32Array, nK: number): Kryssing {
  const B = R.basis || null,
    nE = R.eget ? R.antallEgne : 0,
    nC = R.celler.length; /* radene etter disse har bare planen alene */
  const tom = (): Kryss => ({ alt: new Int32Array(nK), eg: Array.from({ length: nE }, () => new Int32Array(nK)) }),
    S = tom(),
    P = tom();
  const plan = new Int32Array(O.length),
    smal = new Int32Array(O.length);
  for (let r = 0; r < R.rader.length && O.length; r++) {
    const a = treff[r];
    if (a < 0) continue;
    const i = R.rader[r],
      v = O[a].v || 0;
    if (r < nC) {
      const e = nE ? verdi(R.eget!, i) : 0;
      if (verdi(R.ryddet, i)) {
        plan[a]++;
        S.alt[v]++;
        if (e) S.eg[e - 1][v]++;
      } else smal[a]++;
      if (B && verdi(B.ryddet, i)) {
        P.alt[v]++;
        if (e) P.eg[e - 1][v]++;
      }
    } else {
      const e = verdi(R.eget!, i);
      P.alt[v]++;
      if (e) P.eg[e - 1][v]++;
    }
  }
  return { kryss: { S, P: B ? P : null }, plan, smal, ruteKm2: ruteKm2(R.z) };
}

/* Planlagt utbygging på natur i utbyggingen R, uten smale striper, delt på kartlagt og ikke kartlagt. M er oppslaget for det
   kartlagte, eller null når ingenting er kartlagt. For planen med egne områder og planen alene, for hele kommunen og per eget
   område. */
export function kryssKartlagt(R: Utbygging, M: Omradesok | null): Gap {
  const B = R.basis || null,
    nE = R.eget ? R.antallEgne : 0,
    nC = R.celler.length;
  const ny = (): Ukjent & { eg: Ukjent[] } => ({
      nat: 0,
      ukjent: 0,
      eg: Array.from({ length: nE }, () => ({ nat: 0, ukjent: 0 }))
    }),
    G = ny(),
    GP = ny();
  const tell = (T: Ukjent & { eg: Ukjent[] }, i: number, uk: boolean) => {
    const e = nE ? verdi(R.eget!, i) : 0;
    T.nat++;
    if (uk) T.ukjent++;
    if (e) {
      T.eg[e - 1].nat++;
      if (uk) T.eg[e - 1].ukjent++;
    }
  };
  for (let r = 0; r < R.rader.length; r++) {
    const i = R.rader[r];
    if (r < nC) {
      const s = verdi(R.ryddet, i) === 1,
        b = !!B && verdi(B.ryddet, i) === 1;
      if (!s && !b) continue;
      const uk = !M || !iSoket(M, R, i);
      if (s) tell(G, i, uk);
      if (b) tell(GP, i, uk);
    } else if (verdi(B!.ryddet, i) === 1) tell(GP, i, !M || !iSoket(M, R, i));
  }
  return { nat: G.nat, ukjent: G.ukjent, eg: G.eg, plan: B ? GP : null };
}

/* Arealet av et tema som er summen av områdene: verneområder og villreinområder. Overlapper to områder, telles overlappet to
   ganger. */
export const samletAreal = (omrader: Omrade[]) => summen(omrader.map(o => o.km2));

/* Et naturtema i kommunen: områdene, arealet samlet og per verdikategori (verdsatt natur), andelen av landarealet, antall områder,
   og per verdikategori antall lokaliteter og arealet. Arealer er i km², andeler i prosent. */
export interface Temaet {
  nr: string;
  omrader: TemaOmrade[];
  sum: number;
  klasser: number[] | null;
  ufullstendig: boolean;
  andelLand: number | null;
  antall: number;
  hoyVerdi: number | null;
  perKlasse: { antall: number; km2: number }[] | null;
}
/* Temaet bygd av områdene O fra sølv, arealet A (samlet og per verdikategori) og landarealet land */
export function byggTemaet(
  tema: Naturtema,
  nr: string,
  O: Temaomrader,
  A: { sum: number; klasser?: number[] },
  land: number
): Temaet {
  const o = O.omrader,
    sum = A.sum || 0,
    klasser = tema.samlet && tema.klasser ? A.klasser || null : null,
    harKlasser = !!(tema.klasser && klasser && o.length);
  return {
    nr,
    omrader: o,
    sum,
    klasser,
    ufullstendig: !!O.ufullstendig,
    andelLand: andel(sum, land),
    antall: o.length,
    hoyVerdi: harKlasser ? klasser![0] + klasser![1] : null,
    perKlasse: harKlasser
      ? tema.klasser!.map((_, v) => ({ antall: o.filter(x => x.v === v).length, km2: klasser![v] }))
      : null
  };
}

/* Kartleggingen av verdsatt natur: det kartlagte (E), verdsatt natur innenfor det per verdikategori (inne), arealet og andelen av
   landarealet som er kartlagt, og helhetsbildet: landarealet delt i kartlagt og ikke kartlagt, og verdsatt natur i hver del. T er
   temaet, land landarealet i km². */
export function byggKartleggingen(E: Kartlagt | null, inne: number[] | null, T: Temaet, land: number) {
  let helhet = null;
  if (E && E.km2 > 0 && inne && T.klasser && land > 0 && T.antall > 0) {
    const L = land,
      K = Math.min(E.km2, L),
      U = Math.max(0, L - K),
      ute = T.klasser.map((a, v) => Math.max(0, a - inne[v])),
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
  return {
    E,
    inne,
    kartlagt: E ? { km2: E.km2, andelLand: andel(Math.min(E.km2, land), land), fra: E.fra, til: E.til } : null,
    helhet
  };
}
export type Kartleggingen = ReturnType<typeof byggKartleggingen>;

/* Tallene for planlagt utbygging i et tema, fra kryssingen K: per verdikategori (klasser, hvis temaet har det), samlet og i smale
   striper, antall områder som berøres, per område (perOmrade, på samme plass som området i T.omrader), og de berørte områdene med
   mest først (berorte, plassene i T.omrader). Ruter står både som antall og km². */
export function byggTemaIPlan(T: Temaet, K: Kryssing, klasser: [navn: string, farge: string][] | undefined) {
  const o = T.omrader,
    P = K.plan,
    plan = summen(P),
    smal = summen(K.smal);
  return {
    klasser:
      klasser && T.klasser && o.length
        ? klasser.map((_, v) => {
            let pl = 0;
            o.forEach((x, i) => {
              if (x.v === v) pl += P[i];
            });
            return { plan: pl, planKm2: pl * K.ruteKm2 };
          })
        : null,
    plan,
    planKm2: plan * K.ruteKm2,
    smal,
    smalKm2: smal * K.ruteKm2,
    berort: o.filter((_, i) => P[i]).length,
    perOmrade: Array.from(P, p => p * K.ruteKm2),
    berorte: o
      .map((_, i) => i)
      .filter(i => P[i])
      .sort((a, b) => P[b] - P[a])
  };
}
/* Planlagt utbygging i et tema: områdene det gjelder (de samme som i tabellen for temaet), kryssingen (K) og tallene (N) */
export interface TemaIPlan {
  omrader: TemaOmrade[];
  K: Kryssing;
  N: ReturnType<typeof byggTemaIPlan>;
}

const [VERN, REIN, VERDI] = NATURTEMA;
const ikke = () => null; /* det kartlagte kan mangle uten at svaret er feil: da er det ikke med */

/* Tabellene gull.verneomrader, gull.villrein og gull.verdsattNatur: områdene i kommunen nr, med arealet A. Arealet per
   verdikategori kommer fra sølv for verdsatt natur, og er summen av områdene for de andre. Hver tabell gir sitt eget areal, så
   koden viser hva hver av dem bygger på (verktoy/forklaringer.ts leser det). */
async function temaet(
  tema: Naturtema,
  nr: string,
  O: Temaomrader,
  A: Promise<{ sum: number; klasser?: number[] }> | { sum: number }
): Promise<Temaet> {
  const [land, a] = await Promise.all([landareal(nr), A]);
  return byggTemaet(tema, nr, O, a, land);
}
export async function verneomrader(nr: string): Promise<Temaet> {
  const O = await katalog.solv.verneomrader(nr);
  return temaet(VERN, nr, O, { sum: samletAreal(O.omrader) });
}
export async function villrein(nr: string): Promise<Temaet> {
  const O = await katalog.solv.villrein(nr);
  return temaet(REIN, nr, O, { sum: samletAreal(O.omrader) });
}
export async function verdsattNatur(nr: string): Promise<Temaet> {
  return temaet(VERDI, nr, await katalog.solv.verdsattNatur(nr), katalog.solv.verdsattNaturAreal(nr));
}

/* Tabellen gull.verdsattNaturKartlagt: kartleggingen av verdsatt natur i kommunen nr. Uten det kartlagte er det ingen kartlegging å
   vise. */
export async function verdsattNaturKartlagt(nr: string): Promise<Kartleggingen> {
  const [T, E, inne, land] = await Promise.all([
    katalog.gull.verdsattNatur(nr),
    katalog.solv.kartlagt(nr).catch(ikke),
    katalog.gull.verdsattNaturIKartlagt(nr).catch(ikke),
    landareal(nr)
  ]);
  return byggKartleggingen(E, inne, T, land);
}

/* Tabellene gull.utbyggingIVerneomrader, gull.utbyggingIVillrein og gull.utbyggingIVerdsattNatur: kolonnen for temaet i
   utbyggingen for kommunen nr, med temaet (T) og utbyggingen (R) den er regnet av. null uten utbygging. Oppslagene for områdene
   huskes i solv.naturoppslag. */
export interface Temakolonne {
  T: Temaet;
  R: Utbygging;
  treff: Int32Array;
}
async function kolonne(tema: Naturtema, nr: string, T: Temaet): Promise<Temakolonne | null> {
  const [R, g] = await Promise.all([katalog.gull.utbygging(nr), katalog.solv.grense(nr)]);
  if (!R) return null;
  const navn = new Map<object, string>(T.omrader.map((o, i) => [o, `${tema.id}/${nr}/${i}`]));
  const kommune = () => katalog.solv.naturoppslag.straks('kommune/' + nr, () => naturSok(g, null))!.flate;
  return {
    T,
    R,
    treff: temaKolonne(T.omrader, R, kommune, (o, lag) => katalog.solv.naturoppslag.straks(navn.get(o)!, lag))
  };
}
export async function utbyggingIVerneomrader(nr: string): Promise<Temakolonne | null> {
  return kolonne(VERN, nr, await katalog.gull.verneomrader(nr));
}
export async function utbyggingIVillrein(nr: string): Promise<Temakolonne | null> {
  return kolonne(REIN, nr, await katalog.gull.villrein(nr));
}
export async function utbyggingIVerdsattNatur(nr: string): Promise<Temakolonne | null> {
  return kolonne(VERDI, nr, await katalog.gull.verdsattNatur(nr));
}

/* Tabellene gull.verneomraderIPlan, gull.villreinIPlan og gull.verdsattNaturIPlan: planlagt utbygging i temaet, summert over
   kolonnen for temaet. null uten utbygging. */
function temaIPlan(tema: Naturtema, C: Temakolonne | null): TemaIPlan | null {
  if (!C) return null;
  const K = kryssNatur(C.T.omrader, C.R, C.treff, tema.klasser ? tema.klasser.length : 1);
  return { omrader: C.T.omrader, K, N: byggTemaIPlan(C.T, K, tema.klasser) };
}
export async function verneomraderIPlan(nr: string): Promise<TemaIPlan | null> {
  return temaIPlan(VERN, await katalog.gull.utbyggingIVerneomrader(nr));
}
export async function villreinIPlan(nr: string): Promise<TemaIPlan | null> {
  return temaIPlan(REIN, await katalog.gull.utbyggingIVillrein(nr));
}
export async function verdsattNaturIPlan(nr: string): Promise<TemaIPlan | null> {
  return temaIPlan(VERDI, await katalog.gull.utbyggingIVerdsattNatur(nr));
}

/* Tabellen gull.utbyggingUtenforKartlagt: planlagt utbygging på natur i kommunen nr, og hvor mye av den som ligger utenfor det som
   er kartlagt for naturtyper etter Miljødirektoratets instruks. Der vet vi ikke om det finnes verdifull natur. null uten utbygging,
   eller når det kartlagte ikke kan hentes. Oppslaget for det kartlagte huskes i solv.naturoppslag. */
export type UtenforKartlagt = Gap & { natKm2: number; ukjentKm2: number; andel: number | null };
export async function utbyggingUtenforKartlagt(nr: string): Promise<UtenforKartlagt | null> {
  const [R, E] = await Promise.all([katalog.gull.utbygging(nr), katalog.solv.kartlagt(nr).catch(ikke)]);
  if (!R || !E) return null;
  const M =
    E.flate && E.flate.length
      ? katalog.solv.naturoppslag.straks('kartlagt/' + nr, () =>
          naturSok({ koord: E.flate!, ext: omriss(E.flate!) }, null)
        )
      : null;
  const G = kryssKartlagt(R, M);
  const r = ruteKm2(R.z);
  return { ...G, natKm2: G.nat * r, ukjentKm2: G.ukjent * r, andel: andel(G.ukjent, G.nat) };
}

/* Tabellen gull.verdsattNaturIKartlagt: verdsatt natur per verdikategori innenfor det kartlagte i kommunen nr, eller null når
   ingenting er kartlagt */
export async function verdsattNaturIKartlagt(nr: string): Promise<number[] | null> {
  const v = await katalog.solv.kartlagt(nr);
  if (!v.flate || !v.flate.length) return null;
  const [{ omrader }, g] = await Promise.all([katalog.solv.verdsattNatur(nr), katalog.solv.grense(nr)]);
  return klasseAreal(omrader, VERDI.klasser!.length, g, v.flate).klasser;
}

/* Tabellen gull.vernPerVerneform: det vernede arealet i kommunen nr per verneform, slik Miljødirektoratet skriver den
   (egenskapen verneform, tom når den mangler), med gruppen verneformen hører til (VERNEFORMGRUPPER). Størst først. */
export async function vernPerVerneform(nr: string): Promise<{ verneform: string; gruppe: string; km2: number }[]> {
  const T = await katalog.gull.verneomrader(nr),
    m = new Map<string, number>();
  T.omrader.forEach(o => {
    const f = String(o.egenskaper.verneform || '');
    m.set(f, (m.get(f) || 0) + o.km2);
  });
  return [...m]
    .map(([verneform, km2]) => ({ verneform, gruppe: verneformgruppe(verneform), km2 }))
    .sort((a, b) => b.km2 - a.km2);
}
/* Verneområdene i kommunen med gruppen for verneformen, til kartet over verneformene: flaten (koord, klippet mot kommunen) og gruppen */
export interface VernetFlate {
  koord: TemaOmrade['koord'];
  ext: TemaOmrade['ext'];
  gruppe: string;
}
/* Tabellen gull.verneformer: verneområdene i kommunen nr som flater med gruppen for verneformen (VERNEFORMGRUPPER), største først */
export async function verneformer(nr: string): Promise<VernetFlate[]> {
  const T = await katalog.gull.verneomrader(nr);
  return T.omrader.map(o => ({ koord: o.koord, ext: o.ext, gruppe: verneformgruppe(o.egenskaper.verneform) }));
}
/* Verdsatt natur som skal vurderes per lokalitet eller per naturtype: lokalitetene (omrader, med v 0 per lokalitet og 1 per
   naturtype), antall og arealet i kommunen per kategori (klasser) og samlet (sum), og om tjenesten ga alle (ufullstendig) */
export interface VerdsattVurderes {
  omrader: TemaOmrade[];
  antall: number[];
  klasser: number[];
  sum: number;
  ufullstendig: boolean;
}
/* Tabellen gull.verdsattVurderes: lokalitetene fra solv.verdsattVurderes, med arealet per kategori klippet mot kommunen som for
   verdsatt natur (klasseAreal), så overlapp telles én gang */
export async function verdsattVurderes(nr: string): Promise<VerdsattVurderes> {
  const [T, g] = await Promise.all([katalog.solv.verdsattVurderes(nr), katalog.solv.grense(nr)]),
    n = VURDERES.klasser!.length,
    A = klasseAreal(T.omrader, n, g);
  return {
    omrader: T.omrader,
    antall: Array.from({ length: n }, (_, v) => T.omrader.filter(o => (o.v || 0) === v).length),
    klasser: A.klasser,
    sum: A.sum,
    ufullstendig: !!T.ufullstendig
  };
}
/* Tabellen gull.villreinPerOmrade: villreinområdene i kommunen nr med delen som ligger i kommunen, andelen av landarealet,
   kommunene området ligger i (egenskapen kommune) og faktaarket. Størst først. */
export async function villreinPerOmrade(
  nr: string
): Promise<{ navn: string; km2: number; andel: number | null; kommuner: string; url: string }[]> {
  const [T, land] = await Promise.all([katalog.gull.villrein(nr), landareal(nr)]);
  return T.omrader
    .map(o => ({
      navn: o.navn,
      km2: o.km2,
      andel: andel(o.km2, land),
      kommuner: String(o.egenskaper.kommune || ''),
      url: o.url
    }))
    .sort((a, b) => b.km2 - a.km2);
}
/* En naturtype i verdsatt natur: arealet, antall lokaliteter og den høyeste verdien blant dem (v, 0 er svært stor) */
export interface Naturtype {
  navn: string;
  km2: number;
  antall: number;
  v: number;
}
/* Tabellen gull.verdsattPerNaturtype: lokalitetene i verdsatt natur i kommunen nr gruppert per naturtype, alle og bare de med stor
   eller svært stor verdi. Arealet er summen av lokalitetene, så overlapp telles flere ganger. Størst først. */
export async function verdsattPerNaturtype(nr: string): Promise<{ alle: Naturtype[]; hoy: Naturtype[] }> {
  const T = await katalog.gull.verdsattNatur(nr);
  const grupper = (bareHoy: boolean) => {
    const m = new Map<string, Naturtype>();
    T.omrader
      .filter(o => !bareHoy || (o.v !== undefined && o.v <= 1))
      .forEach(o => {
        const navn = String(o.egenskaper.Naturtype || 'Uten naturtype'),
          t = m.get(navn) || { navn, km2: 0, antall: 0, v: 3 };
        t.km2 += o.km2;
        t.antall++;
        t.v = Math.min(t.v, o.v ?? 3);
        m.set(navn, t);
      });
    return [...m.values()].sort((a, b) => b.km2 - a.km2);
  };
  return { alle: grupper(false), hoy: grupper(true) };
}
