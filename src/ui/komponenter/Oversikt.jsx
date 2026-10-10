/* Oversikten: det viktigste fra hver side, kort. Hver linje har sidens navn som lenke, ett tall og én eller to setninger. Tallene er
   de samme som på sidene selv, fordi de kommer fra de samme funksjonene i gull. Linjene står i de samme blokkene som i sidevelgeren,
   så temaene står under «Naturen i kommunen». */
import { Fragment } from 'react';
import { byggGraa } from '../../data/gull/graa.js';
import { byggInon } from '../../data/gull/inon.js';
import { byggEndring, byggUtbredelse } from '../../data/gull/regnskap.js';
import { byggNaturTall } from '../../data/gull/temaer.js';
import { utenPlan } from '../../data/motor/egne.js';
import { NATURTEMA } from '../../data/motor/naturtema.js';
import { app, gjeldende } from '../../data/motor/tilstand.js';
import { BLOKKER } from '../sider.js';
import { ETT, TEMAORD } from './Temaer.jsx';
import { Sidelenke } from './deler.jsx';
import { andelTekst, antallOrd, dekar, iTekst, stor } from '../tekst.js';
import './Oversikt.css';

const HENTER = { tall: '', tekst: 'Henter …' },
  ingenTall = tekst => ({ tall: '', tekst });
/* Andelen av landarealet fra gull, som tillegg til en setning. Tomt når landarealet mangler (null). */
const avLand = a => (a !== null ? `, ${andelTekst(a)} av landarealet` : '');

/* Utbredelsesregnskapet: natur nå, og forskjellen fra 2017 */
function regnskap() {
  const T = app.arealtall;
  if (!T || T.tilstand === 'henter') return HENTER;
  if (T.tilstand !== 'ok') return ingenTall('Tallene kunne ikke hentes fra SSB.');
  const U = byggUtbredelse(T),
    natur = U.klasser[0],
    E = byggEndring(gjeldende(app.historie)),
    d = E && !E.endret ? E.klasser[0].km2 : 0;
  return {
    tall: dekar(natur.km2),
    tekst:
      `Natur i ${U.aar}${avLand(natur.andel)}.` +
      (Math.round(d * 1000)
        ? ` Ca. ${iTekst(Math.abs(d))} ${d < 0 ? 'mindre' : 'mer'} enn i ${E.fra}, men forskjellen mellom årgangene er ikke målt endring.`
        : '')
  };
}

/* Verneområder, villrein og verdsatt natur: antall, areal og planlagt utbygging innenfor */
function naturtema(id) {
  const t = { ...NATURTEMA.find(x => x.id === id), ...TEMAORD[id] },
    D = t.data;
  if (!D || !app.valgt || D.nr !== app.valgt.nr) return HENTER;
  if (D.feil) return ingenTall(`${t.navn} kunne ikke hentes fra Miljødirektoratet.`);
  const N = byggNaturTall(D, t.klasser, !!t.dekning, !!t.samlet, app.ssbSum);
  if (!N.antall) return ingenTall(`Miljødirektoratet har ingen ${t.fl} registrert i kommunen.`);
  const verdi = N.hoyVerdi !== null ? ` Ca. ${iTekst(N.hoyVerdi)} har stor eller svært stor verdi.` : '',
    plan =
      utenPlan() || !D.regnet
        ? ''
        : N.plan
          ? ` Ca. ${iTekst(N.planKm2)} planlagt utbygging innenfor.`
          : ' Ingen planlagt utbygging innenfor.';
  return {
    tall: dekar(N.sum),
    tekst: `${stor(antallOrd(N.antall, ETT[id]))} ${N.antall === 1 ? t.en : t.fl}.${verdi}${plan}`
  };
}

/* Inngrepsfri natur og grått areal hentes som ett bilde av kommunen */
function inon() {
  const I = byggInon(gjeldende(app.inon), app.ssbSum),
    s = I.tilstand;
  if (s === 'henter') return HENTER;
  if (s === 'feil') return ingenTall('Inngrepsfri natur kunne ikke hentes fra Miljødirektoratet.');
  if (s === 'ingen') return ingenTall('Ingen. Alt ligger nærmere enn én kilometer fra tyngre tekniske inngrep.');
  return { tall: dekar(I.sum), tekst: `Minst én kilometer fra tyngre tekniske inngrep${avLand(I.andelLand)}.` };
}
function graa() {
  const G = byggGraa(gjeldende(app.graa), null, app.ssbSum),
    s = G.tilstand;
  if (s === 'henter') return HENTER;
  if (s === 'feil') return ingenTall('Grått areal kunne ikke hentes fra NIBIO.');
  if (s === 'ingen') return ingenTall('Kartet over grå arealer har ingen flater i kommunen.');
  return {
    tall: dekar(G.sum),
    tekst: `Tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet${avLand(G.andelLand)}.`
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
