/* Bronse for Miljødirektoratets kartlag for inngrepsfrie naturområder (WMS, laget status, nyeste status): ett bilde av hele
   kommunen, uten glatting av kantene, så hver sone har én ren farge. */
import { hent } from './henting.js';

const INON = 'https://kart.miljodirektoratet.no/geoserver/inngrepsfrinatur/wms';
const inonBilde = (u, w, h) =>
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
    width: w,
    height: h,
    format: 'image/png8',
    transparent: 'true',
    format_options: 'antialias:none'
  });
/* Bildet av utsnittet u med w x h ruter for kommunen k, som PNG */
export const hentInonBilde = (k, u, w, h) =>
  hent('Miljødirektoratet', `Inngrepsfri natur i ${k.navn}`, inonBilde(u, w, h), false, true);
