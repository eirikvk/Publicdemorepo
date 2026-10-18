/* Bronse for Kartverket: listen over fylker og kommuner, kommunegrensene, oppslag av kommune i et punkt, og bakgrunnskartet. */
import { utsnitt, type GeoJsonFlate } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import type { Flis, Fylke, Kommune } from '../solv/felles.ts';
import { BAKGRUNN, KOMMUNEINFO as KV } from './endepunkter.ts';
import { hent, lagHenter } from './henting.ts';

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

/* Kommunen i et punkt [øst, nord] i UTM33 */
export const hentKommuneIPunkt = (p: number[]) =>
  hent(
    'Kartverket',
    'Kommune i punktet',
    `${KV}/punkt?nord=${p[1].toFixed(0)}&ost=${p[0].toFixed(0)}&koordsys=25833`,
    true
  ) as Promise<{ kommunenummer: string }>;

/* Nøkkelen til et punkt [øst, nord]: hele meter, slik punktet slås opp */
export const punktNokkel = (p: number[]) => `${p[0].toFixed(0)},${p[1].toFixed(0)}`;
/* Tabellen bronse.kommuneIPunkt: hvilken kommune punktet p [øst, nord] i UTM33 ligger i */
export async function kommuneIPunkt(p: number[]): Promise<{ kommunenummer: string }> {
  return hentKommuneIPunkt(p);
}

/* Bakgrunnskartet: Kartverkets topografiske kart i gråtoner, som fliser i UTM33 */
export const bakgrunnUrl = ([z, x, y]: Flis) => `${BAKGRUNN}/${String(z).padStart(2, '0')}/${y}/${x}.png`;
/* Bakgrunnskartet bare vises: egen kø med seks kall om gangen, som nettleseren selv bruker mot én vert */
const hentBakgrunn = lagHenter('Kartverket', 'Bakgrunn', { bareVisning: true, samtidig: 6 });
/* Tabellen bronse.bakgrunnsflis: én flis av bakgrunnskartet, som PNG */
export async function bakgrunnsflis(tc: Flis): Promise<ArrayBuffer> {
  return hentBakgrunn(bakgrunnUrl(tc));
}

/* Tabellen bronse.kommuner: fylkene med kommunene sine, sortert etter navn */
export async function kommuner(): Promise<Fylke[]> {
  const fylker = await hentKommuneliste();
  fylker.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
  fylker.forEach(f => f.kommuner.sort((a, b) => a.navn.localeCompare(b.navn, 'nb')));
  return fylker;
}
/* Kommunen med nummeret nr, fra listen. Kildene vil ha navnet til kall-loggen. */
export async function kommunen(nr: string): Promise<Kommune> {
  for (const f of await katalog.bronse.kommuner()) for (const k of f.kommuner) if (k.nr === nr) return k;
  throw new Error(`fant ikke kommune ${nr}`);
}
/* Tabellen bronse.kommunegrense: kommunegrensen som GeoJSON i UTM33 */
export async function kommunegrense(nr: string): Promise<GeoJsonFlate> {
  return hentKommunegrense(await kommunen(nr));
}

/* Registeret over de lagrede kommunegrensene (kommunegrenser.json): når de er hentet, og kommunene. For hver kommune ligger svaret
   fra solv.grense og fra solv.kommunebiter ferdig sammen med siden, laget av verktoy/kommunegrenser.ts med de samme funksjonene. */
export interface Grenseregister {
  hentet?: string;
  kommuner?: string[];
}
/* Den lagrede grensen: svaret fra solv.grense uten nummeret */
export interface LagretGrense {
  koord: GeoJsonFlate['coordinates'];
  ext: number[];
  km2: number;
}
/* Tabellen bronse.grenseregister: registeret, eller null når det ikke kan hentes */
export async function grenseregister(): Promise<Grenseregister | null> {
  return (
    hent('Egen fil', 'Register over lagrede kommunegrenser', 'kommunegrenser.json', true) as Promise<Grenseregister>
  ).catch(() => null);
}
const erLagret = async (nr: string) => {
  const reg = await katalog.bronse.grenseregister();
  return !!(reg && reg.kommuner && reg.kommuner.includes(nr));
};
/* Tabellen bronse.grensefil: den lagrede grensen for kommunen nr, eller null når den ikke står i registeret */
export async function grensefil(nr: string): Promise<LagretGrense | null> {
  if (!(await erLagret(nr))) return null;
  return hent('Egen fil', `Lagret grense ${nr}`, `kommunegrenser/${nr}.json`) as Promise<LagretGrense>;
}
/* Tabellen bronse.andelfil: kommunens andel per rute i bitene for kommunen nr slik den er lagret (gzip), eller null når den ikke står
   i registeret */
export async function andelfil(nr: string): Promise<ArrayBuffer | null> {
  if (!(await erLagret(nr))) return null;
  return hent('Egen fil', `Lagret andel ${nr}`, `kommunegrenser/${nr}-andel.bin.gz`, false, true);
}

/* Tabellen bronse.kommuneareal: flaten til hver kommune i km² (land, ferskvann og hav), regnet av Kartverkets grenser én gang og lagret
   sammen med siden (kommuneareal.json, laget av verktoy/kommuneareal.ts) */
export interface Kommuneareal {
  kilde: string;
  hentet: string;
  km2: Record<string, number>;
}
export async function kommuneareal(): Promise<Kommuneareal> {
  return hent('Egen fil', 'Flaten til kommunene', 'kommuneareal.json') as Promise<Kommuneareal>;
}
