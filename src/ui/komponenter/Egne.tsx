/* Egne områder: tegning i kartet, opplasting av plan, og sammenligningen med kommuneplanen. Tallene kommer ferdig regnet ut fra
   gull: tabellen katalog.gull.egneRader, med hva som ligger i hvert område og radene i tabellene, og katalog.gull.egneOkosystemer,
   med radene per økosystemtype, som kan komme senere. Radene er de samme analysene for den gamle planen (kommuneplanen alene) og den
   nye, og forskjellen. */
import { useRef, type ReactNode } from 'react';
import { katalog } from '../../data/katalog.ts';
import type { EgenRad, EgneOkosystemer, EgneRader } from '../../data/gull/egne.ts';
import type { Type } from '../../data/solv/egne.ts';
import { egneRutenett, lastOppPlan, mine, settType, slettEget } from '../../data/motor/egne.ts';
import { valgt, verdi } from '../../data/motor/valgt.ts';
import { app, type EgetOmrade as Eget } from '../../data/motor/tilstand.ts';
import { angrePunkt, ferdigTegning, sluttTegning, startTegning, tegner, visEgetIKartet } from '../kart/egne.ts';
import { Talltabell, type Tabellrad } from './deler.tsx';
import { Korttittel } from './Tallforklaring.tsx';
import {
  MdAlertMessage,
  MdButton,
  MdIconDelete,
  MdIconEdit,
  MdIconLocation,
  MdIconUpload,
  MdRadioGroup
} from './md.ts';
import { iDag, egneMelding, omOpplastet, smalTekst } from '../egnetekster.ts';
import { dekar, medFortegn, nf, pst } from '../tekst.ts';
import './Egne.css';

/* Tabellen som sammenligner den gamle planen med den nye. Radene kommer fra gull/egne.ts: { navn, farge, gruppe, enhet, plan, ny,
   endring, andelPlan, andelNy }, med arealer i km², antall områder og andeler i prosent (null der analysen ikke gir en andel). plan er
   null uten kommuneplan. Gruppen med antall får det i overskriften. */
function EgenTabell({ rader, navnPlan, navnNy }: { rader: EgenRad[]; navnPlan: string; navnNy: string }) {
  const km2 = (v: number) => (v ? dekar(v).replace(' daa', '') : '0'),
    antall = (v: number) => nf(v, 0),
    andel = (a: number | null) => (a !== null ? pst(a) + ' %' : '');
  const ut: Tabellrad[] = [];
  let gruppe = '';
  for (const r of rader) {
    const tall = r.enhet === 'antall' ? antall : km2;
    if (r.gruppe !== gruppe) {
      gruppe = r.gruppe;
      ut.push({ gruppe: r.enhet === 'antall' ? `${gruppe}, antall` : gruppe });
    }
    ut.push({
      navn: r.navn,
      farge: r.farge,
      tall: [
        r.plan === null ? ['–'] : [tall(r.plan), andel(r.andelPlan)],
        [tall(r.ny), andel(r.andelNy)],
        [medFortegn(r.endring, tall)]
      ]
    });
  }
  return <Talltabell tittel="Planlagt utbygging, daa" kolonner={['På', navnPlan, navnNy, 'Endring']} rader={ut} />;
}
/* Radene som vises for et område: natur og jordbruk alltid, og de andre når de har noe i en av planene */
const synlig = (r: EgenRad, i: number) => i < 2 || !!r.plan || !!r.ny;

function EgetOmrade({ g, rader, oko }: { g: Eget; rader: EgneRader | null; oko: EgneOkosystemer | null }) {
  const i = rader ? rader.omrader.findIndex(x => x.id === g.id) : -1,
    her = i < 0 ? null : rader!.omrader[i],
    O = her ? her.omrade : null,
    tekster = O ? iDag(O) : ['Regner …'];
  const tabell: ReactNode =
    O && O.kjent ? (
      <EgenTabell
        rader={[
          ...her!.rader,
          /* andelen av typen i hele kommunen sier lite for ett område */
          ...(oko && oko.omrader[i] ? oko.omrader[i] : []).map(r => ({ ...r, andelPlan: null, andelNy: null }))
        ].filter(synlig)}
        navnPlan="Planen her"
        navnNy={g.kilde === 'fil' ? 'Opplastet' : 'Tegningen'}
      />
    ) : null;
  const smal = smalTekst(g, O);
  return (
    <li className="kort prosa">
      <h3 className="md-typography-heading-xs">
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
          onChange={e => settType(g, e.target.value as Type)}
        />
      ) : (
        <p>{omOpplastet(g)}</p>
      )}
      {tekster.map(t => (
        <p key={t}>{t}</p>
      ))}
      {tabell}
      {smal && <p>{smal}</p>}
      <div className="knapper">
        <MdButton theme="tertiary" mode="small" leftIcon={<MdIconLocation />} onClick={() => visEgetIKartet(g)}>
          Vis i kartet
        </MdButton>
        <MdButton
          theme="danger-tertiary"
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
  const fil = useRef<HTMLInputElement>(null),
    E = mine(),
    R = egneRutenett(),
    rader = R ? verdi(katalog.gull.egneRader) : null,
    /* fordelingen per økosystemtype kan komme senere, eller mangle når grunnkartet med detaljklassene ikke kan hentes */
    O = R ? valgt(katalog.gull.egneOkosystemer) : null,
    oko = O && O.status === 'ok' ? O.verdi! : null,
    okoVenter = !O || O.status === 'henter',
    t = tegner(),
    m = app.egneStatus && egneMelding(app.egneStatus),
    s = m && { tekst: m[0], type: m[1] };
  return (
    <section className="egne" aria-labelledby="egne-tittel">
      <Korttittel kort="egne" id="egne-tittel" />
      <div className="knapper">
        {!t ? (
          <>
            <MdButton
              id="tegnknapp"
              theme="secondary"
              leftIcon={<MdIconEdit />}
              onClick={startTegning}
              disabled={!verdi(katalog.solv.grense)}
            >
              Tegn eget område
            </MdButton>
            <MdButton theme="secondary" leftIcon={<MdIconUpload />} onClick={() => fil.current!.click()}>
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
            const f = e.target.files![0];
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
      {s &&
        (s.type === 'warning' || s.type === 'error' ? (
          <MdAlertMessage theme={s.type} fullWidth role="status" label={s.tekst} />
        ) : (
          <p role="status">{s.tekst}</p>
        ))}
      {E.length > 0 && (
        <ul className="egneliste">
          {E.map(g => (
            <EgetOmrade key={g.id} g={g} rader={rader} oko={oko} />
          ))}
        </ul>
      )}
      {E.length > 0 && rader && (
        <div className="kort samlet">
          <h3 className="md-typography-heading-xs">Samlet for kommunen</h3>
          <EgenTabell
            rader={[...rader.kommune, ...(oko ? oko.kommune : [])]}
            navnPlan="Planen"
            navnNy={E.length === 1 && E[0].kilde === 'fil' ? 'Med opplastet' : 'Med egne'}
          />
          {okoVenter && <p className="hint">Regner ut planlagt utbygging per økosystemtype …</p>}
          <p className="hint">
            Planen er kommuneplanen fra DiBK alene, og de samme analysene er regnet for planen med egne områder.
            Prosenten under natur og jordbruk er andelen av naturen eller jordbruket i dag, i kommunen eller i området,
            og under økosystemtypene andelen av typen i kommunen. Endring er forskjellen fra planen. Grått areal er
            planlagt utbygging på areal som alt er tatt i bruk. Smale striper er ikke med for natur og jordbruk.
            Inngrepsfri natur er ikke med, fordi et inngrep virker på avstand.
          </p>
        </div>
      )}
    </section>
  );
}
