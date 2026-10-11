/* Gull: utbyggingen, midtpunktet i analysene. Kommuneplanen fra DiBK og egne områder lagt oppå dagens klasser fra NIBIO, i et
   rutenett med ruter på 21 meter, med smale striper tatt bort. Svarer på hvor det er planlagt utbygging, og hva som er der i dag.
   Alle kryssinger med planlagt utbygging går gjennom utbyggingen: temaene (gull/temaer.ts), grått areal (gull/graa.ts), tallene for
   planlagt utbygging (gull/planlagt.ts) og egne områder (gull/egne.ts).
   Hver kilde tolkes per rute i sølv: planen, med kommuneplanen (solv.kommuneplanruter) og egne områder (solv.egneruter) i samme
   datamodell, og dagens klasser (dagensKlasserIFlis og klasserIFlis i solv/grunnkart.ts og solv/klasser.ts). Her settes de sammen:
   et eget område erstatter kommuneplanen der det ligger, og planen legges oppå dagens klasser. Én rute er RUTE km². */
import { katalog } from '../katalog.ts';
import { PLANNIVA, RUTE_M, fliserI, type Flis, type Plassering } from '../solv/felles.ts';
import type { Egneruter } from '../solv/egne.ts';
import { dagensKlasserIFlis } from '../solv/grunnkart.ts';
import { JOR, NAT, klasserIFlis } from '../solv/klasser.ts';

/* Antall ruter: bebygd, natur og jordbruk i dag, og natur (pnat) og jordbruk (pjor) satt av til utbygging */
export interface Antall {
  beb: number;
  nat: number;
  jor: number;
  pnat: number;
  pjor: number;
}
/* Én flis i utbyggingen, fra kombinerBlokk. sig sier hvor mange kartfliser den er regnet av (-1 for hele kommunen), og utenPlan at
   den er regnet uten kommuneplan. */
export interface Blokk {
  sig: number;
  d: Uint8Array;
  kl: Uint8Array;
  pl: Uint8Array;
  n: Antall;
  utenPlan?: boolean;
}
/* Utbyggingen med smale striper tatt bort: rutene med planlagt utbygging på natur eller jordbruk (celler), det som er beholdt
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
/* Tabellen gull.utbygging: utbyggingen i kommunen, se byggUtbygging. Radene (rader) er rutene med planlagt utbygging på natur
   eller jordbruk: først de med planen og egne områder (celler, med smale striper), så de som bare planen alene har, der egne
   områder har tatt planen bort. Kolonnene for temaene (gull/temaer.ts) står i samme rekkefølge. egneIder er de egne områdene
   utbyggingen er regnet med, i rekkefølge. */
export interface Utbygging extends Plassering {
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
   nokler er [x, y] for flisene på nivå 9, blokker resultatene fra kombinerBlokk per flis («x/y»), delvis sier at bare en del av
   kommunen er hentet, E er de egne områdene per rute fra solv.egneruter (null uten), og rute er rutestørrelsen i meter slik den
   skal oppgis.
   Med egne områder regnes også kommuneplanen alene (basis), så forskjellen kan vises. For hvert eget område telles hva som ligger
   der i dag, hva planen alene tar (fnat, fjor) og hva som går med nå (nnat, njor). */
export function byggUtbygging(
  nr: string,
  nokler: number[][],
  blokker: Map<string, Blokk>,
  delvis: boolean,
  E: Egneruter | null,
  rute: number
): Utbygging {
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
  const egneIder = E ? E.ider : [];
  if (E) {
    basis = ryddStriper(d, w);
    d = d.slice();
    eget = new Uint8Array(w * h);
    egetType = new Uint8Array(w * h);
    leggInnEgne(E, d, kl, eget, egetType, { cx0, cy0, w, h });
  }
  const { celler, ryddet, rn, rj } = ryddStriper(d, w);
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
  /* Radene: rutene med planlagt utbygging nå, og så rutene som bare planen alene har, der egne områder har tatt planen bort */
  const bareBasis = basis ? basis.celler.filter(i => basis!.ryddet[i] && d[i] !== 1 && d[i] !== 2) : [];
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
   rutenettet for planlagt utbygging, kl dagens klasser, og G rutenettets plassering. Som utbygging tar området all natur og alt
   jordbruk i ruta. Som ikke utbygging fjerner det planlagt utbygging der. Fyller eget (hvilket område ruta hører til) og egetType
   (1 utbygging, 2 ikke utbygging), og endrer d. */
export function leggInnEgne(
  E: Egneruter,
  d: Uint8Array,
  kl: Uint8Array,
  eget: Uint8Array,
  egetType: Uint8Array,
  G: { cx0: number; cy0: number; w: number; h: number }
) {
  for (let y = 0; y < E.h; y++) {
    const Y = E.cy0 + y - G.cy0;
    if (Y < 0 || Y >= G.h) continue;
    for (let x = 0; x < E.w; x++) {
      const X = E.cx0 + x - G.cx0,
        q = y * E.w + x,
        o = E.omrade[q];
      if (!o || X < 0 || X >= G.w) continue;
      const i = Y * G.w + X,
        t = E.plan[q];
      eget[i] = o;
      egetType[i] = t;
      if (t === 1) {
        if (kl[i] === 3) d[i] = 1;
        else if (kl[i] === 2) d[i] = 2;
      } else if (d[i] === 1 || d[i] === 2) d[i] = 0;
    }
  }
}

/* Tabellen gull.utbygging: utbyggingen i kommunen nr. null når det ikke finnes noe å regne på: uten kommuneplan og uten egne
   områder, eller før det er hentet kart i en kommune uten lagret oversiktsbilde.
   Dagens klasser kommer fra gull.dagensKlasser: det lagrede oversiktsbildet for hele kommunen, eller det sammensatte kartet av flisene
   som er hentet. Da gjelder utbyggingen bare den delen av kommunen nettleseren har hentet kart for (delvis), og den regnes ut på nytt
   når datamotoren sier fra om mer kart. Egne områder kommer fra solv.egneruter.
   Utbyggingen bygges av blokker på 512 x 512 ruter, én per flis på nivå 9. En blokk regnes bare ut på nytt når det har kommet nye
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
  const lest = D.ov.buf ? await katalog.solv.oversiktLest(nr) : null,
    dyn = D.delvis,
    Z = PLANNIVA,
    blokker = katalog.gull.utbyggingsblokker.straks(nr, () => new Map<string, Blokk>()),
    under = new Map<string, Flis[] | null>();
  if (D.fliser)
    for (const [z, x, y] of D.fliser) {
      const k = `${x >> (z - Z)}/${y >> (z - Z)}`;
      if (!under.has(k)) under.set(k, []);
      under.get(k)!.push([z, x, y]);
    }
  else fliserI(D.ov.ext, Z).forEach(tc => under.set(`${tc[1]}/${tc[2]}`, null));
  await Promise.all(
    [...under].map(async ([k, fliser]) => {
      const har = blokker.get(k),
        sig = fliser ? fliser.length : -1;
      if (har && har.sig === sig && har.kl && har.pl && har.utenPlan === ingenPlan) return;
      const [x, y] = k.split('/').map(Number),
        tc: Flis = [Z, x, y];
      const [K, P] = await Promise.all([
        dagensKlasserIFlis(tc, { ...D, lest }),
        ingenPlan ? null : katalog.solv.kommuneplanruter(tc)
      ]);
      if (!K) throw new Error('mangler dagens klasser');
      blokker.set(k, { ...kombinerBlokk(klasserIFlis(K), P ? P.plan : null, tc, fliser), utenPlan: !P });
    })
  );
  const m = RUTE_M;
  return byggUtbygging(
    nr,
    [...under.keys()].map(k => k.split('/').map(Number)),
    blokker,
    dyn,
    E,
    Math.round(dyn ? Math.max(m, D.ov.res) : m)
  );
}
