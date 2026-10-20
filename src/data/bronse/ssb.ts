/* Bronse for SSB: tabell 09594, «Arealbruk og arealressurser», gjennom SSBs API. Svarene kommer urørt tilbake som JSON-stat 2.0 og
   gjøres om i solv/ssb.ts. Én henting for alle kommunene i 2017 og 2024, som de syntetiske tallene for naturregnskapet lages av
   (solv/naturregnskap.ts). Ingen tall på sidene kommer fra arealstatistikken direkte. */
import { katalog } from '../katalog.ts';
import { DETALJER, type JsonStat } from '../solv/ssb.ts';
import { SSB, SSB_ELDRE as SSB0 } from './endepunkter.ts';
import { hent } from './henting.ts';

/* SSB har to API-er til samme tabell. Det nye brukes først. Svarer det ikke, spørres det eldre om det samme.
   Det eldre tar spørringen som tekst i et POST-kall, og har ikke «fra og med år», så tidsserien kommer med alle år. */
type Utvalg = [filter: string, verdier: string[]];
async function hentSSB(hva: string, nytt: string, region: Utvalg, tid: Utvalg, koder: string[]): Promise<JsonStat> {
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
/* Tabellen bronse.arealAlle: arealet i 2017 og 2024 for hver av SSBs arealklasser for seg, for alle kommunene i ett kall, med SSBs
   sammenslåtte tidsserier (kodelisten agg_KommSummer), så tallene gjelder dagens kommuner også der kommuner er slått sammen. Til de
   syntetiske tabellene for naturregnskapet. Det eldre API-et får kommunene fra listen over kommuner. */
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
