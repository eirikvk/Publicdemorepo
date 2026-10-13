/* Overskriften på et kort med tall, med en infoknapp som forklarer tallene. Panelet åpnes rett under overskriften og har tre lag:
   kort fortalt, regnestykket for valgt kommune (tallene fra gull satt inn i tekst), og stegene fra kilde til tall med usikkerheten
   og lenker til metoden og koden. I stegene står hver kilde sammen med det den justeres til i sølv: «hentes fra … og justeres
   til …» (infostegFor). Innholdet står i src/ui/forklaringer.ts og i katalogen, så det samme står i METODE.md. */
import { useId, useState, type ReactNode } from 'react';
import { valgtNr, verdi } from '../../data/motor/valgt.ts';
import { app } from '../../data/motor/tilstand.ts';
import { ankerFor, infostegFor, kortet, REPO, usikkerhetFor, type Steg } from '../forklaringer.ts';
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

/* Forklaringen på et steg. En kilde i bronse sier hvor den hentes fra: endepunktet, eller bare «Hentes» når den har eier uten
   endepunkt. */
const Hentes = ({ t: { tabell: t } }: { t: Steg }) => (
  <>
    {t.endepunkt ? (
      <>
        Hentes fra <code>{t.endepunkt}</code>:{' '}
      </>
    ) : t.kilde ? (
      'Hentes: '
    ) : (
      ''
    )}
    {t.forklaring}
  </>
);
/* Kilden til et steg i bronse, med lenke til datasettet og lisensen */
const Kilde = ({ t: { tabell: t } }: { t: Steg }) =>
  t.kilde ? (
    <>
      {' '}
      Kilde:{' '}
      <a href={t.kilde.adresse}>
        {t.kilde.navn}, {t.kilde.datasett}
      </a>
      , {t.kilde.lisens}.
    </>
  ) : null;

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
          {infostegFor(k).map(i =>
            'kilde' in i ? (
              <li key={i.kilde.navn}>
                <b>{i.kilde.tabell.tittel}.</b> <Hentes t={i.kilde} />
                <Kilde t={i.kilde} />
                {i.justeres.map(j => (
                  <span key={j.navn} className="justeres">
                    Justeres: {j.tabell.forklaring}
                  </span>
                ))}
                <span className="koder">
                  {[i.kilde, ...i.justeres].map(j => (
                    <code key={j.navn}>{j.navn}</code>
                  ))}
                </span>
              </li>
            ) : (
              <li key={i.steg.navn}>
                <b>{i.steg.tabell.tittel}.</b>{' '}
                {i.steg.se ? (
                  <>
                    Forklart under <Sidelenke id={i.steg.se.side}>{i.steg.se.tittel}</Sidelenke>.
                  </>
                ) : (
                  <Hentes t={i.steg} />
                )}
                {!i.steg.se && <Kilde t={i.steg} />} <code>{i.steg.navn}</code>
              </li>
            )
          )}
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
