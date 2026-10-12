/* Hele tvillingen: toppen med menyen, siden for ruten i adressen, og bunnen. Kroken useApp gjør at alt tegnes på nytt når noe i
   datamotoren eller visningen er endret. Med ?teknisk i adressen er datamotoren tilgjengelig som window.motor, til røyktesten
   (verktoy/figma-roykt.ts). */
import { useEffect } from 'react';
import { TEMATABELLER, katalog } from '../src/data/katalog.ts';
import { planTall } from '../src/data/motor/plan.ts';
import { app } from '../src/data/motor/tilstand.ts';
import { valgt, verdi } from '../src/data/motor/valgt.ts';
import { useApp } from '../src/ui/komponenter/lager.ts';
import { kart } from '../src/ui/kart/kart.ts';
import { ui } from '../src/ui/tilstand.ts';
import Topp from './komponenter/Topp.tsx';
import { Lenke } from './komponenter/deler.tsx';
import { figma, startOpp } from './navigasjon.ts';
import { Hjelp, Naturtapet, Oversikt, Ukjent, Utforsk, Utforskkart } from './sider/Hovedsider.tsx';
import Temasider from './sider/Temasider.tsx';

function Side() {
  const r = figma.rute;
  if (r.side === 'utforsk' && r.tema) return <Temasider key={r.tema} id={r.tema} />;
  switch (r.side) {
    case 'oversikt':
      return <Oversikt />;
    case 'naturtapet':
      return <Naturtapet />;
    case 'utforsk':
      return <Utforsk />;
    case 'kart':
      return <Utforskkart />;
    case 'hjelp':
      return <Hjelp />;
  }
  return <Ukjent />;
}

export default function App() {
  useApp();
  useEffect(() => {
    if (new URLSearchParams(location.search).has('teknisk'))
      (window as unknown as { motor: object }).motor = {
        app,
        ui,
        figma,
        katalog,
        TEMATABELLER,
        valgt,
        verdi,
        planTall,
        get kart() {
          return kart;
        }
      };
    startOpp();
  }, []);
  /* Sidens tittel følger siden */
  useEffect(() => {
    document.title = `Naturregnskap${app.valgt ? ' for ' + app.valgt.navn : ''} – prototyp`;
  });
  return (
    <div className="tvilling">
      <Topp />
      <main>{app.valgt ? <Side /> : <p className="innhold henter">Henter kommuner …</p>}</main>
      <footer className="bunn">
        <div className="innhold">
          <Lenke til={{ side: 'hjelp' }}>Om prototypen</Lenke>
          <span>Kartgrunnlag og data fra åpne kilder, se kildene under hvert tema.</span>
        </div>
      </footer>
    </div>
  );
}
