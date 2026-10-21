/* Sølv for landstabellen: Parquet-filene fra bronse (bronse/landstall.ts) lest med hyparquet og gjort om til felles form, med tall
   der filen har tall og null der tallet mangler. Kolonnene er beskrevet i gull/landstall.ts (Kommunetall), der tallene regnes ut
   for hver kommune. */
import { parquetReadObjects } from 'hyparquet';
import { katalog } from '../katalog.ts';

/* Radene i en Parquet-fil som objekter med kolonnenavnene */
const lesRader = (fil: ArrayBuffer): Promise<Record<string, unknown>[]> => parquetReadObjects({ file: fil });

/* Én kommune i landstabellen, i km² og prosent, som gull.kommunetall */
export interface Landstallrad {
  nr: string;
  navn: string;
  land: number;
  grunnkartLand: number | null;
  vern: number;
  vernLand: number | null;
  villrein: number;
  verdsatt: number;
  kartlagt: number | null;
  kartlagtAndel: number | null;
  inon: number;
  graa: number;
}
/* Landstabellen: når tallene ble regnet ut (dato, åååå-mm-dd) og radene, ordnet etter kommunenummeret */
export interface Landstall {
  beregnet: string;
  rader: Landstallrad[];
}
/* Arealet av en naturtype i verdsatt natur i en kommune, og antall lokaliteter */
export interface Landsnaturtype {
  nr: string;
  navn: string;
  km2: number;
  antall: number;
}
const tall = (x: unknown) => (x === null || x === undefined || x === '' ? null : Number(x));
const tall0 = (x: unknown) => tall(x) || 0;

/* Tabellen solv.landstall: landstabellen i felles form */
export async function landstall(): Promise<Landstall> {
  const R = await lesRader(await katalog.bronse.landstall());
  return {
    beregnet: R.length ? String(R[0].beregnet || '') : '',
    rader: R.map(r => ({
      nr: String(r.kommune),
      navn: String(r.navn || ''),
      land: tall0(r.land_km2),
      grunnkartLand: tall(r.grunnkart_land_km2),
      vern: tall0(r.vern_km2),
      vernLand: tall(r.vern_land_km2),
      villrein: tall0(r.villrein_km2),
      verdsatt: tall0(r.verdsatt_km2),
      kartlagt: tall(r.kartlagt_km2),
      kartlagtAndel: tall(r.kartlagt_andel),
      inon: tall0(r.inon_km2),
      graa: tall0(r.graa_km2)
    })).sort((a, b) => a.nr.localeCompare(b.nr))
  };
}
/* Tabellen solv.landsnaturtyper: naturtypene i alle kommunene i felles form */
export async function landsnaturtyper(): Promise<Landsnaturtype[]> {
  const R = await lesRader(await katalog.bronse.landsnaturtyper());
  return R.map(r => ({ nr: String(r.kommune), navn: String(r.naturtype), km2: tall0(r.km2), antall: tall0(r.antall) }));
}
