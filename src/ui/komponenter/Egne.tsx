/* Egne områder: tegning i kartet, opplasting av plan, og sammenligningen med kommuneplanen. Tallene kommer ferdig regnet ut fra
   gull/egne.ts: byggEgetOmrade for hvert område, og radene i tabellene fra byggEgneRader (som motor/egne.ts henter fram). */
import { useRef, type ReactNode } from 'react';
import { byggEgetOmrade, type EgenRad } from '../../data/gull/egne.ts';
import type { Type } from '../../data/solv/egne.ts';
import type { Planrutenett } from '../../data/solv/planrutenett.ts';
import { egneRader, lastOppPlan, mine, settType, slettEget } from '../../data/motor/egne.ts';
import { ingenPlan } from '../../data/motor/plan.ts';
import { app, gjeldende, type EgetOmrade as Eget, type EgneStatus } from '../../data/motor/tilstand.ts';
import { angrePunkt, ferdigTegning, sluttTegning, startTegning, tegner, visEgetIKartet } from '../kart/egne.ts';
import { Talltabell, type Tabellrad } from './deler.tsx';
import {
  MdAlertMessage,
  MdButton,
  MdIconDelete,
  MdIconEdit,
  MdIconLocation,
  MdIconUpload,
  MdRadioGroup
} from './md.ts';
import { antallOrd, dekar, iTekst, medFortegn, nf, pst, ramse } from '../tekst.ts';
import './Egne.css';

/* Meldingen om siste tegning eller opplasting, etter hva datamotoren melder (app.egneStatus): [tekst, type], der type er typen
   melding i designsystemet. */
type Melding = [tekst: string, type: 'info' | 'success' | 'warning' | 'error'];
const STATUS: Record<EgneStatus['hva'], (s: EgneStatus) => Melding> = {
  forLite: () => ['Området ble for lite til å regnes ut. Tegn et større område.', 'warning'],
  forStor: () => ['Filen er for stor til å leses i nettleseren (over 120 MB).', 'error'],
  leser: s => [`Leser ${s.fil} …`, 'info'],
  lest: s => [
    `${s.fil}: ${nf(s.antall!, 0)} flater lest${s.byttetTil ? `, og kommunen er byttet til ${s.byttetTil}` : ''}.`,
    'success'
  ],
  ingenFlater: () => [
    'Fant ingen flater i filen. Den må være GeoJSON med polygoner, som filen fra DiBKs nedlasting av plandata.',
    'error'
  ],
  ingenKommune: () => ['Velg en kommune først.', 'error'],
  ulesbareFlater: () => ['Flatene i filen kunne ikke leses.', 'error'],
  ikkeGeoJSON: () => ['Filen kunne ikke leses som GeoJSON.', 'error']
};

/* Antall flater i tekst, med tall til og med tolv i ord */
const flater = (n: number) => (n === 1 ? 'én flate' : `${antallOrd(n)} flater`);

/* Tabellen som sammenligner planen alene med egne områder. Radene kommer fra byggEgneRader: { navn, farge, gruppe, plan, ny,
   endring, andelPlan, andelNy }, med arealer i km² og andeler i prosent (null der andelen ikke regnes ut). plan er null uten
   kommuneplan. */
function EgenTabell({ rader, navnPlan, navnNy }: { rader: EgenRad[]; navnPlan: string; navnNy: string }) {
  const tall = (km2: number) => (km2 ? dekar(km2).replace(' daa', '') : '0'),
    andel = (a: number | null) => (a !== null ? pst(a) + ' %' : '');
  const ut: Tabellrad[] = [];
  let gruppe = '';
  for (const r of rader) {
    if (r.gruppe !== gruppe) ut.push({ gruppe: (gruppe = r.gruppe) });
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

function EgetOmrade({ g, nr, R }: { g: Eget; nr: number; R: Planrutenett | null }) {
  const O = R && g.tall ? byggEgetOmrade(g.tall) : null,
    tekster: string[] = [];
  let tabell: ReactNode = null;
  if (!O) tekster.push(ingenPlan() || app.ov ? 'Regner …' : 'Zoom inn over området, så regnes det ut.');
  else {
    tekster.push(
      O.kjent
        ? `I dag ligger det ${ramse(
            (
              [
                [O.natur, 'natur'],
                [O.jordbruk, 'jordbruk'],
                [O.bebygd, 'bebygd'],
                [O.vann, 'vann']
              ] satisfies [km2: number, hva: string][]
            ).map(([v, hva]) => (v ? iTekst(v) + ' ' + hva : ''))
          )} her.`
        : 'Kartet er ikke hentet for dette området ennå.'
    );
    if (O.ukjent && O.kjent)
      tekster.push(
        `For ca. ${iTekst(O.ukjent)} er kartet ikke hentet, eller området ligger utenfor kommunen. Zoom inn over området for å få med mer.`
      );
    if (O.kjent)
      tabell = (
        <EgenTabell
          rader={egneRader(nr).filter((r, i) => i < 2 || r.plan || r.ny || r.navn === 'Grått areal')}
          navnPlan="Planen her"
          navnNy={g.kilde === 'fil' ? 'Opplastet' : 'Tegningen'}
        />
      );
  }
  const smal =
    O && g.kilde === 'tegnet' && g.deler[0].type === 'bygg' && O.smal
      ? 'Området er smalere enn rundt 40 meter og regnes som en smal stripe, så det gir ikke utslag.'
      : '';
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
    P = gjeldende(app.planRaster),
    R = P && P.eget && P.antallEgne === E.length ? P : null,
    t = tegner(),
    m = app.egneStatus && STATUS[app.egneStatus.hva](app.egneStatus),
    s = m && { tekst: m[0], type: m[1] };
  return (
    <section className="egne" aria-labelledby="egne-tittel">
      <h2 className="md-typography-heading-s" id="egne-tittel">
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
              disabled={!app.grense}
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
          {E.map((g, nr) => (
            <EgetOmrade key={g.id} g={g} nr={nr} R={R} />
          ))}
        </ul>
      )}
      {E.length > 0 && R && (
        <div className="kort samlet">
          <h3 className="md-typography-heading-xs">Samlet for kommunen</h3>
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
