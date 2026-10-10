/* Innholdet: én side for hvert valg i sidevelgeren. Alle sidene ligger i siden hele tiden, men bare den valgte vises. Da beholder
   hver side det som er åpnet i den, og «Til listen» fra kartet finner området uansett hvilken side som var valgt. */
import { NATURTEMA } from '../../data/motor/naturtema.js';
import { SIDER } from '../sider.js';
import { ui } from '../tilstand.js';
import Oversikt from './Oversikt.jsx';
import Regnskap from './Regnskap.jsx';
import { Graa, Inon, Naturtema } from './Temaer.jsx';
import Framtid from './Framtid.jsx';
import Om from './Om.jsx';
import './Innhold.css';

function Side({ id, teknisk, settTeknisk }) {
  if (id === 'oversikt') return <Oversikt />;
  if (id === 'regnskap') return <Regnskap />;
  if (id === 'graa') return <Graa />;
  if (id === 'inon') return <Inon />;
  if (id === 'framtid') return <Framtid />;
  if (id === 'om') return <Om teknisk={teknisk} settTeknisk={settTeknisk} />;
  return <Naturtema t={NATURTEMA.find(t => t.id === id)} />;
}

/* Hver side kan få fokus (tabIndex -1), så en lenke fra en annen side kan flytte fokus hit. */
export default function Innhold({ teknisk, settTeknisk }) {
  return (
    <div className="innhold">
      {SIDER.map(([id, navn]) => (
        <section
          key={id}
          id={'side-' + id}
          className="sideinnhold"
          aria-label={navn}
          tabIndex={-1}
          hidden={ui.side !== id}
        >
          <Side id={id} teknisk={teknisk} settTeknisk={settTeknisk} />
        </section>
      ))}
    </div>
  );
}
