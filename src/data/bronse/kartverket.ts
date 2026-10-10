/* Bronse for Kartverket: listen over fylker og kommuner, kommunegrensene, oppslag av kommune i et punkt, og bakgrunnskartet. */
import { utsnitt, type GeoJsonFlate } from '../generelt/geometri.ts';
import type { Flis, Fylke, Kommune } from '../solv/felles.ts';
import { hent } from './henting.ts';

const KV = 'https://api.kartverket.no/kommuneinfo/v1';

/* Avgrensningsboksen til en kommune som [vest, sør, øst, nord] i grader */
const boksAv = (b: { coordinates?: number[][][] } | null) => {
  const c = b && b.coordinates && b.coordinates[0];
  return c ? utsnitt([[c]]) : null;
};
/* Fylkene med kommunene sine: [{ nr, navn, kommuner: [{ nr, navn, boks }] }]. En kopi av listen ligger sammen med siden
   (kommuner.json). Kan den ikke hentes, spørres Kartverket. */
type ListeFil = [nr: string, navn: string, kommuner: [nr: string, navn: string, ...boks: number[]][]][];
interface KartverketFylke {
  fylkesnummer: string;
  fylkesnavn: string;
  kommuner: {
    kommunenummer: string;
    kommunenavnNorsk: string;
    avgrensningsboks: { coordinates?: number[][][] } | null;
  }[];
}
export const hentKommuneliste = (): Promise<Fylke[]> =>
  hent('Egen fil', 'Fylker og kommuner', 'kommuner.json', true)
    .then(j =>
      (j as ListeFil).map(f => ({
        nr: f[0],
        navn: f[1],
        kommuner: f[2].map(k => ({ nr: k[0], navn: k[1], boks: k.slice(2) as number[] }))
      }))
    )
    .catch(() =>
      hent('Kartverket', 'Fylker og kommuner', `${KV}/fylkerkommuner`).then(j =>
        (j as KartverketFylke[]).map(f => ({
          nr: f.fylkesnummer,
          navn: f.fylkesnavn,
          kommuner: f.kommuner.map(k => ({
            nr: k.kommunenummer,
            navn: k.kommunenavnNorsk,
            boks: boksAv(k.avgrensningsboks)
          }))
        }))
      )
    );

/* Kommunegrensen som GeoJSON-geometri i UTM33 */
export const hentKommunegrense = (k: Kommune) =>
  hent('Kartverket', `Grense for ${k.navn}`, `${KV}/kommuner/${k.nr}/omrade?utkoordsys=25833`).then(
    j => (j as { omrade: GeoJsonFlate }).omrade
  );

/* Kommunen i et punkt [øst, nord] i UTM33. Svaret huskes ikke. */
export const hentKommuneIPunkt = (p: number[]) =>
  hent(
    'Kartverket',
    'Kommune i punktet',
    `${KV}/punkt?nord=${p[1].toFixed(0)}&ost=${p[0].toFixed(0)}&koordsys=25833`,
    true,
    false,
    true
  ) as Promise<{ kommunenummer: string }>;

/* Bakgrunnskartet: Kartverkets topografiske kart i gråtoner, som fliser i UTM33 */
export const bakgrunnUrl = ([z, x, y]: Flis) =>
  `https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/utm33n/${String(z).padStart(2, '0')}/${y}/${x}.png`;
