/* Gull: utbyggingen, midtpunktet i analysene. Kommuneplanen fra DiBK og egne områder lagt oppå dagens klasser fra NIBIO, i et
   rutenett med ruter på 10,6 meter, med smale striper tatt bort. Svarer på hvor det er planlagt utbygging, og hva som er der i dag.
   Alle kryssinger med planlagt utbygging går gjennom utbyggingen: temaene (gull/temaer.ts), grått areal (gull/graa.ts), tallene for
   planlagt utbygging (gull/planlagt.ts) og egne områder (gull/egne.ts).
   Hver kilde tolkes per rute i sølv: planen, med kommuneplanen (solv.kommuneplanruter) og egne områder (solv.egneruter) i samme
   datamodell, og dagens klasser (solv.klasser). Her settes de
   sammen: dagens klasser klippes til kommunen, et eget område erstatter kommuneplanen der det ligger, og planen legges oppå dagens
   klasser. Én rute er ruteKm2(z) km² (felles.ts). */
import { HEL, andelVed, hverRute, type Andel } from '../generelt/dekning.ts';
import { egenKopi } from '../generelt/kopi.ts';
import {
  BLOKK,
  blokkNokkel,
  finn,
  glissent,
  kopiAv,
  leggInnDelt,
  nummer,
  sett,
  verdi,
  verdier,
  type Glissen
} from '../generelt/glissen.ts';
import { katalog } from '../katalog.ts';
import { PLANNIVA, ruteM, type Flis, type Plassering } from '../solv/felles.ts';
import type { Egneruter } from '../solv/egne.ts';
import { klasserIKommunen } from '../solv/grunnkart.ts';
import { JOR, NAT } from '../solv/klasser.ts';
import { kommuneIBlokk } from '../solv/kommune.ts';
import { kanHaPlan } from '../solv/kommuneplan.ts';

/* Antall ruter: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging. Alle antall av ruter i
   utbyggingen er vektet: en rute langs kommunegrensen teller med den delen av den som ligger i kommunen, og alle ruter er rettet for
   målestokken i biten de ligger i (ruteVekt). Areal i km² er da antallet ganger ruteKm2. */
export interface Antall {
  beb: number;
  nat: number;
  jor: number;
  pnat: number;
  pjor: number;
}
/* Én flis i utbyggingen, fra kombinerBlokk. utenPlan sier at den er regnet uten kommuneplan. d og pl er null når de bare har 0, som i de fleste blokkene. andel er kommunens andel i blokken
   (null når hele blokken er i kommunen), og faktor målestokken i biten den ligger i. */
export interface Blokk {
  d: Uint8Array | null;
  kl: Uint8Array;
  pl: Uint8Array | null;
  n: Antall;
  utenPlan?: boolean;
  andel: Andel | null;
  faktor: number;
}
/* Utbyggingen med smale striper tatt bort: rutenettet den er laget av (alle, 1 natur og 2 jordbruk med smale striper), rutene med
   planlagt utbygging på natur eller jordbruk (celler), og det som er beholdt per rute (ryddet: 1 natur, 2 jordbruk). Hvor mye det er,
   telles av rutenettet med tellRyddet. */
export interface Rydding {
  alle: Glissen;
  celler: number[];
  ryddet: Glissen;
}
/* Kommuneplanen alene, ryddet for smale striper, og summen: den samme uansett egne områder, så den huskes mellom gangene utbyggingen
   regnes ut (gull.planAlene), så lenge blokkene med planen er de samme (d, i rekkefølgen i nokler) */
export interface PlanAlene {
  d: (Uint8Array | null)[];
  rydding: Rydding;
  sum: Ryddetsum;
}
/* Natur (rn) og jordbruk (rj) satt av, i ruter vektet med kommunens andel og målestokken */
export interface Ryddetsum {
  rn: number;
  rj: number;
}
/* Hva som ligger i et eget område i dag, i ruter: natur, jordbruk, bebygd, vann, og ukjent (utenfor kommunen eller uten klasse) */
export interface EgetTall {
  nat: number;
  jor: number;
  beb: number;
  vann: number;
  ukjent: number;
}
/* Tabellen gull.utbygging: utbyggingen i kommunen, se byggUtbygging. Radene (rader) er rutene med planlagt utbygging på natur
   eller jordbruk: først de med planen og egne områder (celler, med smale striper), så de som bare planen alene har, der egne
   områder har tatt planen bort, også i smale striper. Kolonnene for temaene (gull/temaer.ts) står i samme rekkefølge. egneIder er de
   egne områdene utbyggingen er regnet med, i rekkefølge. En analyse av planlagt utbygging regnes over et utvalg av utbyggingen
   (Utvalg under): den nye planen eller den gamle, i hele kommunen eller i ett eget område.
   Rutenettene er glisne (generelt/glissen.ts): bare blokkene som har noe, finnes, og de leses med verdi(L, i). Dagens klasser (kl)
   har alle blokkene i kommunen. Planen (alle, ryddet, pl) og egne områder har bare blokkene der det er planlagt utbygging eller egne
   områder. */
export interface Utbygging extends Plassering {
  nr: string;
  h: number;
  alle: Glissen /* med smale striper */;
  ryddet: Glissen /* uten smale striper */;
  celler: Int32Array;
  eget: Glissen | null /* hvilket eget område ruta hører til, 1, 2 og så videre */;
  egetType: Glissen | null /* 1 utbygging, 2 ikke utbygging */;
  kl: Glissen;
  pl: Glissen;
  antallEgne: number;
  basis: Rydding | null /* kommuneplanen alene, når det finnes egne områder */;
  sum: Ryddetsum /* talt av ryddet */;
  basisSum: Ryddetsum | null /* talt av basis.ryddet */;
  iDag: { nat: number; jor: number };
  n: Antall;
  fliser: number;
  rute: number;
  egneTall: EgetTall[];
  rader: Int32Array;
  egneIder: number[];
  andeler: Map<number, Andel> /* kommunens andel i blokkene langs grensen, etter blokkNokkel */;
  faktorer: Map<number, number> /* målestokken per blokk, etter blokkNokkel */;
  alene: PlanAlene /* kommuneplanen alene, til neste gang utbyggingen regnes ut */;
}
/* Vekten til rute i i utbyggingen R: den delen av ruta som ligger i kommunen, ganger målestokken i biten */
export function ruteVekt(R: Pick<Utbygging, 'cx0' | 'cy0' | 'w' | 'andeler' | 'faktorer'>, i: number): number {
  const y = (i / R.w) | 0,
    X = R.cx0 + i - y * R.w,
    Y = R.cy0 + y,
    k = (X >> 9) * 65536 + (Y >> 9) /* blokkNokkel, med skift fordi BLOKK er 512 */,
    A = R.andeler.get(k),
    f = R.faktorer.get(k);
  return (A ? andelVed(A, X & 511, Y & 511) / HEL : 1) * (f === undefined ? 1 : f);
}
/* Målestokken i biten rute i i utbyggingen R ligger i */
export function ruteFaktor(R: Pick<Utbygging, 'cx0' | 'cy0' | 'w' | 'faktorer'>, i: number): number {
  const y = (i / R.w) | 0,
    f = R.faktorer.get(((R.cx0 + i - y * R.w) >> 9) * 65536 + ((R.cy0 + y) >> 9));
  return f === undefined ? 1 : f;
}

/* Én flis: kommuneplanen lagt oppå dagens klasser. kl er dagens klasse per rute fra klasserIFlis (0 ukjent), plan planlagt
   utbygging per rute fra solv.kommuneplanruter (null uten kommuneplan).
   Gir per rute:
     d:  0 ingenting, 1 natur og 2 jordbruk satt av til utbygging
     kl: dagens klasse, 0 ukjent, 1 bebygd, 2 jordbruk, 3 natur, 4–6 vann
     pl: 1 der det er planlagt utbygging på land, også der det alt er bebygd
   og antall ruter n: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging, vektet med kommunens
   andel i blokken (andel, null når hele blokken er i kommunen) og målestokken (faktor). */
export function kombinerBlokk(kl: Uint8Array, plan: Uint8Array | null, andel: Andel | null = null, faktor = 1): Blokk {
  const d = new Uint8Array(262144),
    pl = new Uint8Array(262144),
    n: Antall = { beb: 0, nat: 0, jor: 0, pnat: 0, pjor: 0 };
  let vekt: Float32Array | null = null;
  if (andel) {
    const V = (vekt = new Float32Array(262144));
    hverRute(andel, (q, a) => (V[q] = a / HEL));
  }
  for (let q = 0; q < 262144; q++) {
    if (!kl[q]) continue;
    const k = kl[q] - 1,
      p = !!plan && plan[q] === 1 /* halvregelen er brukt i sølv */,
      v = (vekt ? vekt[q] : 1) * faktor;
    if (p && k <= NAT) pl[q] = 1;
    if (!k) {
      n.beb += v;
      continue;
    }
    if (k !== JOR && k !== NAT) continue; /* vann telles ikke */
    const jor = k === JOR;
    if (jor) {
      n.jor += v;
      if (p) n.pjor += v;
    } else {
      n.nat += v;
      if (p) n.pnat += v;
    }
    if (p) d[q] = jor ? 2 : 1;
  }
  const noe = (a: Uint8Array) => {
    for (let q = 0; q < a.length; q++) if (a[q]) return true;
    return false;
  }; /* en vanlig løkke: some() med en funksjon per rute tok flere sekunder i store kommuner */
  return { d: noe(d) ? d : null, kl, pl: noe(pl) ? pl : null, n, andel, faktor };
}

/* Smale striper: felt som ikke er bredere enn to ruter (rundt 20 meter) noe sted. De oppstår mest der plangrensen og grunnkartet
   ikke er tegnet helt likt, ofte langs eksisterende bebyggelse. Først finnes kjernene, altså ruter med planlagt utbygging på alle
   fire sider. Så beholdes alt som henger sammen med en kjerne, også på skrå. Et større felt beholdes dermed helt, også der det
   smalner av, og bare felt uten kjerne faller bort. d er rutenettet (1 natur, 2 jordbruk). Naboene finnes med nummeret på ruta,
   som i et vanlig rutenett med bredden w. Gir de beholdte rutene (ryddet). */
export function ryddStriper(d: Glissen): Rydding {
  const w = d.w,
    n = d.w * d.h,
    v = (i: number) => verdi(d, i),
    celler = finn(d, x => x === 1 || x === 2);
  const ryddet = glissent(d);
  let front: number[] = [];
  for (const i of celler) {
    const x = i % w;
    if (x > 0 && x < w - 1 && i >= w && i < n - w && v(i - 1) && v(i + 1) && v(i - w) && v(i + w)) {
      sett(ryddet, i, v(i)!);
      front.push(i);
    }
  }
  while (front.length) {
    const ny: number[] = [];
    for (const i of front)
      for (const j of [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]) {
        const x = v(j);
        if ((x === 1 || x === 2) && !verdi(ryddet, j)) {
          sett(ryddet, j, x);
          ny.push(j);
        }
      }
    front = ny;
  }
  return { alle: d, celler, ryddet };
}
/* Natur (1) og jordbruk (2) i det ryddede rutenettet L, blokk for blokk: hver rute vektet med kommunens andel i blokken (andeler,
   ingen når hele blokken er i kommunen) og målestokken (faktorer). Tallene regnes alltid av rutenettet de beskriver, når det er
   ferdig, så de to ikke kan bli uenige. */
export function tellRyddet(L: Glissen, andeler: Map<number, Andel>, faktorer: Map<number, number>): Ryddetsum {
  let rn = 0,
    rj = 0;
  for (const [k, b] of L.blokker) {
    const A = andeler.get(k),
      f = faktorer.get(k) ?? 1;
    if (!A) {
      let n = 0,
        j = 0;
      for (let q = 0; q < b.length; q++)
        if (b[q] === 1) n++;
        else if (b[q] === 2) j++;
      rn += n * f;
      rj += j * f;
      continue;
    }
    for (let q = 0; q < b.length; q++) {
      const v = b[q];
      if (v !== 1 && v !== 2) continue;
      const w = (andelVed(A, q % BLOKK, Math.floor(q / BLOKK)) / HEL) * f;
      if (v === 1) rn += w;
      else rj += w;
    }
  }
  return egenKopi({ rn, rj }); /* summen for planen alene brukes igjen neste gang, se generelt/kopi.ts */
}

/* Setter flisene sammen til ett rutenett for kommunen, legger inn egne områder og rydder bort smale striper. nr er kommunen,
   Z nivået rutenettet er på, nokler er [x, y] for flisene på nivå Z, blokker resultatene fra kombinerBlokk per flis («Z/x/y»), E er
   de egne områdene per rute fra solv.egneruter (null uten), og rute er rutestørrelsen i meter slik den skal oppgis.
   Rutenettet er glissent: blokkene fra kombinerBlokk deles, og bare blokkene med planlagt utbygging eller egne områder er med i
   planen. Rutene har samme nummer som i ett stort rutenett over alle flisene.
   Med egne områder regnes også kommuneplanen alene (basis), så de samme analysene kan regnes for begge planene (Utvalg under). For
   hvert eget område telles hva som ligger der i dag. */
export function byggUtbygging(
  nr: string,
  Z: number,
  nokler: number[][],
  blokker: Map<string, Blokk>,
  E: Egneruter | null,
  rute: number,
  alene: PlanAlene | null = null
): Utbygging {
  const tx0 = Math.min(...nokler.map(t => t[0])),
    ty0 = Math.min(...nokler.map(t => t[1]));
  const G = {
    cx0: tx0 * BLOKK,
    cy0: ty0 * BLOKK,
    w: (Math.max(...nokler.map(t => t[0])) - tx0 + 1) * BLOKK,
    h: (Math.max(...nokler.map(t => t[1])) - ty0 + 1) * BLOKK
  };
  let d = glissent(G);
  const kl = glissent(G),
    pl = glissent(G),
    n: Antall = { beb: 0, nat: 0, jor: 0, pnat: 0, pjor: 0 },
    andeler = new Map<number, Andel>(),
    faktorer = new Map<number, number>();
  for (const [x, y] of nokler) {
    const b = blokker.get(`${Z}/${x}/${y}`)!;
    if (b.d) leggInnDelt(d, x, y, b.d);
    if (b.pl) leggInnDelt(pl, x, y, b.pl);
    leggInnDelt(kl, x, y, b.kl);
    for (const k in n) n[k as keyof Antall] += b.n[k as keyof Antall];
    if (b.andel) andeler.set(blokkNokkel(x, y), b.andel);
    faktorer.set(blokkNokkel(x, y), b.faktor);
  }
  const vekt = (i: number) => ruteVekt({ ...G, andeler, faktorer }, i);
  /* Egne områder: innenfor hvert område erstatter det kommuneplanen. */
  let basis: Rydding | null = null,
    eget: Glissen | null = null,
    egetType: Glissen | null = null;
  const egneIder = E ? E.ider : [];
  const planensBlokker = nokler.map(([x, y]) => blokker.get(`${Z}/${x}/${y}`)!.d || null),
    sammeBlokker =
      !!alene && alene.d.length === planensBlokker.length && alene.d.every((b, k) => b === planensBlokker[k]),
    kommuneplanen = sammeBlokker ? alene!.rydding : ryddStriper(d);
  if (E) {
    basis = kommuneplanen;
    d = kopiAv(d);
    eget = glissent(G);
    egetType = glissent(G);
    leggInnEgne(E, d, kl, eget, egetType);
  }
  const { celler, ryddet } = E ? ryddStriper(d) : kommuneplanen;
  const egneTall: EgetTall[] = egneIder.map(() => ({ nat: 0, jor: 0, beb: 0, vann: 0, ukjent: 0 }));
  if (eget)
    for (const i of finn(eget, e => e !== 0)) {
      const T = egneTall[verdi(eget, i)! - 1],
        c = verdi(kl, i)!,
        v = c ? vekt(i) : 1; /* utenfor kommunen er ruta ukjent, og telles helt */
      if (c === 3) T.nat += v;
      else if (c === 2) T.jor += v;
      else if (c === 1) T.beb += v;
      else if (c >= 4) T.vann += v;
      else T.ukjent += v;
    }
  /* Radene: rutene med planlagt utbygging nå, og så rutene som bare planen alene har, der egne områder har tatt planen bort, også
     i smale striper */
  const iD = basis ? verdier(d, basis.celler) : null,
    bareBasis = basis ? basis.celler.filter((_, k) => iD![k] !== 1 && iD![k] !== 2) : [],
    planSum = sammeBlokker ? alene!.sum : tellRyddet(kommuneplanen.ryddet, andeler, faktorer);
  const rader = Int32Array.from([...celler, ...bareBasis]);
  return {
    nr,
    z: Z,
    ...G,
    alle: d,
    ryddet,
    celler: Int32Array.from(celler),
    eget,
    egetType,
    kl,
    pl,
    antallEgne: egneIder.length,
    basis,
    sum: E ? tellRyddet(ryddet, andeler, faktorer) : planSum,
    basisSum: basis ? planSum : null,
    alene: { d: planensBlokker, rydding: kommuneplanen, sum: planSum },
    iDag: { nat: n.nat, jor: n.jor },
    n,
    fliser: nokler.length,
    rute,
    egneTall,
    rader,
    egneIder,
    andeler,
    faktorer
  };
}

/* Planen en analyse av planlagt utbygging regnes for: den nye, med egne områder (ny), eller den gamle, kommuneplanen alene (gammel).
   Uten egne områder er de den samme. */
export type Planvalg = 'ny' | 'gammel';
/* Det en analyse av planlagt utbygging regnes over: utbyggingen (R), planen, rutene med planlagt utbygging på natur eller jordbruk i
   den planen, også i smale striper (celler), og rutenettene planen er laget av (alle, med smale striper) og det som er beholdt
   (ryddet). omrade er null for hele kommunen, ellers nummeret til et eget område (1 er det første), og da er bare rutene i det
   området med. Alle analysene regnes med de samme funksjonene for begge planene og alle utvalgene, så det eneste som skiller dem, er
   hvilken plan som ligger i utbyggingen, og hvilke ruter som er med. For hver rute i celler står også raden den har i utbyggingen
   (rader, −1 når den ikke har noen), og verdien i alle og ryddet (alleV og ryddetV), slått opp én gang, så analysene slipper. */
export interface Utvalg {
  R: Utbygging;
  plan: Planvalg;
  omrade: number | null;
  celler: Int32Array;
  alle: Glissen;
  ryddet: Glissen;
  rader: Int32Array;
  alleV: Uint8Array;
  ryddetV: Uint8Array;
}
/* Raden i utbyggingen R for hver rute i celler (stigende), eller −1. Radene er to stigende rekker: rutene med planlagt utbygging nå
   (R.celler), så de som bare planen alene har. Begge gås gjennom sammen med cellene, så det tar ett løp. */
function raderFor(R: Utbygging, celler: Int32Array): Int32Array {
  const ut = new Int32Array(celler.length).fill(-1),
    nC = R.celler.length,
    nR = R.rader.length;
  let a = 0,
    b = nC;
  for (let k = 0; k < celler.length; k++) {
    const i = celler[k];
    while (a < nC && R.rader[a] < i) a++;
    if (a < nC && R.rader[a] === i) {
      ut[k] = a;
      continue;
    }
    while (b < nR && R.rader[b] < i) b++;
    if (b < nR && R.rader[b] === i) ut[k] = b;
  }
  return ut;
}
export function byggUtvalg(R: Utbygging, plan: Planvalg = 'ny', omrade: number | null = null): Utvalg {
  const B = plan === 'gammel' ? R.basis : null,
    alle = B ? B.alle : R.alle,
    ryddet = B ? B.ryddet : R.ryddet,
    alleCeller = B ? Int32Array.from(B.celler) : R.celler,
    i = omrade !== null && R.eget ? verdier(R.eget, alleCeller) : null,
    celler = omrade === null ? alleCeller : i ? alleCeller.filter((_, k) => i[k] === omrade) : new Int32Array(0);
  return {
    R,
    plan,
    omrade,
    alle,
    ryddet,
    celler,
    rader: raderFor(R, celler),
    alleV: verdier(alle, celler),
    ryddetV: verdier(ryddet, celler)
  };
}
/* Nøkkelen for et utvalg i tabellene i gull: kommunenummeret for den nye planen i hele kommunen, som sidene ellers spør med, og ellers
   med planen og området etter, som 5001/gammel, 5001/ny/2 og 5001/gammel/2 */
export const utvalgsnokkel = (nr: string, plan: Planvalg, omrade: number | null = null) =>
  nr + (plan === 'ny' && omrade === null ? '' : '/' + plan + (omrade === null ? '' : '/' + omrade));
/* Kommunen, planen og området i en nøkkel fra utvalgsnokkel */
export function lesUtvalg(n: string): { nr: string; plan: Planvalg; omrade: number | null } {
  const [nr, plan, o] = n.split('/');
  return { nr, plan: plan === 'gammel' ? 'gammel' : 'ny', omrade: o ? Number(o) : null };
}
/* Tabellen gull.utvalg: utvalget nøkkelen n gir, i utbyggingen for kommunen (byggUtvalg). Alle analysene for et utvalg bruker det samme,
   så rutene og verdiene slås opp én gang. null uten utbygging. */
export async function utvalg(n: string): Promise<Utvalg | null> {
  const u = lesUtvalg(n),
    R = await katalog.gull.utbygging(u.nr);
  return R ? byggUtvalg(R, u.plan, u.omrade) : null;
}

/* Egne områder inn i utbyggingen: innenfor et eget område erstatter det kommuneplanen. E er områdene per rute fra solv.egneruter, d
   rutenettet for planlagt utbygging og kl dagens klasser. Som utbygging tar området all natur og alt jordbruk i ruta. Som ikke
   utbygging fjerner det planlagt utbygging der. Fyller eget (hvilket område ruta hører til) og egetType (1 utbygging, 2 ikke
   utbygging), og endrer d. */
export function leggInnEgne(E: Egneruter, d: Glissen, kl: Glissen, eget: Glissen, egetType: Glissen) {
  for (let y = 0; y < E.h; y++)
    for (let x = 0; x < E.w; x++) {
      const q = y * E.w + x,
        o = E.omrade[q],
        i = o ? nummer(d, E.cx0 + x, E.cy0 + y) : -1;
      if (i < 0) continue;
      const t = E.plan[q];
      sett(eget, i, o);
      sett(egetType, i, t);
      if (t === 1) {
        const c = verdi(kl, i);
        if (c === 3) sett(d, i, 1);
        else if (c === 2) sett(d, i, 2);
      } else {
        const v = verdi(d, i);
        if (v === 1 || v === 2) sett(d, i, 0);
      }
    }
}

/* Tabellen gull.utbygging: utbyggingen i kommunen nr. null når det ikke finnes noe å regne på: uten kommuneplan og uten egne
   områder, eller når dagens klasser mangler.
   Dagens klasser kommer fra blokkene (solv.klasser) på nivå 10, lagret eller hentet fra NIBIO når kommunen velges
   (gull.dagensKlasser), klippet til kommunen med kommunens andel i hver rute (solv.kommunebiter), og hele kommunen er med. Egne
   områder kommer fra solv.egneruter.
   Utbyggingen bygges av blokker på 512 x 512 ruter à 10,6 meter, én per flis på nivå 10 (PLANNIVA). Blokkene huskes i
   gull.utbyggingsblokker. Det gir et anslag til illustrasjon, ikke offisiell statistikk. */
export async function utbygging(nr: string): Promise<Utbygging | null> {
  const [info, E, D, KB] = await Promise.all([
    katalog.solv.planinfo(nr).catch(() => null),
    katalog.solv.egneruter(nr),
    katalog.gull.dagensKlasser(nr),
    katalog.solv.kommunebiter(nr)
  ]);
  const ingenPlan = !!info && !info.finnes;
  if ((ingenPlan && !E) || !D.blokker) return null;
  const O = ingenPlan ? null : await katalog.solv.planoversikt(nr).catch(() => null) /* uten oversikt hentes alle */,
    Z = PLANNIVA,
    blokker = katalog.gull.utbyggingsblokker.straks(nr, () => new Map<string, Blokk>()),
    under = (await katalog.solv.blokker([nr, Z])).map(([, x, y]) => [x, y]);
  for (const k of [...blokker.keys()]) if (!k.startsWith(`${Z}/`)) blokker.delete(k); /* blokker på et annet nivå */
  await Promise.all(
    under.map(async ([x, y]) => {
      const har = blokker.get(`${Z}/${x}/${y}`);
      if (har && har.kl && har.utenPlan === ingenPlan) return;
      const tc: Flis = [Z, x, y],
        kom = kommuneIBlokk(KB, tc);
      const [kl, P] = await Promise.all([
        katalog.solv.klasser(tc).then(K => klasserIKommunen(K, kom.andel)),
        ingenPlan || (O && !kanHaPlan(O, tc)) ? null : katalog.solv.kommuneplanruter(tc)
      ]);
      blokker.set(`${Z}/${x}/${y}`, {
        ...kombinerBlokk(kl, P ? P.plan : null, kom.andel, kom.faktor),
        utenPlan: ingenPlan
      });
    })
  );
  if (E && E.z !== Z) throw new Error('egne områder er regnet på et annet nivå');
  /* kommuneplanen alene fra sist, når blokkene er de samme (se PlanAlene) */
  const A = katalog.gull.planAlene.straks(nr, () => ({ alene: null as PlanAlene | null })),
    R = byggUtbygging(nr, Z, under, blokker, E, Math.round(ruteM(Z) * 10) / 10 /* 10,6 meter */, A.alene);
  A.alene = R.alene;
  return R;
}
