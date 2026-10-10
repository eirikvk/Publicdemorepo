/* Henting av tallene fra SSB, tabell 09594: arealklasser, land og vann, og arealet fra 2017 til utbredelsesregnskapet. Svarene
   tolkes i analyse/ssb.js. Tilstanden ligger i app: arealtall, ssbSum, ferskvann og historie. */
import { KL, VANN } from '../analyse/klasser.js';
import { tolkAreal, tolkHistorie } from '../analyse/ssb.js';
import { SSB, app, endret, hent, valgNr } from './felles.js';

export function nullstillTall(tilstand) {
  /* ingen tall å vise: de hentes, eller hentingen feilet */
  app.ssbSum = 0;
  app.ferskvann = null;
  app.arealtall = { tilstand };
  endret();
}

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
export async function hentTall(k, mitt) {
  try {
    const j = await hentSSB(
      `Areal for ${k.navn}`,
      `${SSB}?lang=no&outputformat=json-stat2&valueCodes[Region]=${k.nr}&valueCodes[ArealKlasse]=${SSBKODER.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=top(1)`,
      ['item', [k.nr]],
      ['top', ['1']]
    );
    if (mitt !== valgNr) return;
    const T = tolkAreal(j);
    app.ferskvann = T.ferskvann;
    app.arealtall = { tilstand: 'ok', a: T.a, aar: T.aar };
    app.ssbSum = T.a[0] + T.a[1] + T.a[2];
    endret();
  } catch (e) {
    if (mitt === valgNr) nullstillTall('feil');
  }
}
/* Arealet i 2017 og i SSBs nyeste tall, til utbredelsesregnskapet. SSB advarer mot å lese forskjeller mellom årganger som
   endring, så siden sier at det er en forskjell og ikke målt endring.
   Tallene for 2017 hentes med SSBs sammenslåtte tidsserier, så de gjelder dagens kommune også der kommuner er slått sammen.
   Er kommunens samlede flate likevel en annen i 2017, er grensen flyttet, og da vises ingen sammenligning. */

export async function hentHistorie(k, mitt) {
  try {
    const j = await hentSSB(
      `Areal fra 2017 for ${k.navn}`,
      `${SSB}?lang=no&outputformat=json-stat2&codelist[Region]=agg_KommSummer&outputValues[Region]=aggregated&valueCodes[Region]=K-${k.nr}&valueCodes[ArealKlasse]=${SSBKODER.join(',')}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=from(2017)`,
      ['agg:KommSummer', ['K-' + k.nr]],
      ['all', ['*']]
    );
    if (mitt !== valgNr) return;
    const H = tolkHistorie(j, k.nr);
    if (!H) return;
    app.historie = H;
    endret();
  } catch (e) {} /* uten historiske tall vises ikke blokken */
}
