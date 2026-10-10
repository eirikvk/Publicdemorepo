/* Gull for planlagt utbygging: natur og jordbruk som kommuneplanen (og egne områder) setter av, regnet ut fra planrutenettet i
   sølv. Arealer er i km², andeler i prosent. */
import { OPPLOSNINGER, RUTE } from '../solv/felles.ts';
import type { Planrutenett } from '../solv/planrutenett.ts';
import { andel } from './felles.ts';

/* Kortversjonen til oversikten og regnskapet: natur og jordbruk satt av i km², om bare en del av kommunen er hentet, og hvor mange
   egne områder som er med */
export interface PlanSum {
  nr: string;
  nat: number;
  jor: number;
  delvis: boolean;
  egne: number;
}

/* Det siden viser om planlagt utbygging. R er planrutenettet, og land landarealet fra SSB. For natur og jordbruk: arealet uten smale
   striper, andelen av det som er natur eller jordbruk i dag i samme rutenett, og arealet med smale striper. Med egne områder også
   planen alene (basis). Er bare en del av kommunen hentet (delvis), også hvor mye land som er hentet. */
export function byggPlanlagt(R: Planrutenett, land: number) {
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
export const byggPlanSum = (R: Planrutenett): PlanSum => ({
  nr: R.nr,
  nat: R.sum.rn * RUTE,
  jor: R.sum.rj * RUTE,
  delvis: R.delvis,
  egne: R.antallEgne
});
