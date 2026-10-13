/* Bronse for SSB: tabell 09594, «Arealbruk og arealressurser», gjennom SSBs API. Svarene kommer urørt tilbake som JSON-stat 2.0 og
   gjøres om i solv/ssb.ts. */
import { katalog } from '../katalog.ts';
import type { Kommune } from '../solv/felles.ts';
import { kommunen } from './kartverket.ts';
import { KL, VANN } from '../solv/klasser.ts';
import { DETALJER, type JsonStat } from '../solv/ssb.ts';
import { SSB, SSB_ELDRE as SSB0 } from './endepunkter.ts';
import { hent } from './henting.ts';

/* SSB har to API-er til samme tabell. Det nye brukes først. Svarer det ikke, spørres det eldre om det samme.
   Det eldre tar spørringen som tekst i et POST-kall, og har ikke «fra og med år», så tidsserien kommer med alle år. */
const SSBKODER = [
  ...KL.flatMap(x => x[3]),
  ...VANN.map(x => x[3]).filter((x): x is string => !!x)
]; /* arealklassene som hentes: de tre på land, og innsjø og elv */
type Utvalg = [filter: string, verdier: string[]];
async function hentSSB(hva: string, nytt: string, region: Utvalg, tid: Utvalg, koder = SSBKODER): Promise<JsonStat> {
  try {
    return (await hent('SSB', hva, nytt)) as JsonStat;
  } catch (e) {}
  const valg = (code: string, filter: string, values: string[]) => ({ code, selection: { filter, values } });
  return hent(
    'SSB',
    hva + ', eldre API',
    SSB0,
    false,
    false,
    JSON.stringify({
      query: [
        valg('Region', ...region),
        valg('ArealKlasse', 'item', koder),
        valg('ContentsCode', 'item', ['Areal']),
        valg('Tid', ...tid)
      ],
      response: { format: 'json-stat2' }
    })
  ) as Promise<JsonStat>;
}
/* Arealet per klasse for kommunen k, nyeste år */
export const hentArealtall = (k: Kommune) =>
  hentSSB(
    `Areal for ${k.navn}`,
    `${SSB}?lang=no&outputformat=json-stat2&valueCodes[Region]=${k.nr}&valueCodes[ArealKlasse]=${SSBKODER.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=top(1)`,
    ['item', [k.nr]],
    ['top', ['1']]
  );
/* Arealet per klasse fra 2017 og fram, med SSBs sammenslåtte tidsserier (kodelisten agg_KommSummer), så tallene gjelder dagens
   kommune også der kommuner er slått sammen. */
export const hentTidsserie = (k: Kommune) =>
  hentSSB(
    `Areal fra 2017 for ${k.navn}`,
    `${SSB}?lang=no&outputformat=json-stat2&codelist[Region]=agg_KommSummer&outputValues[Region]=aggregated&valueCodes[Region]=K-${k.nr}&valueCodes[ArealKlasse]=${SSBKODER.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=from(2017)`,
    ['agg:KommSummer', ['K-' + k.nr]],
    ['all', ['*']]
  );

/* Arealet fra 2017 for hver av SSBs arealklasser for seg (se DETALJER i solv/ssb.ts), med de samme sammenslåtte tidsseriene.
   Brukes foreløpig bare av tvillingen fra Figma (srcFigma/), til skog, våtmark og hva arealet går til. */
export function hentDetaljer(k: Kommune) {
  const koder = DETALJER.map(d => d[0]);
  return hentSSB(
    `Arealklassene fra 2017 for ${k.navn}`,
    `${SSB}?lang=no&outputformat=json-stat2&codelist[Region]=agg_KommSummer&outputValues[Region]=aggregated&valueCodes[Region]=K-${k.nr}&valueCodes[ArealKlasse]=${koder.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=from(2017)`,
    ['agg:KommSummer', ['K-' + k.nr]],
    ['all', ['*']],
    koder
  );
}

/* Tabellen bronse.arealtall: arealet per klasse for kommunen i nyeste år, som JSON-stat */
export async function arealtall(nr: string): Promise<JsonStat> {
  return hentArealtall(await kommunen(nr));
}
/* Tabellen bronse.arealtidsserie: arealet per klasse fra 2017, som JSON-stat */
export async function arealtidsserie(nr: string): Promise<JsonStat> {
  return hentTidsserie(await kommunen(nr));
}
/* Tabellen bronse.arealdetaljer: arealet fra 2017 for hver av SSBs arealklasser for seg, som JSON-stat */
export async function arealdetaljer(nr: string): Promise<JsonStat> {
  return hentDetaljer(await kommunen(nr));
}

/* Tabellen bronse.arealAlle: arealet i 2017 og 2024 for hver av SSBs arealklasser for seg, for alle kommunene i ett kall, med de
   samme sammenslåtte tidsseriene. Til de syntetiske tabellene for hele Norge. Det eldre API-et får kommunene fra listen over
   kommuner. */
export async function arealAlle(): Promise<JsonStat> {
  const koder = DETALJER.map(d => d[0]),
    alle = (await katalog.bronse.kommuner()).flatMap(f => f.kommuner.map(k => 'K-' + k.nr));
  return hentSSB(
    'Arealklassene i 2017 og 2024 for alle kommuner',
    `${SSB}?lang=no&outputformat=json-stat2&codelist[Region]=agg_KommSummer&outputValues[Region]=aggregated&valueCodes[Region]=*&valueCodes[ArealKlasse]=${koder.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=2017,2024`,
    ['agg:KommSummer', alle],
    ['item', ['2017', '2024']],
    koder
  );
}
