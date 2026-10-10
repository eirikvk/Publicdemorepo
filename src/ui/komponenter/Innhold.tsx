/* Innholdet: én side for hvert valg i sidevelgeren. Alle sidene ligger i siden hele tiden, men bare den valgte vises. Da beholder
   hver side det som er åpnet i den, og «Til listen» fra kartet finner området uansett hvilken side som var valgt. */
import { NATURTEMA } from '../../data/motor/naturtema.ts';
import { SIDER } from '../sider.ts';
import { ui } from '../tilstand.ts';
import Oversikt from './Oversikt.tsx';
import Regnskap from './Regnskap.tsx';
import Graa from './Graa.tsx';
import Inon from './Inon.tsx';
import { Naturtema } from './Naturtema.tsx';
import Framtid from './Framtid.tsx';
import Om, { type Tekniskvalg } from './Om.tsx';
import './Innhold.css';

function Side({ id, teknisk, settTeknisk }: { id: string } & Tekniskvalg) {
  if (id === 'oversikt') return <Oversikt />;
  if (id === 'regnskap') return <Regnskap />;
  if (id === 'graa') return <Graa />;
  if (id === 'inon') return <Inon />;
  if (id === 'framtid') return <Framtid />;
  if (id === 'om') return <Om teknisk={teknisk} settTeknisk={settTeknisk} />;
  return <Naturtema t={NATURTEMA.find(t => t.id === id)!} />;
}

/* Hver side kan få fokus (tabIndex -1), så en lenke fra en annen side kan flytte fokus hit. */
export default function Innhold({ teknisk, settTeknisk }: Tekniskvalg) {
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
