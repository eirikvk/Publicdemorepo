/* Kartet med merkelappene oppå, linjen under kartet, knappene som slår kartlag av og på, og egne områder. Selve kartet lages av
   motoren (motor/kart.js) og settes inn her. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { app, KL, rolig } from '../motor/felles.js';
import { byttGraa, byttInon, byttKlasse, byttPlan, byttTema } from '../motor/handlinger.js';
import { byttTilValgt, lagKart, plasserBytt, settByttKnapp } from '../motor/kart.js';
import { lastOppPlan, utenPlan } from '../motor/egne.js';
import { NATURLAG, fjernMerket } from '../motor/naturtema.js';
import Egne from './Egne.jsx';
import { Rute } from './deler.jsx';
import { MdButton, MdFilterChip, MdIconButton, MdIconClose, MdLoadingSpinner } from './md.js';

function Kart() {
  const ref = useRef(null);
  useEffect(() => {
    const kart = lagKart();
    kart.setTarget(ref.current);
    return () => kart.setTarget(undefined);
  }, []);
  return <div className="kartflate" ref={ref} />;
}

/* Knappen som bytter til kommunen man trykket på utenfor valgt kommune. Motoren plasserer den over punktet. */
function Bytt() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    settByttKnapp(ref.current);
    plasserBytt();
  });
  if (!app.bytt) return null;
  return (
    <div className="bytt" ref={ref}>
      <MdButton onClick={byttTilValgt}>Bytt til {app.bytt.navn}</MdButton>
    </div>
  );
}

/* Fra merkelappen i kartet tilbake til området i listen under temaet. */
function tilListen() {
  const v = app.vist;
  if (!v) return;
  const tema = document.getElementById('tema-' + v.id);
  if (tema) tema.open = true;
  /* Innholdet i en rad som nettopp er åpnet, kan ikke få fokus før nettleseren har tegnet det */
  setTimeout(() => {
    const li = document.getElementById(v.liId) || tema;
    if (!li) return;
    li.scrollIntoView({ behavior: rolig() ? 'auto' : 'smooth', block: 'center' });
    const kn = li.querySelector('button');
    if (kn) kn.focus({ preventScroll: true });
  }, 50);
}

/* Kartlagene slås av og på med filterbrikker. Fargeruten i brikken er fargen laget har i kartet. */
function Kartlag() {
  const brikke = (key, id, navn, aktiv, vedTrykk, ekstra) => (
    <MdFilterChip
      key={key}
      label={
        <span className="brikke">
          {id && <Rute id={id} />}
          {navn}
        </span>
      }
      active={aktiv}
      onClick={vedTrykk}
      data-lag-knapp={key}
      {...ekstra}
    />
  );
  const utenPlanNaa = utenPlan();
  return (
    <section className="kartlag" aria-labelledby="kartlag-tittel">
      <h2 className="md-typography-heading-s" id="kartlag-tittel">
        Vis i kartet
      </h2>
      <div className="brikker" role="group" aria-label="Arealklasser og planlagt utbygging">
        {KL.map(([id, navn]) => brikke(id, id, navn, app.vis[id], () => byttKlasse(id)))}
        {brikke(
          'plan',
          'plan',
          utenPlanNaa ? 'Planlagt utbygging (ingen plan)' : 'Planlagt utbygging',
          app.planPaa && !utenPlanNaa,
          byttPlan,
          { disabled: utenPlanNaa }
        )}
      </div>
      <div className="brikker" role="group" aria-label="Tema i kartet">
        {NATURLAG.map(t => brikke(t.id, t.id, t.navn, t.paa, () => byttTema(t)))}
        {brikke('inon', 'inon', 'Inngrepsfri natur', app.inonPaa, byttInon)}
        {brikke('graa', 'graa', 'Grått areal', app.graaPaa, byttGraa)}
      </div>
      <p className="hint">
        Lagene er uavhengige, så planlagt utbygging kan vises alene. Vann vises med grunnkartets farger og er ikke med i
        tallene for bebygd, jordbruk og natur. Planlaget er omtrentlig og bare til illustrasjon.
      </p>
    </section>
  );
}

export default function Kartpanel({ teknisk }) {
  const scene = useRef(null);
  const slipp = e => {
    e.preventDefault();
    scene.current.classList.remove('slipp');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) lastOppPlan(f);
  };
  const p = app.probe;
  return (
    <section className="kartpanel" aria-label="Kart">
      <div
        className="kartscene"
        ref={scene}
        onDragOver={e => {
          e.preventDefault();
          scene.current.classList.add('slipp');
        }}
        onDragLeave={() => scene.current.classList.remove('slipp')}
        onDrop={slipp}
      >
        <Kart />
        {app.laster && (
          <div className="merkelapp oppe">
            <MdLoadingSpinner size={16} />
            Henter kart …
          </div>
        )}
        <Bytt />
        {app.sidezoom && (
          <div className="merkelapp midt" role="status">
            Siden er forstørret. Knip sammen for å zoome ut, så virker kartet igjen.
          </div>
        )}
        {app.vist && (
          <div className="vistmerke">
            <b>{app.vist.navn}</b>
            <MdButton theme="tertiary" mode="small" onClick={tilListen}>
              Til listen
            </MdButton>
            <MdIconButton theme="plain" label="Fjern markeringen i kartet" onClick={fjernMerket}>
              <MdIconClose />
            </MdIconButton>
          </div>
        )}
        {app.ute && (
          <div className="merkelapp nede">
            Zoom inn for å se arealklassene. NIBIO tegner grunnkartet først fra 1:50 000.
          </div>
        )}
      </div>
      <div className="kartfot">
        <p className="probe">
          {!p ? (
            'Trykk i kommunen for å se klassen, eller utenfor for å bytte kommune.'
          ) : p.punkt ? (
            <>
              Valgt punkt: <b>{p.punkt}</b>
            </>
          ) : (
            p.tekst
          )}
        </p>
        {teknisk && <p className="tek">{app.siste}</p>}
      </div>
      <Kartlag />
      <Egne />
    </section>
  );
}
