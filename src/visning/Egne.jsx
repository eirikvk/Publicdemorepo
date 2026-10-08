/* Egne områder: tegning i kartet, opplasting av plan, og sammenligningen med kommuneplanen. Tallene regnes ut i motor/plan.js og
   motor/egne.js, radene i tabellene i byggEgneRader. */
import { useRef } from 'react';
import { app, dekar, iTekst, nf, RUTE } from '../motor/felles.js';
import {
  angrePunkt,
  egneRader,
  ferdigTegning,
  lastOppPlan,
  mine,
  settType,
  slettEget,
  sluttTegning,
  startTegning,
  tegner,
  visEgetIKartet
} from '../motor/egne.js';
import { ingenPlan } from '../motor/plan.js';
import { antallOrd, Celle, Rute } from './deler.jsx';
import {
  MdAlertMessage,
  MdButton,
  MdIconDelete,
  MdIconEdit,
  MdIconLocation,
  MdIconUpload,
  MdRadioGroup
} from './md.js';

/* Antall flater i tekst, med tall til og med tolv i ord */
const flater = n => (n === 1 ? 'én flate' : `${antallOrd(n)} flater`);

const dk = n => iTekst(n * RUTE);
const ramse = deler => {
  const d = deler.filter(Boolean);
  return d.length > 1 ? d.slice(0, -1).join(', ') + ' og ' + d[d.length - 1] : d[0] || '';
};

/* Tabellen som sammenligner planen alene med egne områder. Radene er [navn, farge, planen, med egne, hva andelen regnes av, gruppe]. */
function EgenTabell({ rader, navnPlan, navnNy }) {
  const tall = n => (n ? dekar(n * RUTE).replace(' daa', '') : '0'),
    endr = d => (!d ? '0' : (d < 0 ? '−' : '+') + tall(Math.abs(d)));
  const kropp = [];
  let gruppe = '';
  rader.forEach(([navn, farge, plan, ny, av, gr], i) => {
    if (gr !== gruppe) {
      gruppe = gr;
      kropp.push(
        <tr key={'g' + i} className="gruppe">
          <th colSpan={4} scope="colgroup">
            {gr}
          </th>
        </tr>
      );
    }
    const andel = n => (av ? `${nf((n / av) * 100)} %` : '');
    kropp.push(
      <tr key={i}>
        <th scope="row">
          <span className="radnavn">
            {farge && <Rute id={farge} />}
            {navn}
          </span>
        </th>
        <Celle tekst={plan === null ? '–' : tall(plan)} under={plan === null ? '' : andel(plan)} />
        <Celle tekst={tall(ny)} under={andel(ny)} />
        <Celle tekst={endr(ny - (plan || 0))} />
      </tr>
    );
  });
  return (
    <div className="tabellramme">
      <table className="talltabell tallkolonner">
        <caption className="etikett">Planlagt utbygging, daa</caption>
        <thead>
          <tr>
            {['På', navnPlan, navnNy, 'Endring'].map(t => (
              <th key={t} scope="col">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{kropp}</tbody>
      </table>
    </div>
  );
}

function EgetOmrade({ g, nr, R }) {
  const T = R ? g.tall : null,
    tekster = [];
  let tabell = null;
  if (!T) tekster.push(ingenPlan() || app.ov ? 'Regner …' : 'Zoom inn over området, så regnes det ut.');
  else {
    const kjent = T.nat + T.jor + T.beb + T.vann;
    tekster.push(
      kjent
        ? `I dag ligger det ${ramse([T.nat ? dk(T.nat) + ' natur' : '', T.jor ? dk(T.jor) + ' jordbruk' : '', T.beb ? dk(T.beb) + ' bebygd' : '', T.vann ? dk(T.vann) + ' vann' : ''])} her.`
        : 'Kartet er ikke hentet for dette området ennå.'
    );
    if (T.ukjent && kjent)
      tekster.push(
        `For ca. ${dk(T.ukjent)} er kartet ikke hentet, eller området ligger utenfor kommunen. Zoom inn over området for å få med mer.`
      );
    if (kjent)
      tabell = (
        <EgenTabell
          rader={egneRader(nr).filter((r, i) => i < 2 || r[2] || r[3] || r[0] === 'Grått areal')}
          navnPlan="Planen her"
          navnNy={g.kilde === 'fil' ? 'Opplastet' : 'Tegningen'}
        />
      );
  }
  const smal =
    T && g.kilde === 'tegnet' && g.deler[0].type === 'bygg' && T.nat + T.jor && !(T.nnat + T.njor)
      ? 'Området er smalere enn rundt 40 meter og regnes som en smal stripe, så det gir ikke utslag.'
      : '';
  return (
    <li className="kort prosa">
      <h3 className="korttittel">
        {g.navn}
        <span>{dekar(g.km2)}</span>
      </h3>
      {g.kilde === 'tegnet' ? (
        <MdRadioGroup
          label="Området er"
          direction="horizontal"
          value={g.deler[0].type}
          options={[
            { value: 'bygg', text: 'Utbygging' },
            { value: 'fri', text: 'Ikke utbygging' }
          ]}
          onChange={e => settType(g, e.target.value)}
        />
      ) : (
        <p>
          {g.utenFormal
            ? `Opplastet fil med ${flater(g.deler.length)}. Filen har ingen arealformål, så ${g.deler.length === 1 ? 'flaten' : 'alle flatene'} regnes som utbygging.`
            : `Opplastet plan${g.planid ? ' ' + g.planid : ''} med ${flater(g.deler.length)}: ${g.bygg ? antallOrd(g.bygg) : 'ingen'} regnes som utbygging (framtidig bebyggelse, anlegg og samferdsel) og ${g.annet ? antallOrd(g.annet) : 'ingen'} som ikke utbygging. Innenfor flatene erstatter filen kommuneplanen.`}
        </p>
      )}
      {tekster.map(t => (
        <p key={t}>{t}</p>
      ))}
      {tabell}
      {smal && <p>{smal}</p>}
      <div className="knapper">
        <MdButton theme="secondary" mode="small" leftIcon={<MdIconLocation />} onClick={() => visEgetIKartet(g)}>
          Vis i kartet
        </MdButton>
        <MdButton
          theme="danger-secondary"
          mode="small"
          leftIcon={<MdIconDelete />}
          aria-label={`Slett ${g.navn}`}
          onClick={() => {
            slettEget(g);
            document.getElementById('tegnknapp')?.focus();
          }}
        >
          Slett
        </MdButton>
      </div>
    </li>
  );
}

export default function Egne() {
  const fil = useRef(null),
    E = mine(),
    R =
      app.planRaster &&
      app.valgt &&
      app.planRaster.nr === app.valgt.nr &&
      app.planRaster.eget &&
      app.planRaster.antallEgne === E.length
        ? app.planRaster
        : null,
    t = tegner(),
    s = app.egneStatus;
  return (
    <section className="egne" aria-labelledby="egne-tittel">
      <h2 className="seksjonstittel" id="egne-tittel">
        Egne områder
      </h2>
      <div className="knapper">
        {!t ? (
          <>
            <MdButton
              id="tegnknapp"
              theme="secondary"
              leftIcon={<MdIconEdit />}
              onClick={startTegning}
              disabled={!app.klipp}
            >
              Tegn eget område
            </MdButton>
            <MdButton theme="secondary" leftIcon={<MdIconUpload />} onClick={() => fil.current.click()}>
              Last opp plan
            </MdButton>
          </>
        ) : (
          <>
            <MdButton theme="secondary" onClick={angrePunkt}>
              Angre punkt
            </MdButton>
            <MdButton onClick={ferdigTegning}>Ferdig</MdButton>
            <MdButton
              theme="tertiary"
              onClick={() => {
                sluttTegning();
                setTimeout(() => document.getElementById('tegnknapp')?.focus(), 0);
              }}
            >
              Avbryt
            </MdButton>
          </>
        )}
        <input
          type="file"
          ref={fil}
          id="planfil"
          accept=".geojson,.json,application/geo+json,application/json"
          hidden
          onChange={e => {
            const f = e.target.files[0];
            e.target.value = '';
            lastOppPlan(f);
          }}
        />
      </div>
      <p className="hint">
        {t
          ? 'Trykk i kartet for hvert hjørne. Avslutt med å trykke på første punkt, eller på Ferdig når du har minst tre punkter.'
          : 'Tegn et område i kartet, eller last opp en plan som GeoJSON i samme format som DiBKs nedlasting av plandata. Du kan også slippe filen i kartet. Innenfor flatene erstatter tegningen eller filen kommuneplanen. Ingenting lagres eller sendes fra nettleseren.'}
      </p>
      {s && <MdAlertMessage theme={s.type === 'info' ? 'info-box' : s.type} fullWidth role="status" label={s.tekst} />}
      {E.length > 0 && (
        <ul className="egneliste">
          {E.map((g, nr) => (
            <EgetOmrade key={g.id} g={g} nr={nr} R={R} />
          ))}
        </ul>
      )}
      {E.length > 0 && R && (
        <div className="kort samlet">
          <h3 className="korttittel">Samlet for kommunen</h3>
          <EgenTabell
            rader={egneRader(null)}
            navnPlan="Planen"
            navnNy={E.length === 1 && E[0].kilde === 'fil' ? 'Med opplastet' : 'Med egne'}
          />
          <p className="hint">
            Planen er kommuneplanen fra DiBK alene. Prosenten under tallene er andelen av dagens natur eller jordbruk i
            kommunen{app.ov && app.ov.dynamisk ? ', i den delen nettleseren har hentet kart for' : ''}. Endring er
            forskjellen fra planen. Grått areal er planlagt utbygging på areal som alt er tatt i bruk. Smale striper er
            ikke med for natur og jordbruk. Inngrepsfri natur er ikke med, fordi et inngrep virker på avstand.
          </p>
        </div>
      )}
    </section>
  );
}
