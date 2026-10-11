/* Sølv for egne områder og opplastet plan: hvilke flater som regnes som utbygging (tabellen solv.egne). Kilden er bronse.egne, det
   brukeren har tegnet eller lastet opp, som datamotoren fyller. Flatene legges oppå kommuneplanen og dagens klasser i gull
   (gull/utbygging.ts). */
import type { Flerflate, Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
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
/* Tabellen solv.egne: de egne områdene i en kommune, i rekkefølge, med id (ider) og flatene med typen sin */
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
/* Et eget område slik brukeren laget det, i tabellen bronse.egne: et tegnet område med typen brukeren har valgt, eller en opplastet
   plan med arealformål og status per flate (harFormal sier om filen har arealformål i det hele tatt) */
export type Egetinn = { id: number; ext: Utsnitt } & (
  { kilde: 'tegnet'; deler: Del[] } | { kilde: 'fil'; deler: Planflate[]; harFormal: boolean }
);

/* Om en flate i en opplastet plan er utbygging ('bygg') eller ikke ('fri'). Bebyggelse og anlegg og samferdsel (arealformål i
   1000- og 2000-serien) med status framtidig, eller uten status, er utbygging, slik som for kommuneplanen fra DiBK. Andre flater
   med arealformål er ikke utbygging. Har filen ingen arealformål i det hele tatt, er alle flatene utbygging. formal og status er
   sifrene i egenskapene, eller tom tekst. */
export const planType = (formal: string, status: string, harFormal: boolean): Type =>
  !harFormal || (/^[12]/.test(formal) && (status === '' || status === '2')) ? 'bygg' : 'fri';

/* Det samlede arealet av flatene, i km² */
export const samletKm2 = (deler: { koord: Flerflate; ext: Utsnitt }[]) =>
  deler.reduce((s, d) => s + arealKm2(d.koord, d.ext), 0);

/* Tabellen solv.egne: de egne områdene i kommunen nr fra bronse.egne, med typen for hver flate. Tegnede områder har typen brukeren
   har valgt, og flatene i en opplastet plan får typen etter planType. */
export async function egne(nr: string): Promise<Egne> {
  const B = (await katalog.bronse.egne(nr)) || [];
  return {
    ider: B.map(g => g.id),
    flater: B.map(g => ({
      ext: g.ext,
      deler:
        g.kilde === 'tegnet'
          ? g.deler
          : g.deler.map(({ koord, ext, formal, status }) => ({
              koord,
              ext,
              type: planType(formal, status, g.harFormal)
            }))
    }))
  };
}
