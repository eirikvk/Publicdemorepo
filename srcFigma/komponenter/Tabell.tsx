/* En tabell med sider, som listene i Figma: ti rader per side og designsystemets sidevelger under. Kolonner merket tall står til
   høyre, og kolonner merket ikkeMobil vises ikke på smale skjermer, så tabellen får plass uten å rulle. */
import { useState, type ReactNode } from 'react';
import { MdPagination } from '../md.ts';

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
        <div className="sidetall">
          <MdPagination
            totalPages={sider}
            currentPage={s + 1}
            onPageChange={p => settSide(p - 1)}
            labels={{ previous: 'Forrige', next: 'Neste' }}
          />
        </div>
      )}
    </div>
  );
}
