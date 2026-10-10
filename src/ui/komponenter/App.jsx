/* Hele siden. Kroken useApp gjør at siden tegnes på nytt når tilstanden er endret. */
import { useEffect, useState } from 'react';
import { NATURTEMA } from '../../data/motor/naturtema.ts';
import { app } from '../../data/motor/tilstand.ts';
import { kart } from '../kart/kart.js';
import { startOpp } from '../sider.js';
import { ui } from '../tilstand.js';
import { useApp } from './lager.js';
import Topp from './Topp.jsx';
import Sidevelger from './Sidevelger.jsx';
import Kartpanel from './Kartpanel.jsx';
import Innhold from './Innhold.jsx';
import './App.css';

/* Teknisk informasjon til feilsøking: utgave, måling av hvor jevnt kartet går, siste kall under kartet og listen over kall.
   Skjult til vanlig. Valget lagres ikke i nettleseren, men står i adressen (?teknisk), så siden kan åpnes med det slått på.
   Med teknisk visning er tilstanden, temaene og kartet også tilgjengelig som window.motor, til feilsøking og til regresjonstesten. */
const tekniskIAdressen = () => new URLSearchParams(location.search).has('teknisk');

export default function App() {
  useApp();
  const [teknisk, settTekniskTilstand] = useState(tekniskIAdressen);
  const settTeknisk = paa => {
    settTekniskTilstand(paa);
    try {
      const u = new URL(location.href);
      if (paa) u.searchParams.set('teknisk', '');
      else u.searchParams.delete('teknisk');
      history.replaceState(null, '', u.pathname + u.search.replace(/=(&|$)/g, '$1') + u.hash);
    } catch (e) {}
  };
  useEffect(() => {
    if (teknisk)
      window.motor = {
        app,
        ui,
        NATURTEMA,
        get kart() {
          return kart;
        }
      };
  }, [teknisk]);
  /* Kartet har fått plassen sin før dette kjører, så det kan zoome til kommunen med en gang. */
  useEffect(() => startOpp(), []);
  return (
    <div className="side">
      <Topp />
      <Sidevelger />
      <main className="hoved">
        <Kartpanel teknisk={teknisk} />
        <Innhold teknisk={teknisk} settTeknisk={settTeknisk} />
      </main>
    </div>
  );
}
