/* Detaljene for punktet man trykket på i kartet, under setningen under kartet: én gruppe per kartlag eller område, med radene som
   navn og verdi, kilden, lenker og «Vis i kartet» for områdene i naturtemaene. Innholdet lages i kart/punktinfo.ts. Detaljene slås
   på og av med knappen ved setningen, og valget gjelder så lenge siden er åpen. */
import { useState } from 'react';
import { endret } from '../../data/motor/tilstand.ts';
import { visIKartet } from '../kart/naturtema.ts';
import { ui, type Punktinfo } from '../tilstand.ts';
import { MdButton, MdIconLocation, MdIconOpenInNew } from './md.ts';
import './Punktdetaljer.css';

/* Knappen som slår detaljene på og av. panel er id-en til detaljene. */
export function Detaljknapp({ panel }: { panel: string }) {
  return (
    <MdButton
      theme="tertiary"
      mode="small"
      aria-expanded={ui.detaljer}
      aria-controls={panel}
      onClick={() => {
        ui.detaljer = !ui.detaljer;
        endret();
      }}
    >
      {ui.detaljer ? 'Skjul detaljer' : 'Detaljer'}
    </MdButton>
  );
}

/* En verdi: adresser som lenke, ellers tekst */
const Verdi = ({ v }: { v: string }) =>
  /^https?:\/\//.test(v) ? (
    <a href={v} target="_blank" rel="noopener">
      Åpne
    </a>
  ) : (
    <>{v}</>
  );

export default function Punktdetaljer({ P, id }: { P: Punktinfo; id: string }) {
  const [kopiert, settKopiert] = useState(false);
  const kopier = (tekst: string) =>
    navigator.clipboard
      .writeText(tekst)
      .then(() => {
        settKopiert(true);
        setTimeout(() => settKopiert(false), 2000);
      })
      .catch(() => {});
  return (
    <div className="punktdetaljer" id={id} role="region" aria-label="Detaljer for punktet">
      {P.lag.map((L, i) => (
        <section key={i} className="punktlag">
          <h3>
            {L.tittel}
            {L.kilde && <small>{L.kilde}</small>}
          </h3>
          <dl>
            {L.rader.map(([navn, v], j) => (
              <div key={j}>
                <dt>{navn}</dt>
                <dd>
                  <Verdi v={v} />
                </dd>
              </div>
            ))}
          </dl>
          {(L.lenke || L.omrade || L.tittel === 'Punktet') && (
            <div className="knapper">
              {L.omrade && (
                <MdButton
                  theme="tertiary"
                  mode="small"
                  leftIcon={<MdIconLocation />}
                  aria-label={`Vis ${L.tittel} i kartet`}
                  onClick={() => visIKartet(L.omrade!.tema, L.omrade!.nr, `${L.omrade!.tema}-omr-${L.omrade!.nr}`)}
                >
                  Vis i kartet
                </MdButton>
              )}
              {L.lenke && (
                <MdButton
                  asChild
                  asChildContent={<a href={L.lenke.url} target="_blank" rel="noopener" />}
                  theme="tertiary"
                  mode="small"
                  rightIcon={<MdIconOpenInNew />}
                  title="Åpnes i ny fane"
                >
                  {L.lenke.tekst}
                </MdButton>
              )}
              {L.tittel === 'Punktet' && navigator.clipboard && (
                <MdButton
                  theme="tertiary"
                  mode="small"
                  onClick={() =>
                    kopier(
                      L.rader
                        .slice(-2)
                        .map(r => r[1])
                        .join('; ')
                    )
                  }
                >
                  {kopiert ? 'Kopiert' : 'Kopier koordinatene'}
                </MdButton>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
