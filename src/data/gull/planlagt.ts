/* Gull for planlagt utbygging: natur og jordbruk som kommuneplanen (og egne områder) setter av, summert over utbyggingen
   (gull/utbygging.ts). Arealer er i km², andeler i prosent. Nederst det samme per detaljklasse i grunnkartet
   (gull.planlagtPerDetaljklasse). Tallene regnes for et utvalg av utbyggingen (Utvalg i gull/utbygging.ts): den nye planen eller den
   gamle, i hele kommunen eller i ett eget område, med de samme funksjonene. Nøkkelen er utvalget, som 5001 eller 5001/gammel. */
import { verdi } from '../generelt/glissen.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, OPPLOSNINGER, ruteKm2 } from '../solv/felles.ts';
import { DETALJKLASSER } from '../solv/klasser.ts';
import type { Planinfo } from '../solv/kommuneplan.ts';
import { andel } from './felles.ts';
import { lesUtvalg, ruteVekt, utvalgFor, type Utbygging, type Utvalg } from './utbygging.ts';

/* Kortversjonen til oversikten og regnskapet: natur og jordbruk satt av i km², og hvor mange egne områder som er med */
export interface PlanSum {
  nr: string;
  nat: number;
  jor: number;
  egne: number;
}

/* Det siden viser om planlagt utbygging i utvalget U. For natur og jordbruk: arealet uten smale striper, andelen av det som er natur
   eller jordbruk i dag (i kommunen, eller i det egne området), og arealet med smale striper. */
export function byggPlanlagt(U: Utvalg) {
  const R = U.R,
    m = OPPLOSNINGER[R.z] / 2,
    km2 = (v: number) => (v * m * m) / 1e6,
    iDag = U.omrade === null ? R.n : R.egneTall[U.omrade - 1],
    n = { rn: 0, rj: 0, pn: 0, pj: 0 };
  for (const i of U.celler) {
    const a = verdi(U.alle, i),
      b = verdi(U.ryddet, i),
      w = ruteVekt(R, i);
    if (a === 1) n.pn += w;
    else if (a === 2) n.pj += w;
    if (b === 1) n.rn += w;
    else if (b === 2) n.rj += w;
  }
  return {
    natur: { km2: km2(n.rn), andel: andel(n.rn, iDag.nat), medStriper: km2(n.pn) },
    jordbruk: { km2: km2(n.rj), andel: andel(n.rj, iDag.jor), medStriper: km2(n.pj) },
    antallEgne: R.antallEgne,
    rute: R.rute
  };
}

/* Kortversjonen til oversikten og regnskapet: natur og jordbruk satt av, i km² */
export const byggPlanSum = (R: Utbygging): PlanSum => ({
  nr: R.nr,
  nat: R.sum.rn * ruteKm2(R.z),
  jor: R.sum.rj * ruteKm2(R.z),
  egne: R.antallEgne
});

/* Tabellen gull.kommuneplan: om DiBK har kommuneplanen for kommunen nr, hvor stor del av kommunen den dekker, og hvilken plan */
export async function kommuneplan(nr: string): Promise<Planinfo> {
  return katalog.solv.planinfo(nr);
}
/* Tabellen gull.planlagt for utvalget n (som 5001 eller 5001/gammel), og gull.plansum for kommunen nr. null uten utbygging. */
export type Planlagt = ReturnType<typeof byggPlanlagt>;
export async function planlagt(n: string): Promise<Planlagt | null> {
  const U = await utvalgFor(n);
  return U ? byggPlanlagt(U) : null;
}
export async function plansum(nr: string): Promise<PlanSum | null> {
  const R = await katalog.gull.utbygging(nr);
  return R ? byggPlanSum(R) : null;
}

/* Planlagt utbygging per detaljklasse: km² per klasse i DETALJKLASSER (km2), planlagt utbygging der ingen detaljklasse passer
   (ukjent), og rutestørrelsen utbyggingen er regnet med */
export interface PlanlagtDetaljer {
  km2: number[];
  ukjent: number;
  rute: number;
}
/* Tabellen gull.planlagtPerDetaljklasse: den planlagte utbyggingen i utvalget n (gull.utbygging, uten smale striper) fordelt på
   detaljklassene i grunnkartet (solv.detaljklasser). Hver rute med planlagt utbygging på natur får den naturklassen det er mest av
   i ruta, og hver rute på jordbruk den jordbruksklassen det er mest av. Detaljklassene er på 10,6 meter, som rutene i utbyggingen, så
   hver rute er én av dem. Slik blir summen den samme som natur og jordbruk satt av i gull.plansum. Detaljklassene er lest innenfor
   dagens klasser (solv.detaljklasser), så ruta har alltid en klasse av riktig slag, om ikke annet en restklasse. Ukjent er det bare
   når ruta ikke har noen detaljklasse. null uten utbygging, eller når kommunen ikke har noen blokker. */
export async function planlagtPerDetaljklasse(n: string): Promise<PlanlagtDetaljer | null> {
  const [L, U] = await Promise.all([katalog.solv.detaljblokker(lesUtvalg(n).nr), utvalgFor(n)]);
  if (!U || !L.length) return null;
  const R = U.R,
    f = 1 << (FLISNIVA - R.z) /* detaljruter langs siden av en rute */,
    har = new Set(L.map(([, x, y]) => `${x}/${y}`)),
    perBlokk = new Map<string, number[]>(),
    antall = new Array<number>(DETALJKLASSER.length + 1).fill(0);
  for (const i of U.celler) {
    const d = verdi(U.ryddet, i);
    if (d !== 1 && d !== 2) continue;
    const X = (R.cx0 + (i % R.w)) * f,
      Y = (R.cy0 + Math.floor(i / R.w)) * f,
      k = `${Math.floor(X / 512)}/${Math.floor(Y / 512)}`;
    if (!perBlokk.has(k)) perBlokk.set(k, []);
    perBlokk.get(k)!.push(i);
  }
  for (const [k, celler] of perBlokk) {
    if (!har.has(k)) {
      for (const i of celler) antall[0] += ruteVekt(R, i);
      continue;
    }
    const [bx, by] = k.split('/').map(Number),
      K = await katalog.solv.detaljklasser([FLISNIVA, bx, by]);
    for (const i of celler) {
      const gruppe = verdi(U.ryddet, i) === 1 ? 'nat' : 'jor',
        X = (R.cx0 + (i % R.w)) * f - bx * 512,
        Y = (R.cy0 + Math.floor(i / R.w)) * f - by * 512,
        tell = new Map<number, number>();
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const kl = K.kl[(Y + dy) * 512 + X + dx];
          if (kl && DETALJKLASSER[kl - 1].gruppe === gruppe) tell.set(kl, (tell.get(kl) || 0) + 1);
        }
      let best = 0,
        flest = 0;
      for (const [kl, m] of tell) if (m > flest || (m === flest && kl < best)) [best, flest] = [kl, m];
      antall[best] += ruteVekt(R, i);
    }
  }
  const km2 = ruteKm2(R.z);
  return { km2: antall.slice(1).map(v => v * km2), ukjent: antall[0] * km2, rute: R.rute };
}
