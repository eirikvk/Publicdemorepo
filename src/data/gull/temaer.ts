/* Gull for naturtemaene, i deler som bygger på hverandre:
   - områdene i kommunen med arealet (gull.verneomrader, gull.villrein og gull.verdsattNatur)
   - kartleggingen av verdsatt natur (gull.verdsattNaturIKartlagt og gull.verdsattNaturKartlagt)
   - kolonnen for hvert tema i utbyggingen: hvor stor del av hver rute med planlagt utbygging som ligger i temaet, og i hvert område
     (gull.utbyggingIVerneomrader og de andre)
   - summene over kolonnen: planlagt utbygging i temaet, samlet og per område (gull.verneomraderIPlan og de andre)
   - planlagt utbygging på natur utenfor det kartlagte (gull.utbyggingUtenforKartlagt)
   Delene er delt der det kommer inn en ny kilde: det kartlagte og utbyggingen kommer senere enn områdene, og siden viser områdene med
   en gang. Bygger på områdene, dekningsandelen og oppslagene i sølv (solv/temaer.ts) og utbyggingen (gull/utbygging.ts). Arealer er i
   km², kryssinger i ruter rettet for målestokken. */
import { andelVed, dekningIRute, HEL } from '../generelt/dekning.ts';
import { punkterI, punktnett, type Flatesok } from '../generelt/geometri.ts';
import { verdi } from '../generelt/glissen.ts';
import { summen } from '../generelt/tall.ts';
import { katalog } from '../katalog.ts';
import { BERORT, BIT, ruteKm2, ruteM, ruteX, ruteY } from '../solv/felles.ts';
import type { Andelsbit } from '../solv/kommune.ts';
import {
  NATURTEMA,
  VURDERES,
  verneformgruppe,
  naturSok,
  type Kartlagt,
  type Omradesok,
  type Naturtema,
  type TemaOmrade,
  type Temaomrader
} from '../solv/temaer.ts';
import { andel, landareal } from './felles.ts';
import { ruteFaktor, ruteVekt, type Utbygging } from './utbygging.ts';

/* Ruter med planlagt utbygging per verdikategori, for hele kommunen (alt) og per eget område (eg). En rute teller med den delen av
   den som ligger i temaet og i kommunen, rettet for målestokken. */
export interface Kryss {
  alt: Float64Array;
  eg: Float64Array[];
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
/* Kryssingen av et tema med utbyggingen: per verdikategori for planen med egne områder (S) og planen alene (P), samlet for planen
   med egne områder (samlet) og i smale striper (samletSmal), og per område (plan og smal). S, P og samlet er unionen av områdene, så
   overlapp telles én gang. Per område teller hvert område med sin egen del av ruta, så summen over områdene kan bli større enn samlet
   der områder overlapper. */
export interface Kryssing {
  kryss: { S: Kryss; P: Kryss | null };
  samlet: number;
  samletSmal: number;
  plan: Float64Array;
  smal: Float64Array;
  ruteKm2: number;
}
/* Gir oppslaget for et område. lag() lager det, og den som kaller, kan huske det per område (nokkel). */
export type HuskSok = (nokkel: object, lag: () => Omradesok | null) => Omradesok | null;

/* Kolonnene for et tema i utbyggingen: for hver rad og kategori andelen av ruta som ligger i temaet og i kommunen (union, rad · nK +
   kategori, 0–1), og for hvert område radene det dekker noe av og andelen (radene for område a står fra omr[a] til omr[a + 1] − 1 i
   rad og d) */
export interface Andelskolonne {
  nK: number;
  union: Float32Array;
  omr: Int32Array;
  rad: Int32Array;
  d: Float32Array;
}
/* Andelen 0–1 i den globale ruta (X, Y) på nivå 10 fra bitene i M (etter bitnøkkel) */
function andelIRuta(M: Map<number, Andelsbit>, X: number, Y: number) {
  const bx = Math.floor(X / BIT),
    by = Math.floor(Y / BIT),
    K = M.get(bx * 65536 + by);
  if (!K) return 0;
  return K.andel ? andelVed(K.andel, X - bx * BIT, Y - by * BIT) / HEL : 1;
}
/* Bitene i L etter bitnøkkel */
const bitkart = (L: Andelsbit[]) => new Map(L.map(K => [K.tc[1] * 65536 + K.tc[2], K]));
/* Andelen 0–1 av rute i i utbyggingen R som ligger i flaten bak bitene i M */
export function andelIRute(R: Utbygging, M: Map<number, Andelsbit>, i: number) {
  return andelIRuta(M, R.cx0 + (i % R.w), R.cy0 + Math.floor(i / R.w));
}

/* Kolonnene for et tema i utbyggingen R. Unionen per kategori slås opp i dekningsandelen for temaet (A, bitene per kategori fra
   solv.vernAndel og de andre). Per område regnes andelen av hver rute med dekningIRute (generelt/dekning.ts), med de samme fire delradene som
   dekningsandelen: hvert område ser bare på rutene innenfor omrisset sitt (punktnett), og områder som ikke er klippet mot kommunen,
   klippes mot oppslaget i kommunen (kommune). Oppslagene lages med naturSok i sølv. sok(nokkel, lag) gir oppslaget: den som kaller,
   kan huske det per område (nokkel) og bare kalle lag() første gang. klipp sier om området skal klippes mot kommunen. */
export function temaKolonne(
  O: TemaOmrade[],
  R: Utbygging,
  A: Andelsbit[][],
  kommune: () => Flatesok,
  sok: HuskSok,
  klipp: (o: TemaOmrade) => boolean
): Andelskolonne {
  const n = R.rader.length,
    nK = A.length,
    union = new Float32Array(n * nK),
    omr = new Int32Array(O.length + 1),
    rad: number[] = [],
    d: number[] = [];
  if (!n) return { nK, union, omr, rad: new Int32Array(0), d: new Float32Array(0) };
  A.forEach((L, v) => {
    if (!L.length) return;
    const M = bitkart(L);
    for (let r = 0; r < n; r++) union[r * nK + v] = andelIRute(R, M, R.rader[r]);
  });
  const x = new Float64Array(n),
    y = new Float64Array(n),
    res = ruteM(R.z),
    h = res / 2;
  for (let r = 0; r < n; r++) {
    x[r] = ruteX(R, R.rader[r]);
    y[r] = ruteY(R, R.rader[r]);
  }
  const N = punktnett(x, y);
  O.forEach((o, a) => {
    omr[a] = rad.length;
    let S: Omradesok | null | undefined;
    punkterI(N, [o.ext[0] - h, o.ext[1] - h, o.ext[2] + h, o.ext[3] + h], r => {
      if (S === undefined) S = sok(o, () => naturSok(o, klipp(o) ? kommune() : null));
      if (!S) return;
      const da = dekningIRute(S.flate, x[r] - h, y[r] + h, res, S.kommune ? [S.kommune] : []);
      if (da > 0) {
        rad.push(r);
        d.push(da);
      }
    });
  });
  omr[O.length] = rad.length;
  return { nK, union, omr, rad: Int32Array.from(rad), d: Float32Array.from(d) };
}

/* Summene for et tema over radene i utbyggingen R, med kolonnene C fra temaKolonne og antall områder. Gir ruter per verdikategori for
   planen med egne områder (S) og planen alene (P), for hele kommunen og per eget område, samlet og i smale striper, og per område
   (plan, og smal for ruter i smale striper). */
export function kryssNatur(R: Utbygging, C: Andelskolonne, antall: number): Kryssing {
  const B = R.basis || null,
    nE = R.eget ? R.antallEgne : 0,
    nC = R.celler.length /* radene etter disse har bare planen alene */,
    nK = C.nK;
  const tom = (): Kryss => ({ alt: new Float64Array(nK), eg: Array.from({ length: nE }, () => new Float64Array(nK)) }),
    S = tom(),
    P = tom();
  let samlet = 0,
    samletSmal = 0;
  for (let r = 0; r < R.rader.length; r++) {
    const i = R.rader[r];
    let f = -1;
    for (let v = 0; v < nK; v++) {
      const d = C.union[r * nK + v];
      if (!d) continue;
      if (f < 0) f = ruteFaktor(R, i);
      const w = d * f;
      if (r < nC) {
        const e = nE ? verdi(R.eget!, i) : 0;
        if (verdi(R.ryddet, i)) {
          samlet += w;
          S.alt[v] += w;
          if (e) S.eg[e - 1][v] += w;
        } else samletSmal += w;
        if (B && verdi(B.ryddet, i)) {
          P.alt[v] += w;
          if (e) P.eg[e - 1][v] += w;
        }
      } else {
        const e = verdi(R.eget!, i);
        P.alt[v] += w;
        if (e) P.eg[e - 1][v] += w;
      }
    }
  }
  const plan = new Float64Array(antall),
    smal = new Float64Array(antall);
  for (let a = 0; a < antall; a++)
    for (let p = C.omr[a]; p < C.omr[a + 1]; p++) {
      const r = C.rad[p];
      if (r >= nC) continue;
      const i = R.rader[r],
        w = C.d[p] * ruteFaktor(R, i);
      if (verdi(R.ryddet, i)) plan[a] += w;
      else smal[a] += w;
    }
  return { kryss: { S, P: B ? P : null }, samlet, samletSmal, plan, smal, ruteKm2: ruteKm2(R.z) };
}

/* Planlagt utbygging på natur i utbyggingen R, uten smale striper, delt på kartlagt og ikke kartlagt. K er bitene med det kartlagte i
   kommunen (solv.kartlagtAndel), tom når ingenting er kartlagt. Den delen av ruta som ligger i kommunen, men ikke i det kartlagte, er
   ukjent. For planen med egne områder og planen alene, for hele kommunen og per eget område. */
export function kryssKartlagt(R: Utbygging, K: Andelsbit[]): Gap {
  const B = R.basis || null,
    nE = R.eget ? R.antallEgne : 0,
    nC = R.celler.length,
    M = bitkart(K);
  const ny = (): Ukjent & { eg: Ukjent[] } => ({
      nat: 0,
      ukjent: 0,
      eg: Array.from({ length: nE }, () => ({ nat: 0, ukjent: 0 }))
    }),
    G = ny(),
    GP = ny();
  const tell = (T: Ukjent & { eg: Ukjent[] }, i: number, uk: number) => {
    const e = nE ? verdi(R.eget!, i) : 0,
      w = ruteVekt(R, i);
    T.nat += w;
    T.ukjent += uk;
    if (e) {
      T.eg[e - 1].nat += w;
      T.eg[e - 1].ukjent += uk;
    }
  };
  const ukjent = (i: number) => Math.max(0, ruteVekt(R, i) - andelIRute(R, M, i) * ruteFaktor(R, i));
  for (let r = 0; r < R.rader.length; r++) {
    const i = R.rader[r];
    if (r < nC) {
      const s = verdi(R.ryddet, i) === 1,
        b = !!B && verdi(B.ryddet, i) === 1;
      if (!s && !b) continue;
      const uk = ukjent(i);
      if (s) tell(G, i, uk);
      if (b) tell(GP, i, uk);
    } else if (verdi(B!.ryddet, i) === 1) tell(GP, i, ukjent(i));
  }
  return { nat: G.nat, ukjent: G.ukjent, eg: G.eg, plan: B ? GP : null };
}

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
   striper (unionen av områdene), antall områder som berøres (BERORT), per område (perOmrade, på samme plass som området i
   T.omrader, der overlapp telles i hvert område), og de berørte områdene med mest først (berorte, plassene i T.omrader). Ruter står
   både som antall og km². */
export function byggTemaIPlan(T: Temaet, K: Kryssing, klasser: [navn: string, farge: string][] | undefined) {
  const o = T.omrader,
    P = K.plan,
    plan = K.samlet,
    smal = K.samletSmal,
    berort = (i: number) => P[i] >= BERORT;
  return {
    klasser:
      klasser && T.klasser && o.length
        ? klasser.map((_, v) => ({ plan: K.kryss.S.alt[v], planKm2: K.kryss.S.alt[v] * K.ruteKm2 }))
        : null,
    plan,
    planKm2: plan * K.ruteKm2,
    smal,
    smalKm2: smal * K.ruteKm2,
    berort: o.filter((_, i) => berort(i)).length,
    perOmrade: Array.from(P, p => p * K.ruteKm2),
    berorte: o
      .map((_, i) => i)
      .filter(berort)
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

/* Tabellene gull.verneomrader, gull.villrein og gull.verdsattNatur: områdene i kommunen nr, med arealet A fra dekningsandelen
   (solv.vernAndel, solv.villreinAndel og solv.verdsattAndel): samlet og per verdikategori, der overlapp telles én gang. Hver tabell gir sitt eget areal, så koden viser hva hver
   av dem bygger på (verktoy/forklaringer.ts leser det). */
async function temaet(
  tema: Naturtema,
  nr: string,
  O: Temaomrader,
  A: Promise<{ sum: number; km2: number[] }>
): Promise<Temaet> {
  const [land, a] = await Promise.all([landareal(nr), A]);
  return byggTemaet(tema, nr, O, { sum: a.sum, klasser: a.km2 }, land);
}
export async function verneomrader(nr: string): Promise<Temaet> {
  return temaet(VERN, nr, await katalog.solv.verneomrader(nr), katalog.solv.vernAndel(nr));
}
export async function villrein(nr: string): Promise<Temaet> {
  return temaet(REIN, nr, await katalog.solv.villrein(nr), katalog.solv.villreinAndel(nr));
}
export async function verdsattNatur(nr: string): Promise<Temaet> {
  return temaet(VERDI, nr, await katalog.solv.verdsattNatur(nr), katalog.solv.verdsattAndel(nr));
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

/* Tabellene gull.utbyggingIVerneomrader, gull.utbyggingIVillrein og gull.utbyggingIVerdsattNatur: kolonnene for temaet i
   utbyggingen for kommunen nr (temaKolonne), med temaet (T) og utbyggingen (R) de er regnet av. null uten utbygging. Oppslagene for
   områdene huskes i solv.naturoppslag. */
export interface Temakolonne extends Andelskolonne {
  T: Temaet;
  R: Utbygging;
}
async function kolonne(tema: Naturtema, nr: string, T: Temaet, A: Promise<{ biter: Andelsbit[][] }>) {
  const [R, g, { biter }] = await Promise.all([katalog.gull.utbygging(nr), katalog.solv.grense(nr), A]);
  if (!R) return null;
  const navn = new Map<object, string>(T.omrader.map((o, i) => [o, `${tema.id}/${nr}/${i}`]));
  const kommune = () => katalog.solv.naturoppslag.straks('kommune/' + nr, () => naturSok(g, null))!.flate;
  const C = temaKolonne(
    T.omrader,
    R,
    biter,
    kommune,
    (o, lag) => katalog.solv.naturoppslag.straks(navn.get(o)!, lag),
    o => o.uklippet || !!tema.samlet
  );
  return { T, R, ...C };
}
export async function utbyggingIVerneomrader(nr: string): Promise<Temakolonne | null> {
  return kolonne(VERN, nr, await katalog.gull.verneomrader(nr), katalog.solv.vernAndel(nr));
}
export async function utbyggingIVillrein(nr: string): Promise<Temakolonne | null> {
  return kolonne(REIN, nr, await katalog.gull.villrein(nr), katalog.solv.villreinAndel(nr));
}
export async function utbyggingIVerdsattNatur(nr: string): Promise<Temakolonne | null> {
  return kolonne(VERDI, nr, await katalog.gull.verdsattNatur(nr), katalog.solv.verdsattAndel(nr));
}

/* Tabellene gull.verneomraderIPlan, gull.villreinIPlan og gull.verdsattNaturIPlan: planlagt utbygging i temaet, summert over
   kolonnene for temaet. null uten utbygging. */
function temaIPlan(tema: Naturtema, C: Temakolonne | null): TemaIPlan | null {
  if (!C) return null;
  const K = kryssNatur(C.R, C, C.T.omrader.length);
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
   er kartlagt for naturtyper etter Miljødirektoratets instruks. Der vet vi ikke om det finnes verdifull natur. Det kartlagte er
   dekningsandelen per rute (solv.kartlagtAndel), så en rute kan være delvis kartlagt. null uten utbygging, eller når det kartlagte ikke
   kan hentes. */
export type UtenforKartlagt = Gap & { natKm2: number; ukjentKm2: number; andel: number | null };
export async function utbyggingUtenforKartlagt(nr: string): Promise<UtenforKartlagt | null> {
  const [R, E, K] = await Promise.all([
    katalog.gull.utbygging(nr),
    katalog.solv.kartlagt(nr).catch(ikke),
    katalog.solv.kartlagtAndel(nr).catch(ikke)
  ]);
  if (!R || !E || !K) return null;
  const G = kryssKartlagt(R, K.biter[0]);
  const r = ruteKm2(R.z);
  return { ...G, natKm2: G.nat * r, ukjentKm2: G.ukjent * r, andel: andel(G.ukjent, G.nat) };
}

/* Tabellen gull.verdsattNaturIKartlagt: verdsatt natur per verdikategori innenfor det kartlagte i kommunen nr, fra dekningsandelen
   med det kartlagte som maske (solv.verdsattIKartlagtAndel), eller null når ingenting er kartlagt */
export async function verdsattNaturIKartlagt(nr: string): Promise<number[] | null> {
  const K = await katalog.solv.kartlagtAndel(nr);
  if (!(K.sum > 0)) return null;
  return (await katalog.solv.verdsattIKartlagtAndel(nr)).km2;
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
/* Tabellen gull.verdsattVurderes: lokalitetene fra solv.verdsattVurderes, med arealet per kategori i kommunen fra dekningsandelen
   (solv.vurderesAndel), så overlapp telles én gang, som for verdsatt natur */
export async function verdsattVurderes(nr: string): Promise<VerdsattVurderes> {
  const [T, A] = await Promise.all([katalog.solv.verdsattVurderes(nr), katalog.solv.vurderesAndel(nr)]),
    n = VURDERES.klasser!.length;
  return {
    omrader: T.omrader,
    antall: Array.from({ length: n }, (_, v) => T.omrader.filter(o => (o.v || 0) === v).length),
    klasser: A.km2,
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
