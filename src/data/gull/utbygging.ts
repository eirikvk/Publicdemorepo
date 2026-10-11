/* Gull: utbyggingen, midtpunktet i analysene. Kommuneplanen fra DiBK og egne områder lagt oppå dagens klasser fra NIBIO, i et
   rutenett med ruter på 21 meter (eller 10,6 meter, valgt under Tekniske valg), med smale striper tatt bort. Svarer på hvor det er planlagt utbygging, og hva som er der i dag.
   Alle kryssinger med planlagt utbygging går gjennom utbyggingen: temaene (gull/temaer.ts), grått areal (gull/graa.ts), tallene for
   planlagt utbygging (gull/planlagt.ts) og egne områder (gull/egne.ts).
   Hver kilde tolkes per rute i sølv: planen, med kommuneplanen (solv.kommuneplanruter) og egne områder (solv.egneruter) i samme
   datamodell, og dagens klasser (solv.klasser, eller dagensKlasserIFlis og klasserIFlis for det sammensatte kartet). Her settes de
   sammen: dagens klasser klippes til kommunen, et eget område erstatter kommuneplanen der det ligger, og planen legges oppå dagens
   klasser. Én rute er ruteKm2(z) km² (felles.ts). */
import {
  BLOKK,
  blokkAv,
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
import { dagensKlasserIFlis, klasserIFlate } from '../solv/grunnkart.ts';
import { JOR, NAT, klasserIFlis } from '../solv/klasser.ts';
import { kanHaPlan } from '../solv/kommuneplan.ts';

/* Antall ruter: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging */
export interface Antall {
  beb: number;
  nat: number;
  jor: number;
  pnat: number;
  pjor: number;
}
/* Én flis i utbyggingen, fra kombinerBlokk. sig sier hvor mange kartfliser den er regnet av (-1 for hele kommunen), og utenPlan at
   den er regnet uten kommuneplan. d og pl er null når de bare har 0, som i de fleste blokkene. */
export interface Blokk {
  sig: number;
  d: Uint8Array | null;
  kl: Uint8Array;
  pl: Uint8Array | null;
  n: Antall;
  utenPlan?: boolean;
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
}

/* Én flis: kommuneplanen lagt oppå dagens klasser. kl er dagens klasse per rute fra klasserIFlis (0 ukjent), plan planlagt
   utbygging per rute fra solv.kommuneplanruter (null uten kommuneplan), og tc flisen [z, x, y]. fliser er kartflisene som er hentet innenfor,
   eller null når hele kommunen er kjent. Uten hentet kart er ruta ukjent (3).
   Gir per rute:
     d:  0 ingenting, 1 natur og 2 jordbruk satt av til utbygging, 3 ukjent
     kl: dagens klasse, 0 ukjent, 1 bebygd, 2 jordbruk, 3 natur, 4–6 vann
     pl: 1 der det er planlagt utbygging på land, også der det alt er bebygd
   og antall ruter n: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging. */
export function kombinerBlokk(kl: Uint8Array, plan: Uint8Array | null, tc: Flis, fliser: Flis[] | null): Blokk {
  const d = new Uint8Array(262144),
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
  for (let q = 0; q < 262144; q++) {
    if (!kl[q]) continue;
    const k = kl[q] - 1,
      p = !!plan && plan[q] === 1; /* halvregelen er brukt i sølv */
    if (p && k <= NAT) pl[q] = 1;
    if (!k) {
      n.beb++;
      continue;
    }
    if (k !== JOR && k !== NAT) continue; /* vann telles ikke */
    const jor = k === JOR;
    if (jor) {
      n.jor++;
      if (p) n.pjor++;
    } else {
      n.nat++;
      if (p) n.pnat++;
    }
    if (p) d[q] = jor ? 2 : 1;
  }
  const noe = (a: Uint8Array) => {
    for (let q = 0; q < a.length; q++) if (a[q]) return true;
    return false;
  }; /* en vanlig løkke: some() med en funksjon per rute tok flere sekunder i store kommuner */
  return { sig: fliser ? fliser.length : -1, d: noe(d) ? d : null, kl, pl: noe(pl) ? pl : null, n };
}

/* Smale striper: felt som ikke er bredere enn to ruter (rundt 40 meter) noe sted. De oppstår mest der plangrensen og grunnkartet
   ikke er tegnet helt likt, ofte langs eksisterende bebyggelse. Først finnes kjernene, altså ruter med planlagt utbygging på alle
   fire sider. Så beholdes alt som henger sammen med en kjerne, også på skrå. Et større felt beholdes dermed helt, også der det
   smalner av, og bare felt uten kjerne faller bort. d er rutenettet (1 natur, 2 jordbruk, 3 ukjent). Ukjente ruter teller som
   naboer, så et felt ikke skrelles av langs kanten av det som er hentet. Naboene finnes med nummeret på ruta, som i et vanlig
   rutenett med bredden w. Gir de beholdte rutene (ryddet) og antallet natur (rn) og jordbruk (rj) i dem. */
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
  let rn = 0,
    rj = 0;
  for (const i of celler) {
    const x = verdi(ryddet, i);
    if (x === 1) rn++;
    else if (x === 2) rj++;
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
    null0 = delvis ? new Uint8Array(BLOKK * BLOKK) : null; /* en hentet blokk uten plan, når resten er ukjent */
  for (const [x, y] of nokler) {
    const b = blokker.get(`${Z}/${x}/${y}`)!;
    if (b.d || null0) leggInnDelt(d, x, y, b.d || null0!);
    if (b.pl) leggInnDelt(pl, x, y, b.pl);
    leggInnDelt(kl, x, y, b.kl);
    for (const k in n) n[k as keyof Antall] += b.n[k as keyof Antall];
  }
  /* Egne områder: innenfor hvert område erstatter det kommuneplanen. */
  let basis: Rydding | null = null,
    eget: Glissen | null = null,
    egetType: Glissen | null = null;
  const egneIder = E ? E.ider : [];
  if (E) {
    basis = ryddStriper(d);
    d = kopiAv(d);
    eget = glissent(G);
    egetType = glissent(G);
    leggInnEgne(E, d, kl, eget, egetType);
  }
  const { celler, ryddet, rn, rj } = ryddStriper(d);
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
        ny = verdi(ryddet, i);
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
    egneIder
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
   områder, eller før det er hentet kart i en kommune uten lagrede klasser.
   Dagens klasser kommer fra gull.dagensKlasser. For kommunene med lagrede klasser er det blokkene (solv.klasser), klippet til
   kommunen etter halvregelen, og hele kommunen er med. Ellers er det det sammensatte kartet av flisene som er hentet. Da gjelder
   utbyggingen bare den delen av kommunen nettleseren har hentet kart for (delvis), og den regnes ut på nytt når datamotoren sier fra
   om mer kart. Egne områder kommer fra solv.egneruter.
   Utbyggingen bygges av blokker på 512 x 512 ruter, én per flis på nivået brukeren har valgt (bronse.planniva, 9 som standard). En blokk regnes bare ut på nytt når det har kommet nye
   kartfliser innenfor den, så mer kart koster én eller to blokker og ikke hele det hentede området. Blokkene huskes i
   gull.utbyggingsblokker. Det gir et anslag til illustrasjon, ikke offisiell statistikk. */
export async function utbygging(nr: string): Promise<Utbygging | null> {
  const [info, E, D] = await Promise.all([
    katalog.solv.planinfo(nr).catch(() => null),
    katalog.solv.egneruter(nr),
    katalog.gull.dagensKlasser(nr)
  ]);
  const ingenPlan = !!info && !info.finnes;
  if ((ingenPlan && !E) || !D) return null;
  const dyn = D.delvis,
    O = ingenPlan ? null : await katalog.solv.planoversikt(nr).catch(() => null) /* uten oversikt hentes alle */,
    Z = (await katalog.bronse.planniva()) || PLANNIVA,
    blokker = katalog.gull.utbyggingsblokker.straks(nr, () => new Map<string, Blokk>()),
    under = new Map<string, Flis[] | null>();
  for (const k of [...blokker.keys()]) if (!k.startsWith(`${Z}/`)) blokker.delete(k); /* blokker på et annet nivå */
  if (D.lagret) for (const [, x, y] of await katalog.solv.blokker([nr, Z])) under.set(`${x}/${y}`, null);
  else
    for (const [z, x, y] of D.fliser || []) {
      const k = `${x >> (z - Z)}/${y >> (z - Z)}`;
      if (!under.has(k)) under.set(k, []);
      under.get(k)!.push([z, x, y]);
    }
  await Promise.all(
    [...under].map(async ([k, fliser]) => {
      const har = blokker.get(`${Z}/${k}`),
        sig = fliser ? fliser.length : -1;
      if (har && har.sig === sig && har.kl && har.utenPlan === ingenPlan) return;
      const [x, y] = k.split('/').map(Number),
        tc: Flis = [Z, x, y];
      const [kl, P] = await Promise.all([
        D.lagret
          ? katalog.solv.klasser(tc).then(K => klasserIFlate(K, D.koord))
          : dagensKlasserIFlis(tc, D).then(K => K && klasserIFlis(K)),
        ingenPlan || (O && !kanHaPlan(O, tc)) ? null : katalog.solv.kommuneplanruter(tc)
      ]);
      if (!kl) throw new Error('mangler dagens klasser');
      blokker.set(`${Z}/${k}`, { ...kombinerBlokk(kl, P ? P.plan : null, tc, fliser), utenPlan: ingenPlan });
    })
  );
  if (E && E.z !== Z) throw new Error('egne områder er regnet på et annet nivå');
  const m = dyn ? Math.max(ruteM(Z), D.ov.res) : ruteM(Z);
  return byggUtbygging(
    nr,
    Z,
    [...under.keys()].map(k => k.split('/').map(Number)),
    blokker,
    dyn,
    E,
    m < 15 ? Math.round(m * 10) / 10 : Math.round(m) /* 21 meter, eller 10,6 */
  );
}
