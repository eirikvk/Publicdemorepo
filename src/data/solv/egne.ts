/* Sølv for egne områder og opplastet plan: hvilke flater som regnes som utbygging. De legges oppå kommuneplanen og dagens klasser i
   gull (gull/utbygging.ts). */
import type { Flerflate, Utsnitt } from '../generelt/geometri.ts';
import { arealKm2 } from './felles.ts';

/* Utbygging ('bygg') eller ikke utbygging ('fri') */
export type Type = 'bygg' | 'fri';
/* Én flate i et eget område: flaten, utsnittet og typen */
export interface Del {
  koord: Flerflate;
  ext: Utsnitt;
  type: Type;
}
/* Et eget område slik utbyggingen trenger det: flatene og utsnittet rundt dem */
export interface Flater {
  deler: Del[];
  ext: Utsnitt;
}
/* Tabellen solv.egne: de egne områdene i en kommune, i rekkefølge, med id (ider) og flatene. Det er brukeren som lager dem, så
   datamotoren fyller tabellen selv når de endres. */
export interface Egne {
  ider: number[];
  flater: Flater[];
}
/* En flate i en opplastet plan, slik den leses i bronse/planfil.ts: arealformål og arealbruksstatus som sifre, eller tom tekst */
export interface Planflate {
  koord: Flerflate;
  ext: Utsnitt;
  formal: string;
  status: string;
}

/* Om en flate i en opplastet plan er utbygging ('bygg') eller ikke ('fri'). Bebyggelse og anlegg og samferdsel (arealformål i
   1000- og 2000-serien) med status framtidig, eller uten status, er utbygging, slik som for kommuneplanen fra DiBK. Andre flater
   med arealformål er ikke utbygging. Har filen ingen arealformål i det hele tatt, er alle flatene utbygging. formal og status er
   sifrene i egenskapene, eller tom tekst. */
export const planType = (formal: string, status: string, harFormal: boolean): Type =>
  !harFormal || (/^[12]/.test(formal) && (status === '' || status === '2')) ? 'bygg' : 'fri';

/* Flatene i en opplastet plan, som de leses i bronse/planfil.ts, gjort om til egne områder: hver flate får type etter planType.
   Gir flatene, det samlede arealet i km², og hvor mange som er utbygging og ikke. */
export function planflater(deler: Planflate[], harFormal: boolean) {
  let km2 = 0;
  const ut = deler.map(({ koord, ext, formal, status }): Del => {
    km2 += arealKm2(koord, ext);
    return { koord, type: planType(formal, status, harFormal), ext };
  });
  const bygg = ut.filter(d => d.type === 'bygg').length;
  return { deler: ut, km2, bygg, annet: ut.length - bygg };
}
