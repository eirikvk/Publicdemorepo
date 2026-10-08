/* Oversikten: det viktigste fra hver side, kort. Hver linje har sidens navn som lenke, ett tall og én eller to setninger. Tallene er
   de samme som på sidene selv. Linjene står i de samme blokkene som i sidevelgeren, så temaene står under «Naturen i kommunen». */
import { Fragment } from 'react';
import { app, gjeldende } from '../motor/felles.js';
import { utenPlan } from '../motor/egne.js';
import { BLOKKER } from '../motor/handlinger.js';
import { NATURLAG, byggNaturTall } from '../motor/naturtema.js';
import { ETT, bildeStatus } from './Temaer.jsx';
import { Sidelenke } from './deler.jsx';
import { andelTekst, antallOrd, dekar, dekarFraRuter, iTekst, stor } from './tekst.js';
import './Oversikt.css';

const HENTER = { tall: '', tekst: 'Henter …' },
  ingenTall = tekst => ({ tall: '', tekst });
const andel = km2 => (app.ssbSum ? `, ${andelTekst((km2 / app.ssbSum) * 100)} av landarealet` : '');

/* Utbredelsesregnskapet: natur nå, og forskjellen fra 2017 */
function regnskap() {
  const T = app.arealtall;
  if (!T || T.tilstand === 'henter') return HENTER;
  if (T.tilstand !== 'ok') return ingenTall('Tallene kunne ikke hentes fra SSB.');
  const nat = T.a[2],
    H = gjeldende(app.historie),
    d = H && !H.endret ? H.a1[2] - H.a0[2] : 0;
  return {
    tall: dekar(nat),
    tekst:
      `Natur i ${T.aar}${andel(nat)}.` +
      (Math.round(d * 1000)
        ? ` Ca. ${iTekst(Math.abs(d))} ${d < 0 ? 'mindre' : 'mer'} enn i ${H.fra}, men forskjellen mellom årgangene er ikke målt endring.`
        : '')
  };
}

/* Verneområder, villrein og verdsatt natur: antall, areal og planlagt utbygging innenfor */
function naturtema(id) {
  const t = NATURLAG.find(x => x.id === id),
    D = t.data;
  if (!D || !app.valgt || D.nr !== app.valgt.nr) return HENTER;
  if (D.feil) return ingenTall(`${t.navn} kunne ikke hentes fra Miljødirektoratet.`);
  const o = D.omrader;
  if (!o.length) return ingenTall(`Miljødirektoratet har ingen ${t.fl} registrert i kommunen.`);
  const N = byggNaturTall(D, t.klasser, !!t.dekning, !!t.samlet, app.ssbSum),
    verdi =
      t.klasser && D.klasser ? ` Ca. ${iTekst(D.klasser[0] + D.klasser[1])} har stor eller svært stor verdi.` : '',
    plan =
      utenPlan() || !D.regnet
        ? ''
        : N.plan
          ? ` Ca. ${dekarFraRuter(N.plan)} planlagt utbygging innenfor.`
          : ' Ingen planlagt utbygging innenfor.';
  return {
    tall: dekar(D.sum || 0),
    tekst: `${stor(antallOrd(o.length, ETT[id]))} ${o.length === 1 ? t.en : t.fl}.${verdi}${plan}`
  };
}

/* Inngrepsfri natur og grått areal hentes som ett bilde av kommunen */
function inon() {
  const D = gjeldende(app.inon),
    s = bildeStatus(D);
  if (s === 'henter') return HENTER;
  if (s === 'feil') return ingenTall('Inngrepsfri natur kunne ikke hentes fra Miljødirektoratet.');
  if (s === 'ingen') return ingenTall('Ingen. Alt ligger nærmere enn én kilometer fra tyngre tekniske inngrep.');
  return { tall: dekar(D.sum), tekst: `Minst én kilometer fra tyngre tekniske inngrep${andel(D.sum)}.` };
}
function graa() {
  const D = gjeldende(app.graa),
    s = bildeStatus(D);
  if (s === 'henter') return HENTER;
  if (s === 'feil') return ingenTall('Grått areal kunne ikke hentes fra NIBIO.');
  if (s === 'ingen') return ingenTall('Kartet over grå arealer har ingen flater i kommunen.');
  return {
    tall: dekar(D.sum),
    tekst: `Tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet${andel(D.sum)}.`
  };
}

/* Utvikling fremover: natur og jordbruk som kommuneplanen setter av til utbygging */
function framtid() {
  if (utenPlan()) return ingenTall('Direktoratet for byggkvalitet (DiBK) har ingen kommuneplan for kommunen.');
  const P = app.planSum && app.valgt && app.planSum.nr === app.valgt.nr ? app.planSum : null;
  if (P)
    return {
      tall: dekar(P.nat),
      tekst: `Natur som kommuneplanen setter av til framtidig utbygging. I tillegg ca. ${iTekst(P.jor)} jordbruk.${P.egne ? ' Egne områder er med.' : ''}${P.delvis ? ' Gjelder bare den delen av kommunen nettleseren har hentet kart for.' : ''}`
    };
  const tilstand = app.planTall ? app.planTall.tilstand : 'tom';
  return tilstand === 'zoom'
    ? ingenTall('Zoom inn i kartet for å få et anslag.')
    : tilstand === 'feil'
      ? ingenTall('Arealet kunne ikke regnes ut.')
      : HENTER;
}

const LINJE = {
  regnskap,
  graa,
  rein: () => naturtema('rein'),
  inon,
  verdi: () => naturtema('verdi'),
  vern: () => naturtema('vern'),
  framtid
};

export default function Oversikt() {
  return (
    <section className="sammendrag" aria-labelledby="oversikt-tittel">
      <h2 className="md-typography-heading-s" id="oversikt-tittel">
        Oversikt
      </h2>
      <p>Det viktigste fra hver side. Velg navnet for å lese mer.</p>
      {BLOKKER.map(({ gruppe, sider }, b) => {
        const vis = sider.filter(([id]) => LINJE[id]);
        if (!vis.length) return null;
        return (
          <Fragment key={b}>
            {gruppe && <h3 className="md-typography-heading-xs">{gruppe}</h3>}
            <ul className="talliste">
              {vis.map(([id, navn]) => {
                const { tall, tekst } = LINJE[id]();
                return (
                  <li key={id}>
                    <span className="navn">
                      <Sidelenke id={id}>{navn}</Sidelenke>
                    </span>
                    <b className="tall">{tall}</b>
                    <p>{tekst}</p>
                  </li>
                );
              })}
            </ul>
          </Fragment>
        );
      })}
    </section>
  );
}
