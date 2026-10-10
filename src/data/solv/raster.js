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

/* Et lerret på 512 x 512 piksler: én flis i planrutenettet, eller én flis i kartet tegnet i dobbel tetthet */
export function flislerret() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  return c;
}

/* Tegner utsnittet (sx, sy, sw, sh) av et bilde over hele lerretet g på 512 x 512. Utsnittet klippes til bildet her, og målet krympes
   tilsvarende. Standarden sier at nettleseren skal gjøre det selv, men Safari har tegnet ingenting når utsnittet stikker utenfor
   bildet, og det gjør det for alle fliser langs kanten av kommunen når kartet er zoomet ut. */
export function tegnUtsnitt(g, bilde, sx, sy, sw, sh) {
  const x0 = Math.max(0, sx),
    y0 = Math.max(0, sy),
    x1 = Math.min(bilde.width, sx + sw),
    y1 = Math.min(bilde.height, sy + sh);
  if (!(x1 > x0 && y1 > y0)) return;
  const fx = 512 / sw,
    fy = 512 / sh;
  g.drawImage(bilde, x0, y0, x1 - x0, y1 - y0, (x0 - sx) * fx, (y0 - sy) * fy, (x1 - x0) * fx, (y1 - y0) * fy);
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
