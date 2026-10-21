/* Flatene for verneområdene i en kommune, tegnet som SVG i UTM 33 (meter, nord opp). Ingen bakgrunnskart, bare flatene, med
   navnet når man holder over en flate. Fargen er den samme som verneområdene har i kartet på hovedsiden (FARGER.vern). Punkter
   som ligger nærmere hverandre enn rundt en tusendel av bildet, tegnes ikke, så store flater ikke gjør siden treg. */
import { FARGER } from '../src/ui/farger.ts';
import type { Flate } from './parquet.ts';

/* Ringene i en flate, ytre og indre */
const ringer = (f: Flate): number[][][] =>
  f.type === 'Polygon' ? (f.coordinates as number[][][]) : (f.coordinates as number[][][][]).flat();

export function Flatene({ F, navn, tittel }: { F: Flate[]; navn: Map<number, string>; tittel: string }) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const f of F)
    for (const r of ringer(f))
      for (const [x, y] of r) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (!isFinite(x0)) return null;
  const s = Math.max(x1 - x0, y1 - y0, 100),
    luft = s * 0.03,
    tol = s / 1000;
  /* Stien for en flate: hver ring som M … Z, med y snudd så nord er opp */
  const sti = (f: Flate) =>
    ringer(f)
      .map(r => {
        const P: number[][] = [];
        r.forEach((p, i) => {
          const q = P[P.length - 1];
          if (!q || i === r.length - 1 || Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) >= tol) P.push(p);
        });
        return 'M' + P.map(([x, y]) => `${Math.round(x)} ${Math.round(-y)}`).join('L') + 'Z';
      })
      .join('');
  return (
    <svg
      className="flatene"
      viewBox={`${x0 - luft} ${-y1 - luft} ${x1 - x0 + 2 * luft} ${y1 - y0 + 2 * luft}`}
      role="img"
      aria-label={tittel}
    >
      {F.map(f => (
        <path key={f.rad} d={sti(f)} fill={FARGER.vern} stroke={FARGER.vern}>
          <title>{navn.get(f.rad) || ''}</title>
        </path>
      ))}
    </svg>
  );
}
