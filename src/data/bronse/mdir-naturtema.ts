/* Bronse for Miljødirektoratets karttjenester (ArcGIS REST): verneområder, leveområder for villrein, naturtyper med KU-verdi og
   dekningskartet for naturtypekartlegging. Flatene hentes som GeoJSON i UTM33, forenklet med noen meter, og kommer urørt tilbake.
   Hvert lag gir høyst et visst antall flater per svar (maxRecordCount: 1000 for villrein, 2000 for verneområder og 5000 for
   naturtypene, oktober 2026). Er det flere, sier svaret fra (exceededTransferLimit), og resten hentes side for side
   (resultOffset), sortert etter OBJECTID så sidene ikke overlapper. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { UTM, type Kommune } from '../solv/felles.ts';
import type { Objekt } from '../solv/temaer.ts';
import { hent } from './henting.ts';
import { kommunen } from './kartverket.ts';

/* Svaret fra tjenesten: flatene, og om det fortsatt er flere enn det som er hentet (bare når grensen for antall sider er nådd) */
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
/* Høyst så mange sider hentes. Ved 1000 flater per side er det 50 000 flater, langt over det noen kommune har. */
const MAKS_SIDER = 50;
/* Alle flatene for spørringen, side for side: neste side hentes så lenge svaret sier at det er flere. hva står i kall-loggen. */
async function alleFlater(
  hva: string,
  adresse: string,
  slakk: number,
  valg: Record<string, string>
): Promise<Temasvar> {
  const features: Objekt[] = [];
  for (let side = 0; side < MAKS_SIDER; side++) {
    const j = (await hent(
      'Miljødirektoratet',
      side ? `${hva}, fra nr. ${features.length + 1}` : hva,
      flater(adresse, slakk, { ...valg, orderByFields: 'OBJECTID', resultOffset: String(features.length) })
    )) as Temasvar;
    const nye = j.features || [];
    features.push(...nye);
    if (!j.exceededTransferLimit || !nye.length) return { features };
  }
  return { features, exceededTransferLimit: true };
}
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
  return alleFlater(`${navn} i ${k.navn}`, t.url, t.slakk, {
    where: t.hvor ? t.hvor(k.nr) : `kommune LIKE '%(${k.nr})%'`,
    outFields: t.felt
  });
}
/* Det kartlagte for naturtyper etter Miljødirektoratets instruks: alle dekningsflater som berører utsnittet e rundt kommunen */
export const hentKartlagt = (k: Kommune, e: Utsnitt) =>
  alleFlater(`Kartlagt område i ${k.navn}`, MD + 'naturtyper_nin/MapServer/1/query', 10, {
    where: '1=1',
    geometry: e.map(v => Math.round(v)).join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: SR,
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'Årstall'
  });

/* Tabellene bronse.verneomrader, bronse.villrein og bronse.verdsattNatur: flatene i hvert tema for kommunen, som GeoJSON */
export async function verneomrader(nr: string): Promise<Temasvar> {
  return hentTemaflater('vern', 'Verneområder', await kommunen(nr));
}
export async function villrein(nr: string): Promise<Temasvar> {
  return hentTemaflater('rein', 'Villrein', await kommunen(nr));
}
export async function verdsattNatur(nr: string): Promise<Temasvar> {
  return hentTemaflater('verdi', 'Verdsatt natur', await kommunen(nr));
}
/* Tabellen bronse.kartlagt: dekningsflatene for naturtypekartlegging rundt kommunen, som GeoJSON */
export async function kartlagt(nr: string): Promise<Temasvar> {
  return hentKartlagt(await kommunen(nr), (await katalog.solv.grense(nr)).ext);
}
