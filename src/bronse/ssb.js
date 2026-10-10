/* Bronse for SSB: tabell 09594, «Arealbruk og arealressurser», gjennom SSBs API. Svarene kommer urørt tilbake som JSON-stat 2.0 og
   gjøres om i solv/ssb.js. */
import { KL, VANN } from '../solv/klasser.js';
import { hent } from './henting.js';

const SSB = 'https://data.ssb.no/api/pxwebapi/v2/tables/09594/data';
/* SSB har to API-er til samme tabell. Det nye brukes først. Svarer det ikke, spørres det eldre om det samme.
   Det eldre tar spørringen som tekst i et POST-kall, og har ikke «fra og med år», så tidsserien kommer med alle år. */
const SSBKODER = [
  ...KL.flatMap(x => x[3]),
  ...VANN.map(x => x[3]).filter(Boolean)
]; /* arealklassene som hentes: de tre på land, og innsjø og elv */
const SSB0 = 'https://data.ssb.no/api/v0/no/table/09594';
async function hentSSB(hva, nytt, region, tid) {
  try {
    return await hent('SSB', hva, nytt);
  } catch (e) {}
  const valg = (code, filter, values) => ({ code, selection: { filter, values } });
  return hent(
    'SSB',
    hva + ', eldre API',
    SSB0,
    false,
    false,
    false,
    JSON.stringify({
      query: [
        valg('Region', ...region),
        valg('ArealKlasse', 'item', SSBKODER),
        valg('ContentsCode', 'item', ['Areal']),
        valg('Tid', ...tid)
      ],
      response: { format: 'json-stat2' }
    })
  );
}
/* Arealet per klasse for kommunen k, nyeste år */
export const hentArealtall = k =>
  hentSSB(
    `Areal for ${k.navn}`,
    `${SSB}?lang=no&outputformat=json-stat2&valueCodes[Region]=${k.nr}&valueCodes[ArealKlasse]=${SSBKODER.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=top(1)`,
    ['item', [k.nr]],
    ['top', ['1']]
  );
/* Arealet per klasse fra 2017 og fram, med SSBs sammenslåtte tidsserier (kodelisten agg_KommSummer), så tallene gjelder dagens
   kommune også der kommuner er slått sammen. */
export const hentTidsserie = k =>
  hentSSB(
    `Areal fra 2017 for ${k.navn}`,
    `${SSB}?lang=no&outputformat=json-stat2&codelist[Region]=agg_KommSummer&outputValues[Region]=aggregated&valueCodes[Region]=K-${k.nr}&valueCodes[ArealKlasse]=${SSBKODER.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=from(2017)`,
    ['agg:KommSummer', ['K-' + k.nr]],
    ['all', ['*']]
  );
