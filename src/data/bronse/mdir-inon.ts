/* Bronse for Miljødirektoratets kartlag for inngrepsfrie naturområder (WMS, laget status, nyeste status): ett bilde av hele
   kommunen, uten glatting av kantene, så hver sone har én ren farge. */
import type { Utsnitt } from '../generelt/geometri.ts';
import type { Kommune } from '../solv/felles.ts';
import { hent } from './henting.ts';
import { wmsBilde } from './wms.ts';

const INON = 'https://kart.miljodirektoratet.no/geoserver/inngrepsfrinatur/wms';
const inonBilde = (u: Utsnitt, w: number, h: number) =>
  wmsBilde(INON, u, w, h, {
    layers: 'status',
    styles: '',
    format: 'image/png8',
    transparent: 'true',
    format_options: 'antialias:none'
  });
/* Bildet av utsnittet u med w x h ruter for kommunen k, som PNG */
export const hentInonBilde = (k: Kommune, u: Utsnitt, w: number, h: number) =>
  hent('Miljødirektoratet', `Inngrepsfri natur i ${k.navn}`, inonBilde(u, w, h), false, true);
