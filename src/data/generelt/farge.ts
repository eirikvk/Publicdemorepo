/* Generelt: farger som [rød, grønn, blå], fra 0 til 255. */

/* Hvilken av fargene som ligger nærmest fargen (r, g, b): plassen i listen. Ved likt avstand vinner den første. */
export const naermesteFarge = (r: number, g: number, b: number, farger: ArrayLike<number>[]) => {
  let best = 0,
    min = Infinity;
  for (let i = 0; i < farger.length; i++) {
    const f = farger[i],
      d = (r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2;
    if (d < min) {
      min = d;
      best = i;
    }
  }
  return best;
};
