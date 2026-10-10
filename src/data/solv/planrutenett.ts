/* Sølv for kommuneplanen og grunnkartet: planrutenettet. Kommuneplanen og egne områder lagt oppå dagens klasser i et rutenett med
   ruter på 21 meter, med smale striper tatt bort. Planen og dagens klasser kommer som kartbilder på nivå 9, én flis (512 x 512
   ruter) om gangen. Gir klasse og plan per rute, og antall ruter av hvert slag. Én rute er RUTE km². Alle kryssinger i gull går
   gjennom dette rutenettet. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import {
  BILDE_PLANDEKNING,
  HALV,
  PLANNIVA,
  PLAN_FINNES,
  RUTE_M,
  SYNLIG,
  rutenett,
  type Flis,
  type Piksler,
  type Plassering
} from './felles.ts';
import { leggInnEget, type Flater } from './egne.ts';
import { JOR, NAT, klasseAv } from './klasser.ts';
import { bildePiksler, flatePiksler } from './raster.ts';

/* Antall ruter: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging */
export interface Antall {
  beb: number;
  nat: number;
  jor: number;
  pnat: number;
  pjor: number;
}
/* Én flis i planrutenettet, fra tellBlokk. sig sier hvor mange kartfliser den er regnet av (-1 for hele kommunen), og utenPlan at
   den er regnet uten kommuneplan. */
export interface Blokk {
  sig: number;
  d: Uint8Array;
  kl: Uint8Array;
  pl: Uint8Array;
  n: Antall;
  utenPlan?: boolean;
}
/* Planrutenettet med smale striper tatt bort: rutene med planlagt utbygging på natur eller jordbruk (celler), det som er beholdt
   per rute (ryddet: 1 natur, 2 jordbruk), og antallet natur (rn) og jordbruk (rj) som er beholdt */
export interface Rydding {
  celler: number[];
  ryddet: Uint8Array;
  rn: number;
  rj: number;
}
/* Hva som ligger i et eget område i dag, og hva planen alene (fnat, fjor) og planen med egne områder (nnat, njor) tar, i ruter */
export interface EgetTall {
  nat: number;
  jor: number;
  beb: number;
  vann: number;
  ukjent: number;
  fnat: number;
  fjor: number;
  nnat: number;
  njor: number;
}
/* Planrutenettet for kommunen, se byggPlanRaster */
export interface Planrutenett extends Plassering {
  nr: string;
  h: number;
  alle: Uint8Array /* med smale striper */;
  ryddet: Uint8Array /* uten smale striper */;
  celler: Int32Array;
  eget: Uint8Array | null /* hvilket eget område ruta hører til, 1, 2 og så videre */;
  egetType: Uint8Array | null /* 1 utbygging, 2 ikke utbygging */;
  kl: Uint8Array;
  pl: Uint8Array;
  antallEgne: number;
  basis: Rydding | null /* kommuneplanen alene, når det finnes egne områder */;
  sum: { rn: number; rj: number };
  iDag: { nat: number; jor: number };
  n: Antall;
  delvis: boolean;
  fliser: number;
  rute: number;
  egneTall: EgetTall[];
}

/* Én flis: dagens klasser lagt oppå planen. K er dagens klasser og P planen, begge som piksler (RGBA). tc er flisen [z, x, y].
   fliser er kartflisene som er hentet innenfor, eller null når hele kommunen er kjent. Uten hentet kart er ruta ukjent (3).
   Gir per rute:
     d:  0 ingenting, 1 natur og 2 jordbruk satt av til utbygging, 3 ukjent
     kl: dagens klasse, 0 ukjent, 1 bebygd, 2 jordbruk, 3 natur, 4–6 vann
     pl: 1 der det er planlagt utbygging på land, også der det alt er bebygd
   og antall ruter n: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging. */
export function tellBlokk(K: Piksler, P: Piksler, tc: Flis, fliser: Flis[] | null): Blokk {
  const d = new Uint8Array(262144),
    kl = new Uint8Array(262144),
    pl = new Uint8Array(262144),
    n: Antall = { beb: 0, nat: 0, jor: 0, pnat: 0, pjor: 0 };
  if (fliser) {
    d.fill(3);
    for (const [z, x, y] of fliser) {
      const sh = z - tc[0],
        s = 512 >> sh,
        cx = ((x * 512) >> sh) - tc[1] * 512,
        cy = ((y * 512) >> sh) - tc[2] * 512;
      for (let j = 0; j < s; j++) d.fill(0, (cy + j) * 512 + cx, (cy + j) * 512 + cx + s);
    }
  }
  for (let i = 0, q = 0; i < K.length; i += 4, q++) {
    if (K[i + 3] < SYNLIG) continue;
    const k = klasseAv(K[i], K[i + 1], K[i + 2]),
      plan = P[i + 3] >= HALV; /* halvregelen: minst halve ruta ligger i en planflate */
    kl[q] = k + 1;
    if (plan && k <= NAT) pl[q] = 1;
    if (!k) {
      n.beb++;
      continue;
    }
    if (k !== JOR && k !== NAT) continue; /* vann telles ikke */
    const jor = k === JOR;
    if (jor) {
      n.jor++;
      if (plan) n.pjor++;
    } else {
      n.nat++;
      if (plan) n.pnat++;
    }
    if (plan) d[q] = jor ? 2 : 1;
  }
  return { sig: fliser ? fliser.length : -1, d, kl, pl, n };
}

/* Smale striper: felt som ikke er bredere enn to ruter (rundt 40 meter) noe sted. De oppstår mest der plangrensen og grunnkartet
   ikke er tegnet helt likt, ofte langs eksisterende bebyggelse. Først finnes kjernene, altså ruter med planlagt utbygging på alle
   fire sider. Så beholdes alt som henger sammen med en kjerne, også på skrå. Et større felt beholdes dermed helt, også der det
   smalner av, og bare felt uten kjerne faller bort. d er rutenettet (1 natur, 2 jordbruk, 3 ukjent) og w bredden. Ukjente ruter
   teller som naboer, så et felt ikke skrelles av langs kanten av det som er hentet. Gir de beholdte rutene (ryddet) og antallet
   natur (rn) og jordbruk (rj) i dem. */
export function ryddStriper(d: Uint8Array, w: number): Rydding {
  const celler: number[] = [];
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    if (v === 1 || v === 2) celler.push(i);
  }
  const ryddet = new Uint8Array(d.length);
  let front: number[] = [];
  for (const i of celler) {
    const x = i % w;
    if (x > 0 && x < w - 1 && i >= w && i < d.length - w && d[i - 1] && d[i + 1] && d[i - w] && d[i + w]) {
      ryddet[i] = d[i];
      front.push(i);
    }
  }
  while (front.length) {
    const ny: number[] = [];
    for (const i of front)
      for (const j of [i - 1, i + 1, i - w, i + w, i - w - 1, i - w + 1, i + w - 1, i + w + 1]) {
        const v = d[j];
        if ((v === 1 || v === 2) && !ryddet[j]) {
          ryddet[j] = v;
          ny.push(j);
        }
      }
    front = ny;
  }
  let rn = 0,
    rj = 0;
  for (const i of celler) {
    if (ryddet[i] === 1) rn++;
    else if (ryddet[i] === 2) rj++;
  }
  return { celler, ryddet, rn, rj };
}

/* Setter flisene sammen til ett rutenett for kommunen, legger inn egne områder og rydder bort smale striper. nr er kommunen,
   nokler er [x, y] for flisene på nivå 9, blokker resultatene fra tellBlokk per flis («x/y»), delvis sier at bare en del av
   kommunen er hentet, E er de egne områdene, og rute er rutestørrelsen i meter slik den skal oppgis.
   Med egne områder regnes også kommuneplanen alene (basis), så forskjellen kan vises. For hvert eget område telles hva som ligger
   der i dag, hva planen alene tar (fnat, fjor) og hva som går med nå (nnat, njor). */
export function byggPlanRaster(
  nr: string,
  nokler: number[][],
  blokker: Map<string, Blokk>,
  delvis: boolean,
  E: Flater[],
  rute: number
): Planrutenett {
  const Z = PLANNIVA,
    kant = delvis ? 1 : 0,
    tx0 = Math.min(...nokler.map(t => t[0])),
    ty0 = Math.min(...nokler.map(t => t[1]));
  const cx0 = tx0 * 512 - kant,
    cy0 = ty0 * 512 - kant,
    w = (Math.max(...nokler.map(t => t[0])) - tx0 + 1) * 512 + 2 * kant,
    h = (Math.max(...nokler.map(t => t[1])) - ty0 + 1) * 512 + 2 * kant;
  let d = new Uint8Array(w * h);
  const kl = new Uint8Array(w * h),
    pl = new Uint8Array(w * h),
    n: Antall = { beb: 0, nat: 0, jor: 0, pnat: 0, pjor: 0 };
  if (delvis) d.fill(3);
  for (const [x, y] of nokler) {
    const b = blokker.get(`${x}/${y}`)!,
      start = ((y - ty0) * 512 + kant) * w + (x - tx0) * 512 + kant;
    for (let r = 0; r < 512; r++) {
      d.set(b.d.subarray(r * 512, r * 512 + 512), start + r * w);
      kl.set(b.kl.subarray(r * 512, r * 512 + 512), start + r * w);
      pl.set(b.pl.subarray(r * 512, r * 512 + 512), start + r * w);
    }
    for (const k in n) n[k as keyof Antall] += b.n[k as keyof Antall];
  }
  /* Egne områder: innenfor hvert område erstatter det kommuneplanen. */
  let basis: Rydding | null = null,
    eget: Uint8Array | null = null,
    egetType: Uint8Array | null = null;
  if (E.length) {
    basis = ryddStriper(d, w);
    d = d.slice();
    eget = new Uint8Array(w * h);
    egetType = new Uint8Array(w * h);
    E.forEach((g, i) => leggInnEget(g, i + 1, d, kl, eget!, { cx0, cy0, w, h, m: RUTE_M, type: egetType! }));
  }
  const { celler, ryddet, rn, rj } = ryddStriper(d, w);
  const egneTall: EgetTall[] = E.map(() => ({
    nat: 0,
    jor: 0,
    beb: 0,
    vann: 0,
    ukjent: 0,
    fnat: 0,
    fjor: 0,
    nnat: 0,
    njor: 0
  }));
  if (eget && basis)
    for (let i = 0; i < eget.length; i++) {
      const e = eget[i];
      if (!e) continue;
      const T = egneTall[e - 1],
        c = kl[i],
        b = basis.ryddet[i],
        ny = ryddet[i];
      if (c === 3) T.nat++;
      else if (c === 2) T.jor++;
      else if (c === 1) T.beb++;
      else if (c >= 4) T.vann++;
      else T.ukjent++;
      if (b === 1) T.fnat++;
      else if (b === 2) T.fjor++;
      if (ny === 1) T.nnat++;
      else if (ny === 2) T.njor++;
    }
  return {
    nr,
    z: Z,
    cx0,
    cy0,
    w,
    h,
    alle: d,
    ryddet,
    celler: Int32Array.from(celler),
    eget,
    egetType,
    kl,
    pl,
    antallEgne: E.length,
    basis,
    sum: { rn, rj },
    iDag: { nat: n.nat, jor: n.jor },
    n,
    delvis,
    fliser: nokler.length,
    rute,
    egneTall
  };
}

/* Har kommunen kommuneplan hos DiBK? P er et lite bilde av planlaget over kommunen og M kommunens flate, begge som piksler (RGBA) i
   samme rutenett. Gir hvor stor del av kommunen planlaget dekker, om det regnes som at kommunen har plan, og rutene med plan (til
   oppslag om hvilken plan det er). Langs grensen stikker naboenes planer litt inn, så en liten dekning betyr at kommunen ikke har
   plan der (se PLAN_FINNES). */
export function planDekning(P: Piksler, M: Piksler) {
  const treff: number[] = [];
  let inne = 0;
  for (let q = 0; q < M.length / 4; q++)
    if (M[4 * q + 3] >= HALV) {
      inne++;
      if (P[4 * q + 3] >= SYNLIG) treff.push(q);
    }
  const dekning = inne ? treff.length / inne : 0;
  return { dekning, finnes: dekning >= PLAN_FINNES, treff };
}

/* Tabellen solv.planrutenett: planrutenettet for kommunen, med de egne områdene det er regnet med (egneIder), i rekkefølge.
   Datamotoren regner det ut og legger det inn selv, fordi det regnes ut på nytt når det kommer mer kart (data/motor/plan.ts). */
export type Rutenettet = Planrutenett & { egneIder: number[] };

/* Kommuneplanen DiBK har: plan-id, hvem som har levert den, og datoen den ble kopiert til DiBK som [år, måned, dag] */
export interface Planopplysninger {
  id: string;
  vert: string;
  kopiert: string[] | null;
}
/* Tabellen solv.plandekning: hvor stor del av kommunen planlaget dekker, om det regnes som at kommunen har plan, og rutene med plan,
   i rutenettet bildet er hentet i (u, w, h) */
export async function plandekning(
  nr: string
): Promise<ReturnType<typeof planDekning> & { u: Utsnitt; w: number; h: number }> {
  const g = await katalog.solv.grense(nr),
    R = rutenett(g.ext, ...BILDE_PLANDEKNING);
  const D = planDekning(await bildePiksler(await katalog.bronse.plandekning(nr), R.w, R.h), flatePiksler(g.koord, R));
  return { ...D, u: R.u, w: R.w, h: R.h };
}
/* Tabellen solv.planinfo: om DiBK har kommuneplanen, hvor stor del av kommunen den dekker, og hvilken plan det er */
export interface Planinfo {
  finnes: boolean;
  dekning: number;
  plan: Planopplysninger | null;
}
export async function planinfo(nr: string): Promise<Planinfo> {
  const { finnes, dekning } = await katalog.solv.plandekning(nr),
    plan = finnes ? await katalog.bronse.planopplysninger(nr).catch(() => null) : null;
  return { finnes, dekning, plan };
}
