/* Toppen av tvillingen, som i Figma: navnet med kommunen, «Bytt kommune» og «Hjelp og veileder», og menyen med hovedsidene under. På
   mobil ligger menyen og knappene bak en menyknapp. Over toppen står en smal linje som sier at dette er en prototyp, med lenke
   til samme kommune og tema i dagens løsning (src/ui/tvilling.ts). Logoen fra skissene er ikke med: det står et nøytralt merke i
   stedet, med den samme loddrette streken mot navnet. Er egne områder med i tallene, står det en linje om det under toppen
   (EgneStripe). */
import { memo, useEffect, useRef } from 'react';
import { kommuner, listeFeil } from '../../src/data/motor/kommune.ts';
import { app, endret } from '../../src/data/motor/tilstand.ts';
import { tilHovedsiden } from '../../src/ui/tvilling.ts';
import { MdIconClose, MdIconMenu, MdIconSwapVert, MdPanIcon } from '../md.ts';
import { MENY, byttKommune, figma } from '../navigasjon.ts';
import { Lenke } from './deler.tsx';
import { EgneStripe } from './Egne.tsx';
import './Topp.css';

/* Et nøytralt merke: et blad i en sirkel */
/* Håndikonet på «Hjelp og veileder», som i skissene. Det finnes bare i designsystemets eldre ikonsett, og skriver en advarsel om
   det hver gang det tegnes, så det tegnes bare én gang. */
const Haand = memo(() => <MdPanIcon className="haand" aria-hidden="true" />);
const Merke = () => (
  <svg className="merke-ikon" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M9 23c0-8 5-13 14-14-1 9-6 14-14 14zm0 0 8-8" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/* Velgeren for kommune: én liste med kommunene gruppert per fylke. Nettleserens egen liste, som er lett å bruke på mobil. */
function Kommunevelger() {
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const lukk = () => {
    figma.bytt = false;
    endret();
  };
  return (
    <div className="kommunevelger" role="dialog" aria-label="Bytt kommune">
      <label htmlFor="kommune">Velg kommune</label>
      <div className="kommunevelger-rad">
        <select
          id="kommune"
          ref={ref}
          value={app.valgt ? app.valgt.nr : ''}
          onChange={e => e.target.value && byttKommune(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && lukk()}
        >
          {kommuner().map(f => (
            <optgroup key={f.nr} label={f.navn}>
              {f.kommuner.map(k => (
                <option key={k.nr} value={k.nr}>
                  {k.navn}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button type="button" className="lukk" onClick={lukk} aria-label="Lukk">
          <MdIconClose />
        </button>
      </div>
      <p>Siden du står på, vises for kommunen du velger.</p>
    </div>
  );
}

export default function Topp() {
  const k = app.valgt,
    r = figma.rute,
    feil = listeFeil();
  const veksle = (hva: 'meny' | 'bytt') => {
    figma[hva] = !figma[hva];
    if (hva === 'bytt' && figma.bytt) figma.meny = false;
    endret();
  };
  const knapper = (
    <>
      <button type="button" className="topp-knapp" aria-expanded={figma.bytt} onClick={() => veksle('bytt')}>
        Bytt kommune <MdIconSwapVert aria-hidden="true" />
      </button>
      <Lenke til={{ side: 'hjelp' }} className="topp-knapp" naa={r.side === 'hjelp'}>
        Hjelp og veileder <Haand />
      </Lenke>
    </>
  );
  return (
    <>
      <p className="prototyp">
        Prototyp: utseendet fra Figma, tallene fra åpne kilder.{' '}
        <a href={tilHovedsiden(k ? k.nr : '', r.side + (r.tema ? '/' + r.tema : ''))}>Til dagens løsning</a>
      </p>
      <header className="topp">
        <div className="topp-rad">
          <Lenke til={{ side: 'oversikt' }} className="merke">
            <Merke />
            <span className="merke-skille" aria-hidden="true" />
            <span>Naturregnskap for {feil ? '…' : k ? k.navn : <span className="henter">henter kommuner …</span>}</span>
          </Lenke>
          <div className="topp-knapper">{knapper}</div>
          <button
            type="button"
            className="menyknapp"
            aria-expanded={figma.meny}
            aria-controls="meny"
            aria-label={figma.meny ? 'Lukk menyen' : 'Meny'}
            onClick={() => veksle('meny')}
          >
            {figma.meny ? <MdIconClose /> : <MdIconMenu />}
          </button>
        </div>
        <nav id="meny" className={'meny' + (figma.meny ? ' apen' : '')} aria-label="Hovedmeny">
          <ul>
            {MENY.map(([id, navn]) => (
              <li key={id}>
                <Lenke til={{ side: id }} naa={r.side === id}>
                  {navn}
                </Lenke>
              </li>
            ))}
          </ul>
          <div className="meny-knapper">{knapper}</div>
        </nav>
        {figma.bytt && <Kommunevelger />}
      </header>
      <EgneStripe />
    </>
  );
}
