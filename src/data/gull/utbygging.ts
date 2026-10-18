/* Gull: utbyggingen, midtpunktet i analysene. Kommuneplanen fra DiBK og egne områder lagt oppå dagens klasser fra NIBIO, i et
   rutenett med ruter på 10,6 meter, med smale striper tatt bort. Svarer på hvor det er planlagt utbygging, og hva som er der i dag.
   Alle kryssinger med planlagt utbygging går gjennom utbyggingen: temaene (gull/temaer.ts), grått areal (gull/graa.ts), tallene for
   planlagt utbygging (gull/planlagt.ts) og egne områder (gull/egne.ts).
   Hver kilde tolkes per rute i sølv: planen, med kommuneplanen (solv.kommuneplanruter) og egne områder (solv.egneruter) i samme
   datamodell, og dagens klasser (solv.klasser). Her settes de
   sammen: dagens klasser klippes til kommunen, et eget område erstatter kommuneplanen der det ligger, og planen legges oppå dagens
   klasser. Én rute er ruteKm2(z) km² (felles.ts). */
import { HEL, andelVed, hverRute, type Andel } from '../generelt/dekning.ts';
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
/* Én flis i utbyggingen, fra kombinerBlokk. sig sier hvor mange kartfliser den er regnet av (-1 for hele kommunen), og utenPlan at
   den er regnet uten kommuneplan. d og pl er null når de bare har 0, som i de fleste blokkene. andel er kommunens andel i blokken
   (null når hele blokken er i kommunen), og faktor målestokken i biten den ligger i. */
export interface Blokk {
  sig: number;
  d: Uint8Array | null;
  kl: Uint8Array;
  pl: Uint8Array | null;
  n: Antall;
  utenPlan?: boolean;
  andel: Andel | null;
  faktor: number;
}
/* Utbyggingen med smale striper tatt bort: rutene med planlagt utbygging på natur eller jordbruk (celler), det som er beholdt
   per rute (ryddet: 1 natur, 2 jordbruk), og antallet natur (rn) og jordbruk (rj) som er beholdt */
export interface Rydding {
  celler: number[];
  ryddet: Glissen;
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
/* Tabellen gull.utbygging: utbyggingen i kommunen, se byggUtbygging. Radene (rader) er rutene med planlagt utbygging på natur
   eller jordbruk: først de med planen og egne områder (celler, med smale striper), så de som bare planen alene har, der egne
   områder har tatt planen bort. Kolonnene for temaene (gull/temaer.ts) står i samme rekkefølge. egneIder er de egne områdene
   utbyggingen er regnet med, i rekkefølge.
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
  sum: { rn: number; rj: number };
  iDag: { nat: number; jor: number };
  n: Antall;
  delvis: boolean;
  fliser: number;
  rute: number;
  egneTall: EgetTall[];
  rader: Int32Array;
  egneIder: number[];
  andeler: Map<number, Andel> /* kommunens andel i blokkene langs grensen, etter blokkNokkel */;
  faktorer: Map<number, number> /* målestokken per blokk, etter blokkNokkel */;
}
/* Vekten til rute i i utbyggingen R: den delen av ruta som ligger i kommunen, ganger målestokken i biten */
export function ruteVekt(R: Pick<Utbygging, 'cx0' | 'cy0' | 'w' | 'andeler' | 'faktorer'>, i: number): number {
  const X = R.cx0 + (i % R.w),
    Y = R.cy0 + Math.floor(i / R.w),
    k = blokkNokkel(Math.floor(X / BLOKK), Math.floor(Y / BLOKK)),
    A = R.andeler.get(k),
    f = R.faktorer.get(k);
  return (A ? andelVed(A, X % BLOKK, Y % BLOKK) / HEL : 1) * (f === undefined ? 1 : f);
}
/* Målestokken i biten rute i i utbyggingen R ligger i */
export function ruteFaktor(R: Pick<Utbygging, 'cx0' | 'cy0' | 'w' | 'faktorer'>, i: number): number {
  const X = R.cx0 + (i % R.w),
    Y = R.cy0 + Math.floor(i / R.w),
    f = R.faktorer.get(blokkNokkel(Math.floor(X / BLOKK), Math.floor(Y / BLOKK)));
  return f === undefined ? 1 : f;
}

/* Én flis: kommuneplanen lagt oppå dagens klasser. kl er dagens klasse per rute fra klasserIFlis (0 ukjent), plan planlagt
   utbygging per rute fra solv.kommuneplanruter (null uten kommuneplan), og tc flisen [z, x, y]. fliser er kartflisene som er hentet innenfor,
   eller null når hele kommunen er kjent. Uten hentet kart er ruta ukjent (3).
   Gir per rute:
     d:  0 ingenting, 1 natur og 2 jordbruk satt av til utbygging, 3 ukjent
     kl: dagens klasse, 0 ukjent, 1 bebygd, 2 jordbruk, 3 natur, 4–6 vann
     pl: 1 der det er planlagt utbygging på land, også der det alt er bebygd
   og antall ruter n: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging, vektet med kommunens
   andel i blokken (andel, null når hele blokken er i kommunen) og målestokken (faktor). */
export function kombinerBlokk(
  kl: Uint8Array,
  plan: Uint8Array | null,
  tc: Flis,
  fliser: Flis[] | null,
  andel: Andel | null = null,
  faktor = 1
): Blokk {
  const d = new Uint8Array(262144),
    pl = new Uint8Array(262144),
    n: Antall = { beb: 0, nat: 0, jor: 0, pnat: 0, pjor: 0 };
  let vekt: Float32Array | null = null;
  if (andel) {
    const V = (vekt = new Float32Array(262144));
    hverRute(andel, (q, a) => (V[q] = a / HEL));
  }
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
  return { sig: fliser ? fliser.length : -1, d: noe(d) ? d : null, kl, pl: noe(pl) ? pl : null, n, andel, faktor };
}

/* Smale striper: felt som ikke er bredere enn to ruter (rundt 20 meter) noe sted. De oppstår mest der plangrensen og grunnkartet
   ikke er tegnet helt likt, ofte langs eksisterende bebyggelse. Først finnes kjernene, altså ruter med planlagt utbygging på alle
   fire sider. Så beholdes alt som henger sammen med en kjerne, også på skrå. Et større felt beholdes dermed helt, også der det
   smalner av, og bare felt uten kjerne faller bort. d er rutenettet (1 natur, 2 jordbruk, 3 ukjent). Ukjente ruter teller som
   naboer, så et felt ikke skrelles av langs kanten av det som er hentet. Naboene finnes med nummeret på ruta, som i et vanlig
   rutenett med bredden w. Gir de beholdte rutene (ryddet) og antallet natur (rn) og jordbruk (rj) i dem, vektet med vekt. */
export function ryddStriper(d: Glissen, vekt: (i: number) => number = () => 1): Rydding {
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
  let rn = 0,
    rj = 0;
  for (const i of celler) {
    const x = verdi(ryddet, i);
    if (x === 1) rn += vekt(i);
    else if (x === 2) rj += vekt(i);
  }
  return { celler, ryddet, rn, rj };
}

/* Setter flisene sammen til ett rutenett for kommunen, legger inn egne områder og rydder bort smale striper. nr er kommunen,
   Z nivået rutenettet er på, nokler er [x, y] for flisene på nivå Z, blokker resultatene fra kombinerBlokk per flis («Z/x/y»), delvis sier at bare en del av
   kommunen er hentet, E er de egne områdene per rute fra solv.egneruter (null uten), og rute er rutestørrelsen i meter slik den
   skal oppgis.
   Rutenettet er glissent: blokkene fra kombinerBlokk deles, og bare blokkene med planlagt utbygging eller egne områder er med i
   planen. Rutene har samme nummer som i ett stort rutenett over alle flisene, med en kant på én rute når bare en del er hentet.
   Med egne områder regnes også kommuneplanen alene (basis), så forskjellen kan vises. For hvert eget område telles hva som ligger
   der i dag, hva planen alene tar (fnat, fjor) og hva som går med nå (nnat, njor). */
export function byggUtbygging(
  nr: string,
  Z: number,
  nokler: number[][],
  blokker: Map<string, Blokk>,
  delvis: boolean,
  E: Egneruter | null,
  rute: number
): Utbygging {
  const kant = delvis ? 1 : 0,
    tx0 = Math.min(...nokler.map(t => t[0])),
    ty0 = Math.min(...nokler.map(t => t[1]));
  const G = {
    cx0: tx0 * BLOKK - kant,
    cy0: ty0 * BLOKK - kant,
    w: (Math.max(...nokler.map(t => t[0])) - tx0 + 1) * BLOKK + 2 * kant,
    h: (Math.max(...nokler.map(t => t[1])) - ty0 + 1) * BLOKK + 2 * kant
  };
  let d = glissent(G, delvis ? 3 : 0); /* utenfor det som er hentet, er ruta ukjent */
  const kl = glissent(G),
    pl = glissent(G),
    n: Antall = { beb: 0, nat: 0, jor: 0, pnat: 0, pjor: 0 },
    null0 = delvis ? new Uint8Array(BLOKK * BLOKK) : null /* en hentet blokk uten plan, når resten er ukjent */,
    andeler = new Map<number, Andel>(),
    faktorer = new Map<number, number>();
  for (const [x, y] of nokler) {
    const b = blokker.get(`${Z}/${x}/${y}`)!;
    if (b.d || null0) leggInnDelt(d, x, y, b.d || null0!);
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
  if (E) {
    basis = ryddStriper(d, vekt);
    d = kopiAv(d);
    eget = glissent(G);
    egetType = glissent(G);
    leggInnEgne(E, d, kl, eget, egetType);
  }
  const { celler, ryddet, rn, rj } = ryddStriper(d, vekt);
  const egneTall: EgetTall[] = egneIder.map(() => ({
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
    for (const i of finn(eget, e => e !== 0)) {
      const T = egneTall[verdi(eget, i)! - 1],
        c = verdi(kl, i)!,
        b = verdi(basis.ryddet, i),
        ny = verdi(ryddet, i),
        v = c ? vekt(i) : 1; /* utenfor kommunen er ruta ukjent, og telles helt */
      if (c === 3) T.nat += v;
      else if (c === 2) T.jor += v;
      else if (c === 1) T.beb += v;
      else if (c >= 4) T.vann += v;
      else T.ukjent += v;
      if (b === 1) T.fnat += v;
      else if (b === 2) T.fjor += v;
      if (ny === 1) T.nnat += v;
      else if (ny === 2) T.njor += v;
    }
  /* Radene: rutene med planlagt utbygging nå, og så rutene som bare planen alene har, der egne områder har tatt planen bort */
  const bareBasis = basis
    ? basis.celler.filter(i => {
        const v = verdi(d, i);
        return verdi(basis!.ryddet, i) && v !== 1 && v !== 2;
      })
    : [];
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
    sum: { rn, rj },
    iDag: { nat: n.nat, jor: n.jor },
    n,
    delvis,
    fliser: nokler.length,
    rute,
    egneTall,
    rader: Int32Array.from([...celler, ...bareBasis]),
    egneIder,
    andeler,
    faktorer
  };
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
   Dagens klasser kommer fra blokkene (solv.klasser) på nivå 10, lagret eller hentet fra NIBIO, klippet til kommunen med kommunens
   andel i hver rute (solv.kommunebiter), og hele kommunen er med. Kan ikke blokkene lages for hele kommunen, regnes ingenting: det sammensatte kartet av
   flisene som er hentet, brukes bare til å vise kartet, for der er rutene grovere jo større kommunen er. Egne områder kommer fra
   solv.egneruter.
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
  if ((ingenPlan && !E) || !D) return null;
  if (D.delvis) throw new Error('dagens klasser kunne ikke hentes for hele kommunen');
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
        ...kombinerBlokk(kl, P ? P.plan : null, tc, null, kom.andel, kom.faktor),
        utenPlan: ingenPlan
      });
    })
  );
  if (E && E.z !== Z) throw new Error('egne områder er regnet på et annet nivå');
  return byggUtbygging(nr, Z, under, blokker, false, E, Math.round(ruteM(Z) * 10) / 10 /* 10,6 meter */);
}
