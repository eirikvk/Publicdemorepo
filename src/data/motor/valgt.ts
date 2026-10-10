/* Det visningen leser for valgt kommune: raden i en tabell i katalogen, med status og verdi. Siden og kartet spør katalogen med
   nummeret til valgt kommune, så ingenting fra en annen kommune kan vises. Mangler noe, hentes det gjennom katalogen. */
import { les, type Rad, type Tabell } from '../cache.ts';
import type { Bildetall } from '../gull/felles.ts';
import { app } from './tilstand.ts';

/* Nummeret til valgt kommune, eller null */
export const valgtNr = () => (app.valgt ? app.valgt.nr : null);
/* Raden i tabellen t for valgt kommune: status (henter, feil eller ok) og verdi. Er den utdatert, gis den gamle verdien til den
   nye er regnet ut. null uten valgt kommune. */
export function valgt<V>(t: Tabell<string, V>): Rad<V> | null {
  const nr = valgtNr();
  return nr ? les(t, nr) : null;
}
/* Verdien i tabellen t for valgt kommune når den er ferdig, ellers null */
export function verdi<V>(t: Tabell<string, V>): V | null {
  const r = valgt(t);
  return r && r.status === 'ok' ? (r.verdi as V) : null;
}
/* Det en temaside viser fra en rad i gull: henter eller feil fra raden, ellers svaret (ok eller ingen) */
export function bildetallet<T>(r: Rad<Bildetall<T>> | null): Bildetall<T> {
  if (!r || r.status === 'henter') return { tilstand: 'henter' };
  if (r.status === 'feil') return { tilstand: 'feil' };
  return r.verdi as Bildetall<T>;
}
