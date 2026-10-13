/* Bronse for Miljødirektoratets kart over naturskog, versjon 1 (WMS): kartbilder til visning. Tjenesten har flere lag. To brukes:
   naturskogsnærhet (sju klasser for hvor nær naturskog skogen er) og skog etablert før 1940 som ikke er flatehogd. Bildene vises
   bare i kartet, og tallene bygger ikke på dem. Foreløpig bare til tvillingen fra Figma. */
import { flisUtsnitt, type Flis } from '../solv/felles.ts';
import { lagHenter } from './henting.ts';
import { wmsBilde } from './wms.ts';

const NATURSKOG = 'https://image001.miljodirektoratet.no/arcgis/services/naturskog/naturskog_v1/MapServer/WMSServer';
/* Lagene som brukes, med navnet i tjenesten */
export type Naturskoglag = 'naturskogsnaerhet' | 'skog_etablert_foer_1940_ikke_flatehogd';
/* Kartbildene hentes gjennom en egen kø, bare til visning */
const hentNaturskog = lagHenter('Miljødirektoratet', 'Naturskog', { bareVisning: true });

/* Tabellen bronse.naturskogflis: et kartbilde av laget for flisen tc [z, x, y], 512 x 512 piksler, kalt med [lag, tc] */
export async function naturskogflis([lag, tc]: [Naturskoglag, Flis]): Promise<ArrayBuffer> {
  return hentNaturskog(
    wmsBilde(NATURSKOG, flisUtsnitt(tc), 512, 512, {
      layers: lag,
      styles: '',
      format: 'image/png',
      transparent: 'true'
    })
  );
}
