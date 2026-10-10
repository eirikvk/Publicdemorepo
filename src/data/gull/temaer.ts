/* Gull for naturtemaene: arealet av verdsatt natur per verdikategori, kryssingen med planrutenettet (hvor mye planlagt utbygging
   som ligger i hvert område), og tallene temasidene viser. Bygger på flatene og maskene i sølv (solv/temaer.ts) og
   planrutenettet (solv/planrutenett.ts). Arealer er i km², kryssinger i ruter. */
import {
  HALV,
  RUTE,
  RUTENETT_VERDI,
  m2PerKm2,
  omriss,
  ruteX,
  ruteY,
  rutenett,
  type Flerflate,
  type FlateMedUtsnitt,
  type Ring,
  type Utsnitt
} from '../solv/felles.ts';
import type { Planrutenett } from '../solv/planrutenett.ts';
import { sti, tegneflate } from '../solv/raster.ts';
import { naturMaske, type Kartlagt, type Maske, type Omrade } from '../solv/temaer.ts';
import { andel } from './felles.ts';

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
/* Et område slik datamotoren har det, med utsnittet */
export interface TemaOmrade extends Omrade {
  ext: Utsnitt;
}
/* Det som er hentet og regnet ut for et naturtema i valgt kommune: områdene, arealet samlet og per verdikategori, det kartlagte og
   verdsatt natur innenfor det (inne), og kryssingen med planen når den er regnet ut (regnet) */
export interface TemaData {
  nr: string;
  feil?: boolean;
  omrader: TemaOmrade[];
  sum: number;
  klasser?: number[] | null;
  ufullstendig?: boolean;
  ekstra?: Kartlagt | null;
  inne?: number[];
  regnet?: boolean;
  plan?: Int32Array;
  smal?: Int32Array;
  kryss?: { S: Kryss; P: Kryss | null } | null;
  gap?: Gap | null;
}
/* Gir masken til et område. lag() lager den, og den som kaller, kan huske den per område (nokkel). */
export type HuskMaske = (nokkel: object, lag: () => Maske | null) => Maske | null;

/* Omløpsretningen til en ring: true når den går mot klokka */
const motKlokka = (ring: Ring) => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a > 0;
};
/* Verdsatt natur: mange små flater som overlapper. Arealet per verdikategori finnes ved å tegne flatene i et rutenett over kommunen
   og summere dekningen i rutene. Én tegning per kategori, der alle flater med minst den verdien tegnes som én sammenhengende form og
   klippes mot kommunen. Forskjellen mellom tegningene gir arealet per kategori uten dobbelttelling: der lokaliteter overlapper,
   teller den høyeste verdien, slik kartet også viser det. omrader har verdien v (0 er høyest). innenfor er en flerflate arealet
   også klippes mot, for eksempel det kartlagte. */
export function klasseAreal(omrader: Omrade[], antall: number, kommune: FlateMedUtsnitt, innenfor?: Flerflate) {
  const skala = m2PerKm2(kommune.ext),
    { res, w, h, u } = rutenett(kommune.ext, ...RUTENETT_VERDI);
  const g = tegneflate(w, h),
    kum: number[] = [];
  for (let v = 0; v < antall && omrader.length; v++) {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.beginPath();
    for (const o of omrader) {
      if ((o.v || 0) > v) continue;
      for (const flate of o.koord)
        flate.forEach((ring, nr) => {
          /* ytterkanter én vei og hull motsatt vei, så overlapp fylles og hull blir hull */
          const snu = motKlokka(ring) !== (nr === 0),
            n = ring.length;
          for (let i = 0; i < n; i++) {
            const q = ring[snu ? n - 1 - i : i],
              x = (q[0] - u[0]) / res,
              y = (u[3] - q[1]) / res;
            if (i) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.closePath();
        });
    }
    g.fill('nonzero');
    g.globalCompositeOperation = 'destination-in';
    sti(g, kommune.koord, u, 1 / res);
    g.fill('evenodd');
    if (innenfor) {
      sti(g, innenfor, u, 1 / res);
      g.fill('evenodd');
    }
    const d = g.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 3; i < d.length; i += 4) sum += d[i];
    kum.push(((sum / 255) * res * res) / skala);
  }
  return {
    klasser: Array.from({ length: antall }, (_, v) => Math.max(0, (kum[v] || 0) - (v ? kum[v - 1] || 0 : 0))),
    sum: kum.length ? kum[kum.length - 1] : 0
  };
}

/* Kryssing med planrutenettet: midtpunktet i hver rute med planlagt utbygging slås opp i maskene for temaets områder. En rute telles
   én gang per tema, i det første området den treffer. D er temaets data (områdene og eventuelt kartleggingen), R planrutenettet,
   nK antall verdikategorier, medDekning om utbygging på natur skal deles i kartlagt og ikke kartlagt, og kommune flaten uklippede
   områder klippes mot.
   Gir ruter per område (plan, og smal for ruter i smale striper), per verdikategori for planen med egne områder (S) og planen alene
   (P), og gap: ruter med planlagt utbygging på natur, og hvor mange av dem som ligger utenfor det kartlagte. Maskene lages med
   naturMaske i sølv. maske(nokkel, lag) gir masken: den som kaller, kan huske maskene per område (nokkel) og bare kalle lag() første
   gang. */
export function kryssNatur(
  D: TemaData,
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
export const samletAreal = (omrader: Omrade[]) => omrader.reduce((s, o) => s + o.km2, 0);

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
    P = D.plan || new Int32Array(o.length); /* ruter med planlagt utbygging per område, fra kryssNatur */
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
      si = inne.reduce((a, b) => a + b, 0),
      su = ute.reduce((a, b) => a + b, 0);
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
  const plan = P.reduce((s, x) => s + x, 0),
    smal = (D.smal || new Int32Array(0)).reduce((s, x) => s + x, 0),
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
    berort: o.filter((x, i) => P[i]).length,
    gap: G ? { nat: G.nat, natKm2: G.nat * RUTE, ukjentKm2: G.ukjent * RUTE, andel: andel(G.ukjent, G.nat) } : null,
    vises: (samlet
      ? o
          .map((x, i) => i)
          .filter(i => P[i])
          .sort((a, b) => P[b] - P[a])
      : o.map((x, i) => i)
    ).map(i => ({
      omr: o[i],
      nr: i,
      planKm2: P[i] * RUTE
    }))
  };
}
/* Det temasiden viser, fra byggNaturTall */
export type NaturTall = ReturnType<typeof byggNaturTall>;
