/* Sidevelgeren: én knapp per side, i designsystemets chip-form. Den valgte siden bestemmer innholdet ved siden av kartet og hvilket
   tema kartet viser. Sidene står i blokker, og en blokk med gruppenavn, som «Naturen i kommunen», har navnet over knappene. */
import { app } from '../../data/motor/felles.js';
import { BLOKKER, velgSide } from '../../data/motor/handlinger.js';
import './Sidevelger.css';

export default function Sidevelger() {
  return (
    <nav className="sidevelger" aria-label="Sider">
      {BLOKKER.map(({ gruppe, sider }, b) => (
        <div
          key={b}
          className="sideblokk"
          role={gruppe ? 'group' : undefined}
          aria-labelledby={gruppe ? `blokk-${b}` : undefined}
        >
          {gruppe && (
            <span className="md-typography-label-s" id={`blokk-${b}`}>
              {gruppe}
            </span>
          )}
          <ul>
            {sider.map(([id, navn]) => {
              const valgt = app.side === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={'md-chip' + (valgt ? ' md-chip--active' : '')}
                    aria-current={valgt ? 'page' : undefined}
                    data-side={id}
                    onClick={() => velgSide(id)}
                  >
                    {navn}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
