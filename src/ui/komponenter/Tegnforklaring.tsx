/* Tegnforklaringen i kartet: fargene som vises nå, ut fra hvilke kartlag som er synlige (synligeLag i ui/kart/kart.ts). Gruppert
   med en kort overskrift og fargene ved siden av hverandre, så den tar lite plass. Temaet for siden står øverst, så planlagt
   utbygging, og dagens arealklasser nederst. Den kan lukkes, så den ikke dekker kartet. */
import { useState } from 'react';
import { GRAATRINN } from '../../data/solv/graa.ts';
import { INONSONER } from '../../data/solv/inon.ts';
import { KL, VANN } from '../../data/solv/klasser.ts';
import { synligeLag } from '../kart/kart.ts';
import { skravert } from '../kart/naturtema.ts';

/* En farge i forklaringen: navnet, fargene (som id i farger.ts, flere når den er en skala), og om fargen er et omriss eller skravur */
interface Linje {
  navn: string;
  farger: string[];
  omriss?: boolean;
  skravur?: boolean;
}
/* En gruppe: overskriften (kan mangle) og fargene */
interface Gruppe {
  tittel?: string;
  linjer: Linje[];
}

function grupper(): Gruppe[] {
  const S = synligeLag(),
    ut: Gruppe[] = [],
    enkle: Linje[] = [];
  if (S.inon)
    ut.push({
      tittel: 'Inngrepsfri natur, avstand',
      linjer: INONSONER.map(([, f, , avstand]) => ({ navn: avstand.replace(' fra inngrep', ''), farger: [f] }))
    });
  if (S.graa)
    ut.push({
      tittel: 'Grått areal',
      linjer: [
        { navn: 'lysere er mer vegetasjon', farger: ['graa0', ...GRAATRINN.map(g => g[0])] },
        { navn: 'grønt i bebygd område', farger: ['gront'] }
      ]
    });
  for (const t of S.temaer)
    if (t.klasser)
      ut.push({
        tittel: t.navn,
        linjer: [
          ...t.klasser.map(([navn, f]) => ({ navn: navn.replace(' verdi', '').toLowerCase(), farger: [f] })),
          ...(S.slor ? [{ navn: 'ikke kartlagt', farger: ['slor'] }] : [])
        ]
      });
    else
      enkle.push({
        navn: t.id === 'rein' ? 'Villreinområder' : t.navn,
        farger: [t.id],
        omriss: !skravert(t),
        skravur: skravert(t)
      });
  if (S.egne) enkle.push({ navn: 'Egne områder', farger: ['egne'], omriss: true });
  if (enkle.length) ut.push({ linjer: enkle });
  if (S.plan)
    ut.push({
      tittel: 'Planlagt utbygging',
      linjer: [
        { navn: 'natur', farger: ['pnat'] },
        { navn: 'jordbruk', farger: ['pjor'] }
      ]
    });
  if (S.klasser)
    ut.push({
      tittel: 'Dagens arealklasser',
      linjer: [
        ...KL.map(([id, navn]) => ({ navn: navn.toLowerCase(), farger: [id] })),
        { navn: 'vann', farger: VANN.map(v => v[0]) }
      ]
    });
  return ut;
}

export default function Tegnforklaring() {
  const [apen, settApen] = useState(true),
    G = grupper();
  if (!G.length) return null;
  return (
    <details className="tegnforklaring" open={apen} onToggle={e => settApen(e.currentTarget.open)}>
      <summary>Tegnforklaring</summary>
      {G.map((g, i) => (
        <div key={g.tittel || i}>
          {g.tittel && <b>{g.tittel}</b>}
          <ul>
            {g.linjer.map(l => (
              <li key={l.navn}>
                <span className="ruter" aria-hidden="true">
                  {l.farger.map(f => (
                    <i
                      key={f}
                      className={l.omriss ? 'omriss' : l.skravur ? 'skravur' : undefined}
                      style={{ ['--f' as string]: `var(--${f})` }}
                    />
                  ))}
                </span>
                {l.navn}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  );
}
