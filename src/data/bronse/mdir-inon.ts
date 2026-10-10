/* Bronse for Miljødirektoratets kartlag for inngrepsfrie naturområder (WMS, laget status, nyeste status): ett bilde av hele
   kommunen, uten glatting av kantene, så hver sone har én ren farge. */
import type { Kommune, Utsnitt } from '../solv/felles.ts';
import { hent } from './henting.ts';

const INON = 'https://kart.miljodirektoratet.no/geoserver/inngrepsfrinatur/wms';
const inonBilde = (u: Utsnitt, w: number, h: number) =>
  INON +
  '?' +
  new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: 'status',
    styles: '',
    crs: 'EPSG:25833',
    bbox: u.map(v => v.toFixed(2)).join(','),
    width: String(w),
    height: String(h),
    format: 'image/png8',
    transparent: 'true',
    format_options: 'antialias:none'
  });
/* Bildet av utsnittet u med w x h ruter for kommunen k, som PNG */
export const hentInonBilde = (k: Kommune, u: Utsnitt, w: number, h: number) =>
  hent('Miljødirektoratet', `Inngrepsfri natur i ${k.navn}`, inonBilde(u, w, h), false, true);
