/* Kartet med merkelappene oppå, og linjen under kartet. Hva kartet viser, bestemmes av sidevelgeren. Selve kartet lages i
   ui/kart/kart.ts og settes inn her. */
import { useEffect, useLayoutEffect, useRef, type DragEvent } from 'react';
import { lastOppPlan } from '../../data/motor/egne.ts';
import { app } from '../../data/motor/tilstand.ts';
import { byttTilValgt, lagKart, plasserBytt, rolig, settByttKnapp } from '../kart/kart.ts';
import { fjernMerket } from '../kart/naturtema.ts';
import { velgSide } from '../sider.ts';
import { ui } from '../tilstand.ts';
import { MdButton, MdIconButton, MdIconClose, MdLoadingSpinner } from './md.ts';
import './Kartpanel.css';

function Kart() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const kart = lagKart();
    kart.setTarget(ref.current!);
    return () => kart.setTarget(undefined);
  }, []);
  return <div className="kartflate" ref={ref} />;
}

/* Knappen som bytter til kommunen man trykket på utenfor valgt kommune. Kartet plasserer den over punktet. */
function Bytt() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    settByttKnapp(ref.current);
    plasserBytt();
  });
  if (!ui.bytt) return null;
  return (
    <div className="bytt" ref={ref}>
      <MdButton onClick={byttTilValgt}>Bytt til {ui.bytt.navn}</MdButton>
    </div>
  );
}

/* Fra merkelappen i kartet tilbake til området i listen på temaets side. */
function tilListen() {
  const v = ui.vist;
  if (!v) return;
  velgSide(v.id);
  /* Siden som nettopp er valgt, kan ikke få fokus før nettleseren har tegnet den */
  setTimeout(() => {
    const li = document.getElementById(v.liId) || document.getElementById('tema-' + v.id);
    if (!li) return;
    li.scrollIntoView({ behavior: rolig() ? 'auto' : 'smooth', block: 'center' });
    const kn = li.querySelector('button');
    if (kn) kn.focus({ preventScroll: true });
  }, 50);
}

export default function Kartpanel({ teknisk }: { teknisk: boolean }) {
  const scene = useRef<HTMLDivElement>(null);
  const slipp = (e: DragEvent) => {
    e.preventDefault();
    scene.current!.classList.remove('slipp');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      velgSide('framtid');
      lastOppPlan(f);
    }
  };
  const p = ui.probe;
  return (
    <section className="kartpanel" aria-label="Kart">
      <div
        className="kartscene"
        ref={scene}
        onDragOver={e => {
          e.preventDefault();
          scene.current!.classList.add('slipp');
        }}
        onDragLeave={() => scene.current!.classList.remove('slipp')}
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
        {ui.sidezoom && (
          <div className="merkelapp midt" role="status">
            Siden er forstørret. Knip sammen for å zoome ut, så virker kartet igjen.
          </div>
        )}
        {ui.vist && (
          <div className="vistmerke">
            <b>{ui.vist.navn}</b>
            <MdButton theme="tertiary" mode="small" onClick={tilListen}>
              Til listen
            </MdButton>
            <MdIconButton theme="plain" label="Fjern markeringen i kartet" onClick={fjernMerket}>
              <MdIconClose />
            </MdIconButton>
          </div>
        )}
        {ui.ute && (
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
        {teknisk && <p className="hint">{ui.siste}</p>}
      </div>
    </section>
  );
}
