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
/* Spørringen etter et kartbilde av utsnittet u på w x h piksler */
export const wmsSkjema = (u: Utsnitt, w: number, h: number, valg: Record<string, string>, desimaler = 2) =>
  new URLSearchParams({ ...felles(u, w, h, desimaler), request: 'GetMap', ...valg });
/* Adressen til et kartbilde av utsnittet u på w x h piksler fra tjenesten på adresse. Er spørringen for lang til å stå i adressen
   (en lang stil), sendes wmsSkjema som POST i stedet. */
export const wmsBilde = (
  adresse: string,
  u: Utsnitt,
  w: number,
  h: number,
  valg: Record<string, string>,
  desimaler = 2
) => adresse + '?' + wmsSkjema(u, w, h, valg, desimaler);
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
/* Adressen til et oppslag i punktet p [øst, nord] i UTM33: et bilde på 3 x 3 piksler à én meter med punktet i midten */
export const wmsPunkt = (adresse: string, p: number[], valg: Record<string, string>) =>
  wmsOppslag(adresse, [p[0] - 1.5, p[1] - 1.5, p[0] + 1.5, p[1] + 1.5], 3, 3, 1, 1, valg, 1);
