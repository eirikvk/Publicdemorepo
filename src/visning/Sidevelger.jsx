/* Sidevelgeren: én knapp per side. Den valgte siden bestemmer innholdet ved siden av kartet og hvilket tema kartet viser. Piltastene
   flytter mellom knappene, som i designsystemets faner. */
import { app } from '../motor/felles.js';
import { SIDER, velgSide } from '../motor/handlinger.js';
import { Rute } from './deler.jsx';
import './Sidevelger.css';

/* Sidene med et eget kartlag får lagets fargerute i knappen */
const RUTE = { graa: 'graa', rein: 'rein', inon: 'inon', verdi: 'verdi', vern: 'vern', framtid: 'plan' };

function piltast(e, i) {
  const n = SIDER.length,
    ny = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
  if (ny === undefined) return;
  e.preventDefault();
  const id = SIDER[(ny + n) % n][0];
  velgSide(id);
  document.getElementById('fane-' + id)?.focus();
}

export default function Sidevelger() {
  return (
    <nav className="sidevelger md-tabs-container" aria-label="Sider">
      <ul className="md-tabs-list" role="tablist">
        {SIDER.map(([id, navn], i) => {
          const valgt = app.side === id;
          return (
            <li key={id} role="presentation">
              <button
                type="button"
                role="tab"
                id={'fane-' + id}
                className="md-chip"
                aria-selected={valgt}
                aria-controls={'side-' + id}
                tabIndex={valgt ? 0 : -1}
                data-side={id}
                onClick={() => velgSide(id)}
                onKeyDown={e => piltast(e, i)}
              >
                {RUTE[id] && <Rute id={RUTE[id]} />}
                {navn}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
