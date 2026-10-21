/* Tall som tekst i tvillingen: det samme som hovedsiden (src/ui/tekst.ts), men med hele dekar, som i skissene. Prosent har én
   desimal, som på hovedsiden, og 0 står uten desimal. */
import { nf } from '../src/ui/tekst.ts';

export * from '../src/ui/tekst.ts';
/* Arealet i hele dekar, med «daa» i kolonner og «dekar» i setninger. Under en halv dekar står det «under 1». */
export const dekar = (km2: number, enhet = 'daa') => {
  const v = km2 * 1000;
  return (v > 0 && v < 0.5 ? 'under 1' : nf(v, 0)) + ' ' + enhet;
};
export const iTekst = (km2: number) => dekar(km2, 'dekar');
/* En andel i prosent med én desimal, «< 0,1 %» når den er mindre, og «0 %» når den er null */
export const andelTekst = (p: number) => (p === 0 ? '0 %' : p > 0 && p < 0.1 ? '< 0,1 %' : nf(p) + ' %');
/* Datoen åååå-mm-dd som tekst, som 22. oktober 2026 */
const MANEDER = [
  'januar',
  'februar',
  'mars',
  'april',
  'mai',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'desember'
];
export const datoTekst = (d: string) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(d);
  return m ? `${Number(m[3])}. ${MANEDER[Number(m[2]) - 1]} ${m[1]}` : d;
};
