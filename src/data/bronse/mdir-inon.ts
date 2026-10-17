/* Bronse for Miljødirektoratets kartlag for inngrepsfrie naturområder (WMS, laget status, nyeste status): bildene av bitene, uten
   glatting av kantene, så hver sone har én ren farge. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { BIT, flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { INON } from './endepunkter.ts';
import { hent } from './henting.ts';
import { wmsBilde, wmsPunkt } from './wms.ts';

const inonBilde = (u: Utsnitt, w: number, h: number) =>
  wmsBilde(INON, u, w, h, {
    layers: 'status',
    styles: '',
    format: 'image/png8',
    transparent: 'true',
    format_options: 'antialias:none'
  });
/* Tabellen bronse.inonbit: bildet av sonene i biten tc (en flis på nivå 8, solv/felles.ts) med 2048 x 2048 ruter à 10,6 meter,
   som PNG */
export async function inonbit(tc: Flis): Promise<ArrayBuffer> {
  return hent(
    'Miljødirektoratet',
    `Inngrepsfri natur, bit ${flisnavn(tc)}`,
    inonBilde(flisUtsnitt(tc), BIT, BIT),
    false,
    true
  );
}

/* Tabellen bronse.inonIPunkt: sonen i punktet p [øst, nord] slik Miljødirektoratet gir den (id, sone og arealet av sonen), som
   GeoJSON. Til detaljene ved trykk i kartet. */
export async function inonIPunkt(p: number[]): Promise<unknown> {
  return hent(
    'Miljødirektoratet',
    'Inngrepsfri natur i et punkt',
    wmsPunkt(INON, p, {
      layers: 'status',
      query_layers: 'status',
      styles: '',
      info_format: 'application/json',
      feature_count: '5'
    })
  );
}
