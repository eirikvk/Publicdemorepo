/* Overskriften på et kort med tall, med en infoknapp som forklarer tallene. Panelet åpnes rett under overskriften og har tre lag:
   kort fortalt, regnestykket for valgt kommune (tallene fra gull satt inn i tekst), og stegene fra kilde til tall med usikkerheten
   og lenker til metoden og koden. Innholdet står i src/ui/forklaringer.ts og i katalogen, så det samme står i METODE.md. */
import { useId, useState, type ReactNode } from 'react';
import { valgtNr, verdi } from '../../data/motor/valgt.ts';
import { app } from '../../data/motor/tilstand.ts';
import { ankerFor, kortet, REPO, stegFor, usikkerhetFor } from '../forklaringer.ts';
import { Sidelenke } from './deler.tsx';
import { MdHelpButton, MdHelpText } from './md.ts';
import './Tallforklaring.css';

/* Overskriften (h2 med id-en) for kortet med id-en kort, og panelet med forklaringen når knappen er trykket */
export function Korttittel({ kort, id, children }: { kort: string; id: string; children?: ReactNode }) {
  const k = kortet(kort),
    [apen, settApen] = useState(false),
    panel = useId();
  return (
    <>
      <div className="korttittel">
        <h2 className="md-typography-heading-s" id={id}>
          {children || k.tittel}
        </h2>
        <MdHelpButton
          expanded={apen}
          labels={{ helpText: `Om tallene: ${k.tittel}` }}
          aria-pressed={undefined}
          aria-expanded={apen}
          aria-controls={panel}
          onClick={() => settApen(!apen)}
        />
      </div>
      {apen && (
        <MdHelpText id={panel} role="region" aria-label={`Om tallene: ${k.tittel}`} className="tallforklaring">
          <Innhold kort={kort} />
        </MdHelpText>
      )}
    </>
  );
}

/* Innholdet i panelet. Regnestykket leser tabellene i gull for valgt kommune, og vises når de er klare. */
function Innhold({ kort }: { kort: string }) {
  const k = kortet(kort),
    linjer = valgtNr() ? k.regnestykke(verdi) : null,
    U = usikkerhetFor(k);
  return (
    <>
      <p>{k.kortFortalt}</p>
      {linjer && (
        <>
          <h3>Slik er tallene regnet ut for {app.valgt!.navn}</h3>
          <ul className="regnestykke">
            {linjer.map(l => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}
      <details>
        <summary>Fra kilde til tall</summary>
        <ol>
          {stegFor(k).map(({ navn, tabell: t, se }) => (
            <li key={navn}>
              <b>{t.tittel}.</b>{' '}
              {se ? (
                <>
                  Forklart under <Sidelenke id={se.side}>{se.tittel}</Sidelenke>.
                </>
              ) : (
                t.forklaring
              )}
              {!se && t.kilde && (
                <>
                  {' '}
                  Kilde:{' '}
                  <a href={t.kilde.adresse}>
                    {t.kilde.navn}, {t.kilde.datasett}
                  </a>
                  , {t.kilde.lisens}.
                </>
              )}{' '}
              <code>{navn}</code>
            </li>
          ))}
        </ol>
      </details>
      {U.length > 0 && (
        <details>
          <summary>Usikkerhet</summary>
          <ul>
            {U.map(u => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="lenker">
        <a href={REPO + 'METODE.md#' + ankerFor(k)}>Metoden</a>
        <a href={REPO + k.komponent}>Koden for kortet</a>
      </p>
    </>
  );
}
