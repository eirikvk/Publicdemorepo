/* Bronse for Miljødirektoratets karttjenester (ArcGIS REST): verneområder, leveområder for villrein, naturtyper med KU-verdi og
   dekningskartet for naturtypekartlegging. Flatene hentes som GeoJSON i UTM33, forenklet med noen meter, og kommer urørt tilbake. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { UTM, type Kommune } from '../solv/felles.ts';
import type { Objekt } from '../solv/temaer.ts';
import { hent } from './henting.ts';

/* Svaret fra tjenesten: flatene, og om det var flere enn tjenesten gir i ett svar */
export interface Temasvar {
  features?: Objekt[];
  exceededTransferLimit?: boolean;
}

const MD = 'https://kart.miljodirektoratet.no/arcgis/rest/services/';
const SR = UTM.replace('EPSG:', ''); /* UTM33 som tall, slik ArcGIS vil ha det */
/* En spørring etter flater i laget på adresse, som GeoJSON i UTM33 med hele meter. slakk er forenklingen i meter, og valg resten av
   spørringen (utvalget, feltene og lignende). */
const flater = (adresse: string, slakk: number, valg: Record<string, string>) =>
  adresse +
  '?' +
  new URLSearchParams({
    ...valg,
    outSR: SR,
    maxAllowableOffset: String(slakk),
    geometryPrecision: '0',
    f: 'geojson'
  });
/* Per tema: laget i tjenesten, feltene som hentes, forenklingen i meter, og utvalget når det ikke bare er kommunenummeret */
const TEMA: Record<string, { url: string; felt: string; slakk: number; hvor?: (nr: string) => string }> = {
  vern: { url: MD + 'vern/MapServer/0/query', felt: 'offisieltNavn,verneform,vernedato,faktaark', slakk: 5 },
  rein: { url: MD + 'villrein/MapServer/1/query', felt: '*', slakk: 20 },
  verdi: {
    url: MD + 'naturtyper_kuverdi/MapServer/0/query',
    hvor: nr =>
      `Verdikategori IN ('Svært stor verdi','Stor verdi','Middels verdi','Noe verdi') AND Kommune LIKE '%(${nr})%'`,
    felt: 'Verdikategori,Naturtype,Områdenavn,FaktaarkLokalitet,Faktaark',
    slakk: 5
  }
};
/* Flatene i temaet med id for kommunen k, der kommunenummeret står i egenskapen for kommune. navn er temaets navn, til
   kall-loggen. */
export function hentTemaflater(id: string, navn: string, k: Kommune): Promise<Temasvar> {
  const t = TEMA[id];
  return hent(
    'Miljødirektoratet',
    `${navn} i ${k.navn}`,
    flater(t.url, t.slakk, { where: t.hvor ? t.hvor(k.nr) : `kommune LIKE '%(${k.nr})%'`, outFields: t.felt })
  ) as Promise<Temasvar>;
}
/* Det kartlagte for naturtyper etter Miljødirektoratets instruks: alle dekningsflater som berører utsnittet e rundt kommunen */
export const hentKartlagt = (k: Kommune, e: Utsnitt) =>
  hent(
    'Miljødirektoratet',
    `Kartlagt område i ${k.navn}`,
    flater(MD + 'naturtyper_nin/MapServer/1/query', 10, {
      where: '1=1',
      geometry: e.map(v => Math.round(v)).join(','),
      geometryType: 'esriGeometryEnvelope',
      inSR: SR,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'Årstall'
    })
  ) as Promise<Temasvar>;
