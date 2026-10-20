/* Generelt: regning med tall som ikke handler om noe bestemt. */

/* Summen av tallene, lagt sammen fra første til siste */
export const summen = (tall: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < tall.length; i++) s += tall[i];
  return s;
};

/* Et areal i km² avrundet til nærmeste 10 dekar (0,01 km²), som SSBs tall */
export const tiDekar = (km2: number) => Math.round(km2 * 100) / 100;
