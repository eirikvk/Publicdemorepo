/* Bronse, felles for kildene som er kartjenester etter standarden WMS 1.3.0: adressen til et kartbilde (GetMap) eller et oppslag i ett
   punkt i bildet (GetFeatureInfo), for et utsnitt i UTM33. Det som er likt for alle tjenestene, står her. Hver kilde gir resten
   (lag, stil, format og lignende) i valg, med navnene fra standarden. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { UTM } from '../solv/felles.ts';

/* Det som er likt i alle spørringene: utsnittet u med w x h piksler. desimaler er hvor nøyaktig utsnittet sendes. */
const felles = (u: Utsnitt, w: number, h: number, desimaler: number) => ({
  service: 'WMS',
  version: '1.3.0',
  crs: UTM,
  bbox: u.map(v => v.toFixed(desimaler)).join(','),
  width: String(w),
  height: String(h)
});
/* Adressen til et kartbilde av utsnittet u på w x h piksler fra tjenesten på adresse */
export const wmsBilde = (
  adresse: string,
  u: Utsnitt,
  w: number,
  h: number,
  valg: Record<string, string>,
  desimaler = 2
) => adresse + '?' + new URLSearchParams({ ...felles(u, w, h, desimaler), request: 'GetMap', ...valg });
/* Adressen til et oppslag i pikselen (i, j) i det samme bildet */
export const wmsOppslag = (
  adresse: string,
  u: Utsnitt,
  w: number,
  h: number,
  i: number,
  j: number,
  valg: Record<string, string>,
  desimaler = 2
) =>
  adresse +
  '?' +
  new URLSearchParams({
    ...felles(u, w, h, desimaler),
    request: 'GetFeatureInfo',
    i: String(i),
    j: String(j),
    ...valg
  });
