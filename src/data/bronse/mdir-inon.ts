/* Bronse for Miljødirektoratets kartlag for inngrepsfrie naturområder (WMS, laget status, nyeste status): ett bilde av hele
   kommunen, uten glatting av kantene, så hver sone har én ren farge. */
import type { Utsnitt } from '../generelt/geometri.ts';
import type { Kommune } from '../solv/felles.ts';
import { INON } from './endepunkter.ts';
import { hent } from './henting.ts';
import { kommunen } from './kartverket.ts';
import { bildenett } from '../solv/kommune.ts';
import { wmsBilde, wmsPunkt } from './wms.ts';

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

/* Tabellen bronse.inonbilde: bildet av sonene over hele kommunen, som PNG, i rutenettet bildet tolkes i */
export async function inonbilde(nr: string): Promise<ArrayBuffer> {
  const R = await bildenett(nr);
  return hentInonBilde(await kommunen(nr), R.u, R.w, R.h);
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
