/* Gull, felles: små hjelpere som flere av svarene bruker. */

/* Andelen del er av av, i prosent. null når det ikke er noe å regne andelen av. */
export const andel = (del, av) => (av > 0 ? (del / av) * 100 : null);

/* Tilstanden for et tema som hentes som ett bilde av kommunen (inngrepsfri natur og grått areal): henter, feil, ingen eller ok */
export const bildeStatus = D =>
  !D || D.tilstand === 'henter' ? 'henter' : D.tilstand !== 'ok' ? 'feil' : D.sum > 0 ? 'ok' : 'ingen';
