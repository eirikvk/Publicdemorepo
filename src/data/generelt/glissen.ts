/* Generelt: et glissent rutenett. Et stort rutenett på w x h ruter, plassert med første kolonne og rad (cx0, cy0) i et flisnett med
   512 x 512 ruter per flis. Rutene ligger i blokker, én per flis, og bare blokkene som har noe, finnes. Resten har verdien tom.
   Slik tar et rutenett over en stor kommune lite minne når det meste er tomt. Rute nummer i er kolonne i % w og rad i / w, som i et
   vanlig rutenett, så den som bare leser enkeltruter, merker ikke forskjell.
   En blokk kan deles med andre (for eksempel med blokkene som er husket i cachen). Den kopieres før den endres første gang (sett), så
   den andre ser den som før. Filen importerer ingenting. */

/* Ruter langs hver side av en blokk */
export const BLOKK = 512;
/* Et glissent rutenett: plasseringen, verdien i blokker som ikke finnes (tom), blokkene etter nøkkel (blokkNokkel), og nøklene til
   blokkene dette rutenettet eier selv og kan endre */
export interface Glissen {
  cx0: number;
  cy0: number;
  w: number;
  h: number;
  tom: number;
  blokker: Map<number, Uint8Array>;
  egne: Set<number>;
}
/* Nøkkelen til blokken (bx, by) i flisnettet, og blokken fra nøkkelen */
export const blokkNokkel = (bx: number, by: number) => bx * 65536 + by;
export const blokkAv = (k: number): [number, number] => [Math.floor(k / 65536), k % 65536];

/* Et tomt glissent rutenett med samme plassering som G */
export const glissent = (G: { cx0: number; cy0: number; w: number; h: number }, tom = 0): Glissen => ({
  cx0: G.cx0,
  cy0: G.cy0,
  w: G.w,
  h: G.h,
  tom,
  blokker: new Map(),
  egne: new Set()
});
/* En kopi som deler blokkene med L. En blokk kopieres først når den endres. */
export const kopiAv = (L: Glissen): Glissen => ({ ...L, blokker: new Map(L.blokker), egne: new Set() });
/* Legger inn blokken b for (bx, by), delt: den kopieres før den endres */
export const leggInnDelt = (L: Glissen, bx: number, by: number, b: Uint8Array) => {
  L.blokker.set(blokkNokkel(bx, by), b);
};

/* Nummeret på ruta i kolonne X og rad Y i flisnettet, eller -1 utenfor rutenettet */
export function nummer(L: Glissen, X: number, Y: number) {
  const x = X - L.cx0,
    y = Y - L.cy0;
  return x < 0 || y < 0 || x >= L.w || y >= L.h ? -1 : y * L.w + x;
}
/* Verdien i ruta i, som i et vanlig rutenett: undefined når i er utenfor (mindre enn 0, eller w x h og mer). Den kalles svært ofte, så
   blokken og plassen i den regnes med heltall og skift (BLOKK er 512 = 2⁹, og plasseringen i flisnettet er aldri negativ). */
export function verdi(L: Glissen, i: number): number | undefined {
  if (i < 0 || i >= L.w * L.h) return undefined;
  const y = (i / L.w) | 0,
    X = L.cx0 + i - y * L.w,
    Y = L.cy0 + y,
    b = L.blokker.get((X >> 9) * 65536 + (Y >> 9));
  return b ? b[((Y & 511) << 9) + (X & 511)] : L.tom;
}
/* Verdiene i rutene celler (i stigende rekkefølge, som utbyggingens rader), som en tallrekke i samme rekkefølge. Blokken huskes
   mellom rutene som ligger i den samme, så dette går mye fortere enn verdi for hver rute. Ruter utenfor får verdien tom. */
export function verdier(L: Glissen, celler: ArrayLike<number>): Uint8Array {
  const ut = new Uint8Array(celler.length),
    n = L.w * L.h;
  let nokkel = -1,
    b: Uint8Array | undefined;
  for (let k = 0; k < celler.length; k++) {
    const i = celler[k];
    if (i < 0 || i >= n) {
      ut[k] = L.tom;
      continue;
    }
    const y = (i / L.w) | 0,
      X = L.cx0 + i - y * L.w,
      Y = L.cy0 + y,
      kb = (X >> 9) * 65536 + (Y >> 9);
    if (kb !== nokkel) {
      nokkel = kb;
      b = L.blokker.get(kb);
    }
    ut[k] = b ? b[((Y & 511) << 9) + (X & 511)] : L.tom;
  }
  return ut;
}
/* Setter verdien v i ruta i, som må være innenfor. Blokken lages, eller kopieres hvis den er delt. */
export function sett(L: Glissen, i: number, v: number) {
  const X = L.cx0 + (i % L.w),
    Y = L.cy0 + Math.floor(i / L.w),
    k = blokkNokkel(Math.floor(X / BLOKK), Math.floor(Y / BLOKK));
  let b = L.blokker.get(k);
  if (!b || !L.egne.has(k)) {
    const ny = b ? b.slice() : new Uint8Array(BLOKK * BLOKK).fill(L.tom);
    L.blokker.set(k, (b = ny));
    L.egne.add(k);
  }
  b[(Y % BLOKK) * BLOKK + (X % BLOKK)] = v;
}
/* Rutene i blokkene som finnes, der f(verdien) gir true, som nummeret på ruta, i stigende rekkefølge som i et vanlig rutenett */
export function finn(L: Glissen, f: (v: number) => boolean): number[] {
  const ut: number[] = [];
  for (const [k, b] of L.blokker) {
    const [bx, by] = blokkAv(k);
    for (let q = 0; q < b.length; q++)
      if (f(b[q])) {
        const i = nummer(L, bx * BLOKK + (q % BLOKK), by * BLOKK + Math.floor(q / BLOKK));
        if (i >= 0) ut.push(i);
      }
  }
  return ut.sort((a, b) => a - b);
}
