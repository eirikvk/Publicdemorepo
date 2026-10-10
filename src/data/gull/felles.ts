/* Gull, felles: små hjelpere som flere av svarene bruker. */

/* Andelen del er av av, i prosent. null når det ikke er noe å regne andelen av. */
export const andel = (del: number, av: number): number | null => (av > 0 ? (del / av) * 100 : null);

/* Hvor langt et tema som hentes som ett bilde av kommunen er kommet, og arealet når det er hentet */
export interface Bildetema {
  nr: string;
  tilstand: 'henter' | 'feil' | 'ok';
  sum?: number;
}
export type Bildestatus = 'henter' | 'feil' | 'ok' | 'ingen';

/* Tilstanden for et tema som hentes som ett bilde av kommunen (inngrepsfri natur og grått areal): henter, feil, ingen eller ok */
export const bildeStatus = (D: Bildetema | null): Bildestatus =>
  !D || D.tilstand === 'henter' ? 'henter' : D.tilstand !== 'ok' ? 'feil' : D.sum! > 0 ? 'ok' : 'ingen';
