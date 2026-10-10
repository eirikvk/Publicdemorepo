/* Sølv, felles standard: projeksjonene siden kjenner, og omregning til UTM33. Kartet registrerer de samme projeksjonene i
   OpenLayers (ui/kart/ol.ts), så kart og data regner likt. */
import proj4 from 'proj4';
import { UTM, type Punkt } from './felles.ts';

proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
proj4.defs('EPSG:25835', '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');
proj4.defs('EPSG:4258', '+proj=longlat +ellps=GRS80 +no_defs +type=crs');
proj4.defs('EPSG:102100', proj4.defs('EPSG:3857')); /* Esris navn på web-mercator, som OpenLayers også kjenner */

export { proj4 };
/* Om projeksjonen er kjent, for eksempel 'EPSG:25832' */
export const kjent = (kode: string) => !!proj4.defs(kode);
/* En omregner fra projeksjonen fra til UTM33, for punkter [x, y] eller [x, y, z]. Bare x og y regnes om, og høyden følger med
   uendret, slik OpenLayers også gjør. */
export const tilUTM = (fra: string): ((p: Punkt) => Punkt) => {
  if (fra === UTM) return p => p.slice();
  const om = proj4(fra, UTM);
  return p => [...om.forward([p[0], p[1]]), ...p.slice(2)];
};
