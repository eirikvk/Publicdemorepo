/* Bronse for Miljødirektoratets kartlag for inngrepsfrie naturområder (WMS): bildene av bitene for et år, uten glatting av kantene,
   så hver sone har én ren farge. Laget status er nyeste år (INON_NYESTE), og status_1988, status_2008 og så videre de tidligere
   årene (INONAAR), med de samme fargene. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { BIT, flisUtsnitt, flisnavn, type Flis } from '../solv/felles.ts';
import { INONAAR, INON_NYESTE } from '../solv/tolking.ts';
import { INON } from './endepunkter.ts';
import { hent } from './henting.ts';
import { wmsBilde, wmsPunkt } from './wms.ts';

/* Laget i karttjenesten for året aar */
function inonlag(aar: number) {
  if (!INONAAR.includes(aar)) throw new Error(`Miljødirektoratet har ikke status for inngrepsfri natur for ${aar}`);
  return aar === INON_NYESTE ? 'status' : `status_${aar}`;
}
const inonBilde = (aar: number, u: Utsnitt, w: number, h: number) =>
  wmsBilde(INON, u, w, h, {
    layers: inonlag(aar),
    styles: '',
    format: 'image/png8',
    transparent: 'true',
    format_options: 'antialias:none'
  });
/* Tabellen bronse.inonbit: bildet av sonene for året aar i biten tc (en flis på nivå 8, solv/felles.ts) med 2048 x 2048 ruter à
   10,6 meter, som PNG. Kalles med [aar, tc]. */
export async function inonbit([aar, tc]: [number, Flis]): Promise<ArrayBuffer> {
  return hent(
    'Miljødirektoratet',
    `Inngrepsfri natur ${aar}, bit ${flisnavn(tc)}`,
    inonBilde(aar, flisUtsnitt(tc), BIT, BIT),
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
