/* Bronse for Miljødirektoratets karttjenester (ArcGIS REST): verneområder, leveområder for villrein, naturtyper med KU-verdi og
   dekningskartet for naturtypekartlegging. Flatene hentes som GeoJSON i UTM33, forenklet med noen meter, og kommer urørt tilbake. */
import type { Kommune, Utsnitt } from '../solv/felles.ts';
import type { Objekt } from '../solv/temaer.ts';
import { hent } from './henting.ts';

/* Svaret fra tjenesten: flatene, og om det var flere enn tjenesten gir i ett svar */
export interface Temasvar {
  features?: Objekt[];
  exceededTransferLimit?: boolean;
}

const MD = 'https://kart.miljodirektoratet.no/arcgis/rest/services/';
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
    t.url +
      '?' +
      new URLSearchParams({
        where: t.hvor ? t.hvor(k.nr) : `kommune LIKE '%(${k.nr})%'`,
        outFields: t.felt,
        outSR: '25833',
        maxAllowableOffset: String(t.slakk),
        geometryPrecision: '0',
        f: 'geojson'
      })
  ) as Promise<Temasvar>;
}
/* Det kartlagte for naturtyper etter Miljødirektoratets instruks: alle dekningsflater som berører utsnittet e rundt kommunen */
export const hentKartlagt = (k: Kommune, e: Utsnitt) =>
  hent(
    'Miljødirektoratet',
    `Kartlagt område i ${k.navn}`,
    MD +
      'naturtyper_nin/MapServer/1/query?' +
      new URLSearchParams({
        where: '1=1',
        geometry: e.map(v => Math.round(v)).join(','),
        geometryType: 'esriGeometryEnvelope',
        inSR: '25833',
        outSR: '25833',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'Årstall',
        maxAllowableOffset: '10',
        geometryPrecision: '0',
        f: 'geojson'
      })
  ) as Promise<Temasvar>;
