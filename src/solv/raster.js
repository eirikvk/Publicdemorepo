/* Sølv, felles standard: fra flater til ruter. Flatene tegnes i et lerret (canvas) i nettleseren, og dekningen leses per rute som
   alfa fra 0 til 255. Lerretet glatter kantene, så en rute i kanten av en flate får delvis dekning. Dette er den eneste filen i
   sølv og gull som bruker nettleseren. Skal beregningene kjøres et annet sted, er det denne som må byttes ut. */

/* Et lerret på w x h ruter, klart til å tegne i og lese fra */
export function tegneflate(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d', { willReadFrequently: true });
}

/* En flerflate som sti i lerretet g. u er utsnittet lerretet viser, og s er ruter per meter. Fylles med g.fill('evenodd'), så hull
   blir hull. */
export function sti(g, koord, u, s) {
  g.beginPath();
  for (const flate of koord)
    for (const ring of flate) {
      ring.forEach(([x, y], i) =>
        i ? g.lineTo((x - u[0]) * s, (u[3] - y) * s) : g.moveTo((x - u[0]) * s, (u[3] - y) * s)
      );
      g.closePath();
    }
}
