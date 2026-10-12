/* En tabell med sider, som listene i Figma: ti rader per side og sidetall under. Kolonner merket tall står til høyre, og kolonner
   merket ikkeMobil vises ikke på smale skjermer, så tabellen får plass uten å rulle. */
import { useState, type ReactNode } from 'react';
import { MdIconChevronBackward, MdIconChevronForward } from '../md.ts';

export interface Kolonne {
  navn: string;
  tall?: boolean;
  ikkeMobil?: boolean;
}
const klasse = (k: Kolonne) => [k.tall && 'tall', k.ikkeMobil && 'ikke-mobil'].filter(Boolean).join(' ') || undefined;
export default function Tabell({
  kolonner,
  rader,
  hva,
  perSide = 10
}: {
  kolonner: Kolonne[];
  rader: ReactNode[][];
  hva: string;
  perSide?: number;
}) {
  const [side, settSide] = useState(0),
    sider = Math.max(1, Math.ceil(rader.length / perSide)),
    s = Math.min(side, sider - 1),
    vis = rader.slice(s * perSide, (s + 1) * perSide);
  return (
    <div className="tabell">
      <div className="tabell-rull">
        <table>
          <caption className="skjult">{hva}</caption>
          <thead>
            <tr>
              {kolonner.map(k => (
                <th key={k.navn} scope="col" className={klasse(k)}>
                  {k.navn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vis.map((r, i) => (
              <tr key={s * perSide + i}>
                {r.map((c, j) => (
                  <td key={j} className={klasse(kolonner[j])}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sider > 1 && (
        <nav className="sidetall" aria-label={`Sider i ${hva.toLowerCase()}`}>
          <button type="button" disabled={s === 0} onClick={() => settSide(s - 1)} aria-label="Forrige side">
            <MdIconChevronBackward />
          </button>
          {Array.from({ length: sider }, (_, i) => i)
            .filter(i => Math.abs(i - s) <= 2 || i === 0 || i === sider - 1)
            .map((i, j, a) => (
              <span key={i}>
                {j > 0 && i - a[j - 1] > 1 && <span className="prikker">…</span>}
                <button
                  type="button"
                  aria-current={i === s ? 'page' : undefined}
                  onClick={() => settSide(i)}
                  aria-label={`Side ${i + 1}`}
                >
                  {i + 1}
                </button>
              </span>
            ))}
          <button type="button" disabled={s === sider - 1} onClick={() => settSide(s + 1)} aria-label="Neste side">
            <MdIconChevronForward />
          </button>
        </nav>
      )}
    </div>
  );
}
