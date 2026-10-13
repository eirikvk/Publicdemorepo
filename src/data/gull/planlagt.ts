/* Gull for planlagt utbygging: natur og jordbruk som kommuneplanen (og egne områder) setter av, summert over utbyggingen
   (gull/utbygging.ts). Arealer er i km², andeler i prosent. Nederst det samme per detaljklasse i grunnkartet
   (gull.planlagtPerDetaljklasse). */
import { verdi } from '../generelt/glissen.ts';
import { katalog } from '../katalog.ts';
import { FLISNIVA, OPPLOSNINGER, ruteKm2 } from '../solv/felles.ts';
import { DETALJKLASSER } from '../solv/klasser.ts';
import type { Planinfo } from '../solv/kommuneplan.ts';
import { andel, landareal } from './felles.ts';
import type { Utbygging } from './utbygging.ts';

/* Kortversjonen til oversikten og regnskapet: natur og jordbruk satt av i km², om bare en del av kommunen er hentet, og hvor mange
   egne områder som er med */
export interface PlanSum {
  nr: string;
  nat: number;
  jor: number;
  delvis: boolean;
  egne: number;
}

/* Det siden viser om planlagt utbygging. R er utbyggingen, og land landarealet fra SSB. For natur og jordbruk: arealet uten smale
   striper, andelen av det som er natur eller jordbruk i dag i samme rutenett, og arealet med smale striper. Med egne områder også
   planen alene (basis). Er bare en del av kommunen hentet (delvis), også hvor mye land som er hentet. */
export function byggPlanlagt(R: Utbygging, land: number) {
  const m = OPPLOSNINGER[R.z] / 2,
    km2 = (v: number) => (v * m * m) / 1e6,
    n = R.n,
    hentet = km2(n.beb + n.jor + n.nat);
  return {
    natur: { km2: km2(R.sum.rn), andel: andel(R.sum.rn, n.nat), medStriper: km2(n.pnat) },
    jordbruk: { km2: km2(R.sum.rj), andel: andel(R.sum.rj, n.jor), medStriper: km2(n.pjor) },
    basis: R.basis ? { natur: km2(R.basis.rn), jordbruk: km2(R.basis.rj), tom: !(R.basis.rn + R.basis.rj) } : null,
    antallEgne: R.antallEgne,
    delvis: R.delvis,
    hentet: R.delvis ? { km2: hentet, land, andel: land ? andel(Math.min(hentet, land), land) : null } : null,
    rute: R.rute,
    fliser: R.fliser
  };
}

/* Kortversjonen til oversikten og regnskapet: natur og jordbruk satt av, i km² */
export const byggPlanSum = (R: Utbygging): PlanSum => ({
  nr: R.nr,
  nat: R.sum.rn * ruteKm2(R.z),
  jor: R.sum.rj * ruteKm2(R.z),
  delvis: R.delvis,
  egne: R.antallEgne
});

/* Tabellen gull.kommuneplan: om DiBK har kommuneplanen for kommunen nr, hvor stor del av kommunen den dekker, og hvilken plan */
export async function kommuneplan(nr: string): Promise<Planinfo> {
  return katalog.solv.planinfo(nr);
}
/* Tabellene gull.planlagt og gull.plansum for kommunen nr. null uten utbygging. */
export type Planlagt = ReturnType<typeof byggPlanlagt>;
export async function planlagt(nr: string): Promise<Planlagt | null> {
  const [R, land] = await Promise.all([katalog.gull.utbygging(nr), landareal(nr)]);
  return R ? byggPlanlagt(R, land) : null;
}
export async function plansum(nr: string): Promise<PlanSum | null> {
  const R = await katalog.gull.utbygging(nr);
  return R ? byggPlanSum(R) : null;
}

/* Planlagt utbygging per detaljklasse: km² per klasse i DETALJKLASSER (km2), planlagt utbygging der ingen detaljklasse passer
   (ukjent), rutestørrelsen utbyggingen er regnet med, og om bare en del av kommunen er med (delvis) */
export interface PlanlagtDetaljer {
  km2: number[];
  ukjent: number;
  rute: number;
  delvis: boolean;
}
/* Tabellen gull.planlagtPerDetaljklasse: den planlagte utbyggingen i kommunen nr (gull.utbygging, uten smale striper) fordelt på
   detaljklassene i grunnkartet (solv.detaljklasser). Hver rute med planlagt utbygging på natur får den naturklassen det er mest av
   i ruta, og hver rute på jordbruk den jordbruksklassen det er mest av. Detaljklassene er på 10,6 meter, så en rute på 21 meter er
   2 x 2 av dem. Slik blir summen den samme som natur og jordbruk satt av i gull.plansum. Finnes ingen klasse av riktig slag i ruta,
   telles den som ukjent. null uten utbygging, eller når kommunen ikke har lagrede detaljklasser. */
export async function planlagtPerDetaljklasse(nr: string): Promise<PlanlagtDetaljer | null> {
  const [L, R] = await Promise.all([katalog.solv.detaljblokker(nr), katalog.gull.utbygging(nr)]);
  if (!R || !L.length) return null;
  const f = 1 << (FLISNIVA - R.z) /* detaljruter langs siden av en rute */,
    har = new Set(L.map(([, x, y]) => `${x}/${y}`)),
    perBlokk = new Map<string, number[]>(),
    n = new Array<number>(DETALJKLASSER.length + 1).fill(0);
  for (const i of R.celler) {
    const d = verdi(R.ryddet, i);
    if (d !== 1 && d !== 2) continue;
    const X = (R.cx0 + (i % R.w)) * f,
      Y = (R.cy0 + Math.floor(i / R.w)) * f,
      k = `${Math.floor(X / 512)}/${Math.floor(Y / 512)}`;
    if (!perBlokk.has(k)) perBlokk.set(k, []);
    perBlokk.get(k)!.push(i);
  }
  for (const [k, celler] of perBlokk) {
    if (!har.has(k)) {
      n[0] += celler.length;
      continue;
    }
    const [bx, by] = k.split('/').map(Number),
      K = await katalog.solv.detaljklasser([FLISNIVA, bx, by]);
    for (const i of celler) {
      const gruppe = verdi(R.ryddet, i) === 1 ? 'nat' : 'jor',
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
      n[best]++;
    }
  }
  const km2 = ruteKm2(R.z);
  return { km2: n.slice(1).map(v => v * km2), ukjent: n[0] * km2, rute: R.rute, delvis: R.delvis };
}
