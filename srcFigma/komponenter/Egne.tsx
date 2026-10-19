/* Egne analyser i tvillingen, på naturtapet: tegne et område i kartet eller laste opp en plan, og se tallene på siden sammenlignet
   med kommuneplanen. Området erstatter kommuneplanen der det ligger, og datamotoren regner de samme analysene for kommuneplanen
   alene og for planen med egne områder (gull.egneRader og gull.egneOkosystemer, lest i tall.ts). Her vises de bare: verktøyene ved
   kartet (EgneVerktoy, Tegnelinje), merket øverst på siden (EgneMerke), endringen under tallene (Endring), kortene for hvert område
   og tabellen for kommunen (EgneOmrader), og linjen på de andre sidene (EgneStripe). Tekstene er de samme som på hovedsiden
   (src/ui/egnetekster.ts). Ikke tegnet i skissene, så oppsettet er et KI-generert forslag. Kan skrus av i flagg.ts. */
import { useRef, type ReactNode } from 'react';
import type { EgenRad } from '../../src/data/gull/egne.ts';
import type { Type } from '../../src/data/solv/egne.ts';
import { katalog } from '../../src/data/katalog.ts';
import { lastOppPlan, settType, slettEget } from '../../src/data/motor/egne.ts';
import { app, type EgetOmrade } from '../../src/data/motor/tilstand.ts';
import { verdi } from '../../src/data/motor/valgt.ts';
import { egneMelding, iDag, omOpplastet, smalTekst } from '../../src/ui/egnetekster.ts';
import { rolig } from '../../src/ui/kart/kart.ts';
import {
  angrePunkt,
  ferdigTegning,
  sluttTegning,
  startTegning,
  tegner,
  visEgetIKartet
} from '../../src/ui/kart/egne.ts';
import { FLAGG } from '../flagg.ts';
import {
  MdAlertMessage,
  MdButton,
  MdIconDelete,
  MdIconEdit,
  MdIconLocation,
  MdIconUpload,
  MdRadioGroup
} from '../md.ts';
import { figma } from '../navigasjon.ts';
import { egne } from '../tall.ts';
import { okosystemfarge } from '../temalag.ts';
import { andelTekst, antallOrd, dekar, iTekst, nf, ramse, stor } from '../tekst.ts';
import Tabell, { type Tabellrad } from './Tabell.tsx';
import { Lenke, MedSporsmal, Trekkspill, Trend } from './deler.tsx';
import './Egne.css';

/* Om tallene på siden er regnet med egne områder */
export const harEgne = () => FLAGG.egneAnalyser && egne().omrader.length > 0;

/* Hva de egne områdene er, i en setning: «ett eget område», «to egne områder og planen du lastet opp» */
export function egneOrd(E: EgetOmrade[]) {
  const t = E.filter(g => g.kilde === 'tegnet').length,
    f = E.length - t;
  return ramse([
    t > 0 && (t === 1 ? 'ett eget område' : `${antallOrd(t, 'ett')} egne områder`),
    f > 0 && (f === 1 ? 'planen du lastet opp' : `${antallOrd(f, 'ett')} opplastede planer`)
  ]);
}

/* Merket for et eget område: løpenummeret, som omrisset i kartet, eller et ikon for en opplastet plan (som ikke har omriss) */
const Merke = ({ g }: { g: EgetOmrade }) => (
  <span className={'egetmerke' + (g.kilde === 'fil' ? ' fil' : '')} aria-hidden="true">
    {g.kilde === 'tegnet' ? g.lopenr : <MdIconUpload />}
  </span>
);

/* Til kortene for områdene, lenger ned på siden */
function tilOmradene() {
  const el = document.getElementById('egne-omrader');
  if (!el) return;
  el.scrollIntoView({ behavior: rolig() ? 'auto' : 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}

/* Endringen fra kommuneplanen under et tall (r, en rad i sammenligningen): pil og dekar mer eller mindre, eller at det er det samme.
   andel gir andelen med kommuneplanen alene i stedet. her gjelder ett område (kommuneplanen her) og ikke hele kommunen. */
export function Endring({ r, andel, her }: { r: EgenRad | null; andel?: boolean; her?: boolean }) {
  const plan = her ? 'kommuneplanen her' : 'kommuneplanen alene';
  if (!r) return <span className="tall-under endring henter">Sammenligner med kommuneplanen …</span>;
  if (r.plan === null) return <span className="tall-under endring">Ingen kommuneplan å sammenligne med</span>;
  if (andel)
    return (
      <span className="tall-under endring">
        {r.andelPlan === null ? 'Kommuneplanen alene: –' : `Kommuneplanen alene: ${andelTekst(r.andelPlan)}`}
      </span>
    );
  const v = r.endring * 1000;
  if (Math.abs(v) < 0.5) return <span className="tall-under endring">Som med {plan}</span>;
  return (
    <span className="tall-under endring">
      <Trend opp={v > 0} />
      {iTekst(Math.abs(r.endring))} {v > 0 ? 'mer' : 'mindre'} enn {plan}
    </span>
  );
}

/* Verktøyene i lagvelgeren ved kartet: tegne et område og laste opp en plan, med meldingen om siste tegning eller opplasting */
export function EgneVerktoy() {
  const fil = useRef<HTMLInputElement>(null),
    t = tegner(),
    m = app.egneStatus && egneMelding(app.egneStatus);
  return (
    <section className="egne-verktoy" aria-labelledby="egne-verktoy-tittel">
      <h2 id="egne-verktoy-tittel">Egne analyser</h2>
      <p>
        Tegn et område i kartet eller last opp en plan. Tallene på siden regnes da med området i stedet for
        kommuneplanen der det ligger.
      </p>
      {t ? (
        <p className="egne-tegner">Du tegner i kartet. Knappene for å angre og avslutte står nederst i kartet.</p>
      ) : (
        <div className="knapper">
          <MdButton
            id="tegnknapp"
            theme="secondary"
            leftIcon={<MdIconEdit />}
            onClick={() => {
              startTegning();
              setTimeout(() => document.getElementById('tegn-angre')?.focus({ preventScroll: true }), 0);
            }}
            disabled={!verdi(katalog.solv.grense)}
          >
            Tegn område
          </MdButton>
          <MdButton theme="secondary" leftIcon={<MdIconUpload />} onClick={() => fil.current!.click()}>
            Last opp plan
          </MdButton>
        </div>
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
      {m &&
        (m[1] === 'warning' || m[1] === 'error' ? (
          <MdAlertMessage theme={m[1]} fullWidth role="status" label={m[0]} />
        ) : (
          <p className={'egne-melding' + (m[1] === 'success' ? ' ok' : '')} role="status">
            {m[0]}
          </p>
        ))}
      <p className="hint">
        Planen må være GeoJSON, som filen fra DiBKs nedlasting av plandata. Du kan også slippe filen i kartet. Ingenting
        lagres eller sendes fra nettleseren.
      </p>
    </section>
  );
}

/* Knappene over kartet mens et område tegnes */
export function Tegnelinje() {
  if (!tegner()) return null;
  return (
    <div className="tegnelinje" role="group" aria-label="Tegn eget område">
      <p>Trykk i kartet for hvert hjørne. Avslutt ved å trykke på første punkt, eller på Ferdig.</p>
      <div className="knapper">
        <MdButton id="tegn-angre" theme="secondary" mode="small" onClick={angrePunkt}>
          Angre punkt
        </MdButton>
        <MdButton mode="small" onClick={ferdigTegning}>
          Ferdig
        </MdButton>
        <MdButton
          theme="tertiary"
          mode="small"
          onClick={() => {
            sluttTegning();
            setTimeout(() => document.getElementById('tegnknapp')?.focus({ preventScroll: true }), 0);
          }}
        >
          Avbryt
        </MdButton>
      </div>
    </div>
  );
}

/* Merket øverst på naturtapet når tallene er regnet med egne områder */
export function EgneMerke() {
  const E = egne().omrader;
  if (!FLAGG.egneAnalyser || !E.length) return null;
  const en = E.length === 1,
    /* den (planen) eller det (området), og de for flere */
    den = !en ? 'de' : E[0].kilde === 'fil' ? 'den' : 'det';
  return (
    <section className="egne-merke" aria-label="Egne områder">
      <span className="egne-merker">
        {E.map(g => (
          <Merke key={g.id} g={g} />
        ))}
      </span>
      <div>
        <p>
          <b>Tallene på siden er regnet med {egneOrd(E)}.</b> {stor(den)} erstatter kommuneplanen der {den} ligger, og
          ved tallene står forskjellen fra kommuneplanen alene.
        </p>
        <MdButton theme="tertiary" mode="small" onClick={tilOmradene}>
          {en ? (E[0].kilde === 'fil' ? 'Se planen' : 'Se området') : 'Se områdene'}
        </MdButton>
      </div>
    </section>
  );
}

/* Linjen under toppen på de andre sidene når egne områder er med i tallene for planlagt utbygging */
export function EgneStripe() {
  const E = egne().omrader;
  if (!FLAGG.egneAnalyser || !E.length || figma.rute.side === 'naturtapet') return null;
  return (
    <p className="egne-stripe" role="status">
      Planlagt utbygging er regnet med {egneOrd(E)}.{' '}
      <Lenke til={{ side: 'naturtapet' }}>Se sammenligningen på Naturtapet</Lenke>
    </p>
  );
}

/* Tabellen med alle radene i sammenligningen: gruppene som overskrifter, arealer i dekar og antall der radene teller områder, og
   andelen under tallet der analysen gir en. Fargen ved navnet er fargen i kartet og figurene. */
const daa = (km2: number) => (Math.abs(km2) * 1000 < 0.5 ? '0' : nf(km2 * 1000, 0));
const fortegn = (v: number, vis: (v: number) => string) => {
  const t = vis(Math.abs(v));
  return t === '0' ? '0' : (v < 0 ? '−' : '+') + t;
};
function Sammenligning({ rader, navnFor, navnEtter }: { rader: EgenRad[]; navnFor: string; navnEtter: string }) {
  const ut: Tabellrad[] = [];
  let gruppe = '';
  for (const r of rader) {
    const tall = r.enhet === 'antall' ? (v: number) => nf(v, 0) : daa,
      med = (v: number, a: number | null) => (
        <>
          {tall(v)}
          {a !== null && <small className="andel">{andelTekst(a)}</small>}
        </>
      ),
      farge = r.gruppe === 'Per økosystemtype' ? okosystemfarge(r.navn) : r.farge;
    if (r.gruppe !== gruppe) {
      gruppe = r.gruppe;
      ut.push({ gruppe: r.enhet === 'antall' ? `${gruppe}, antall` : gruppe });
    }
    ut.push([
      <span className="radnavn">
        {farge && <i style={{ background: `var(--${farge})` }} />}
        {r.navn}
      </span>,
      r.plan === null ? '–' : med(r.plan, r.andelPlan),
      med(r.ny, r.andelNy),
      r.plan === null ? '–' : fortegn(r.endring, tall)
    ]);
  }
  return (
    <Tabell
      hva={`Planlagt utbygging, ${navnFor.toLowerCase()} og ${navnEtter.toLowerCase()}`}
      kolonner={[
        { navn: 'Planlagt utbygging, daa' },
        /* delt mellom leddene på smale skjermer */
        { navn: navnFor.replace('Kommuneplanen', 'Kommune\u00adplanen'), tall: true },
        { navn: navnEtter, tall: true },
        { navn: 'Endring', tall: true }
      ]}
      rader={ut}
      perSide={200}
    />
  );
}
/* Radene som vises for et område: natur og jordbruk alltid, og de andre når de har noe i en av planene */
const synlig = (r: EgenRad, i: number) => i < 2 || !!r.plan || !!r.ny;

/* Ett tall i kortet for et område: navnet, tallet med egne områder og endringen fra kommuneplanen her */
const Tall = ({ navn, r }: { navn: string; r: EgenRad | null }) => (
  <div>
    <dt>{navn}</dt>
    <dd>
      {r ? iTekst(r.ny) : <span className="henter">…</span>}
      <Endring r={r} her />
    </dd>
  </div>
);

/* Kortet for et eget område: merket og navnet, om det er utbygging, hva som ligger der i dag, de viktigste tallene med endringen,
   alle tallene for området, og knappene */
function Omradekort({ g, i }: { g: EgetOmrade; i: number }) {
  const { rader, oko } = egne(),
    j = rader ? rader.omrader.findIndex(x => x.id === g.id) : -1,
    her = j < 0 ? null : rader!.omrader[j],
    O = her ? her.omrade : null,
    rad = (farge: string) => (her && her.rader.find(r => r.farge === farge)) || null,
    smal = smalTekst(g, O),
    tittel = `egne-${g.id}`;
  let mer: ReactNode = null;
  if (her && O && O.kjent)
    mer = (
      <div className="trekkspill-liste">
        <Trekkspill tittel="Alle tallene for området">
          <Sammenligning
            rader={[
              ...her.rader,
              /* andelen av typen i hele kommunen sier lite for ett område */
              ...(oko && oko.omrader[j] ? oko.omrader[j] : []).map(r => ({ ...r, andelPlan: null, andelNy: null }))
            ].filter(synlig)}
            navnFor="Kommuneplanen her"
            navnEtter={g.kilde === 'fil' ? 'Med planen' : 'Med området'}
          />
        </Trekkspill>
      </div>
    );
  return (
    <li className="egetkort" aria-labelledby={tittel}>
      <div className="egetkort-topp">
        <Merke g={g} />
        <h3 id={tittel} className="md-typography-heading-xs">
          {g.navn}
        </h3>
        <span className="egetkort-areal">{dekar(g.km2)}</span>
      </div>
      <div className="egetkort-kropp">
        <div className="egetkort-om">
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
          {O ? (
            iDag(O, iTekst).map(t => <p key={t}>{t}</p>)
          ) : (
            <p className="henter">Regner ut hva som ligger i området …</p>
          )}
          {smal && <p className="egetkort-smal">{smal}</p>}
        </div>
        <div className="egetkort-resultat">
          {(!O || O.kjent) && (
            <dl className="egetkort-tall">
              <Tall navn="Natur satt av" r={rad('pnat')} />
              <Tall navn="Jordbruk satt av" r={rad('pjor')} />
              <Tall navn="På grått areal" r={rad('graa2')} />
            </dl>
          )}
          {mer}
        </div>
      </div>
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
            /* fokus til neste område, eller til knappen for å tegne når det var det siste */
            setTimeout(() => {
              const neste = document.querySelectorAll<HTMLElement>('.egetkort')[Math.max(0, i - 1)];
              (neste ? neste.querySelector<HTMLElement>('button') : document.getElementById('tegnknapp'))?.focus();
            }, 0);
          }}
        >
          Slett
        </MdButton>
      </div>
    </li>
  );
}

/* Kortene for hvert eget område, og alle tallene for kommunen */
export function EgneOmrader() {
  const { omrader, rader, oko, venter } = egne();
  if (!FLAGG.egneAnalyser || !omrader.length) return null;
  const fil = omrader.length === 1 && omrader[0].kilde === 'fil';
  return (
    <section className="egne-omrader" id="egne-omrader" tabIndex={-1} aria-labelledby="egne-tittel">
      <div className="egne-hode">
        <MedSporsmal forklaring={['naturtapet/egne', 'egne']}>
          <h2 id="egne-tittel" className="md-typography-heading-m">
            {omrader.length === 1 ? (fil ? 'Planen du lastet opp' : 'Ditt eget område') : 'Dine egne områder'}
          </h2>
        </MedSporsmal>
        <p className="egne-ingress">
          Hvert område sammenlignet med kommuneplanen der det ligger. Som utbygging tar et område all natur og alt
          jordbruk i det, og som ikke utbygging fjerner det det kommuneplanen setter av der.
        </p>
      </div>
      <ul className="egnekort">
        {omrader.map((g, i) => (
          <Omradekort key={g.id} g={g} i={i} />
        ))}
      </ul>
      {rader && (
        <div className="trekkspill-liste egne-alle">
          <Trekkspill tittel="Alle tallene for kommunen">
            <Sammenligning
              rader={[...rader.kommune, ...(oko ? oko.kommune : [])]}
              navnFor="Kommuneplanen alene"
              navnEtter={fil ? 'Med opplastet plan' : 'Med egne områder'}
            />
            {venter && <p className="henter">Regner ut planlagt utbygging per økosystemtype …</p>}
            <p className="hint">
              Kommuneplanen alene er planen fra DiBK, og de samme analysene er regnet for planen med egne områder.
              Prosenten under natur og jordbruk er andelen av naturen eller jordbruket i kommunen i dag, og under
              økosystemtypene andelen av typen i kommunen. Grått areal er planlagt utbygging på areal som alt er tatt i
              bruk. Smale striper er ikke med for natur og jordbruk. Inngrepsfri natur er ikke med, fordi et inngrep
              virker på avstand.
            </p>
          </Trekkspill>
        </div>
      )}
    </section>
  );
}
