/* Temasidene under «Utforsk naturen», etter skissene fra 17. oktober: brødsmuler, toppen med ikon, ingress, trekkspill og bilde,
   tallkort, kartet med lagvelgeren og trekkspill under den, figurer med tekst og kilde, ofte stilte spørsmål, ressurser og flisene
   til alle temaene. Tallene kommer fra datamotoren (se tall.ts). Det skissene viser som datamotoren ikke har ennå, står tomt, med et
   merke som sier hva som trengs. Kartlagene og tallene som ikke er i skissene (dagens arealklasser, planlagt utbygging, naturskog og
   listene over områdene), er beholdt. */
import { useState, type ReactNode } from 'react';
import { app } from '../../src/data/motor/tilstand.ts';
import { INONSONER } from '../../src/data/solv/inon.ts';
import { GRAATRINN } from '../../src/data/solv/graa.ts';
import { NATURTEMA, VERNEFORMGRUPPER } from '../../src/data/solv/temaer.ts';
import { andelTekst, antallOrd, dekar, iTekst, nf, pst } from '../../src/ui/tekst.ts';
import { MdCheckbox } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import Tabell from '../komponenter/Tabell.tsx';
import {
  Brodsmuler,
  Figur,
  Fremhevet,
  Helt,
  Kake,
  Liggende,
  NestePerspektiv,
  Ressurser,
  Sporsmal,
  Stolper,
  Tallkort,
  Trekkspill,
  svar
} from '../komponenter/deler.tsx';
import {
  graaIVillrein,
  gronneArealer,
  inonIVillrein,
  verdsattVurderes,
  planPerOkosystem,
  skog as skogen,
  vatmark as vatmarken,
  verdsattPerNaturtype,
  vernPerVerneform,
  vernetNatur,
  villreinPerOmrade,
  graa,
  graaIPlan,
  inon,
  kartleggingen,
  naturtema
} from '../tall.ts';
import { temaet, type Tema } from '../temaer.ts';
import { GRAALAG, SKOGLAG, VATMARKLAG, VERDILAG, VERNEFORMFARGE, VERNLAG } from '../kartlag.ts';
import { KILDE } from '../../src/data/katalog.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const iDagens = (side: string) => `../#${app.valgt ? app.valgt.nr : ''}${side ? '/' + side : ''}`;
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');
/* Merket på trekkspill og figurer som mangler kilde */
const MANGLER_KILDE = 'Mangler kilde';

interface Temasideinnhold {
  tema: Tema;
  trekkspill?: ReactNode;
  kort: [string, ReactNode][];
  kilde: ReactNode;
  fremhevet?: ReactNode;
  lag: Kartlag[];
  lagEtter?: ReactNode;
  children?: ReactNode;
  sporsmal: [string, ReactNode][];
  ressurser: [string, string][];
}
/* Malen for en temaside */
function Temaside(p: Temasideinnhold) {
  return (
    <>
      <div className="innhold">
        <Brodsmuler tema={p.tema} />
        <Helt tema={p.tema}>{p.trekkspill}</Helt>
        <Tallkort kort={p.kort} />
        <div className="trekkspill-liste etter-tallkort">
          <Trekkspill tittel="Hvor er tallene hentet fra?">{p.kilde}</Trekkspill>
        </div>
        {p.fremhevet}
      </div>
      <Kart key={p.tema.id} lag={p.lag} etter={p.lagEtter} />
      <div className="innhold">
        {p.children}
        <Sporsmal liste={p.sporsmal} />
        <Ressurser lenker={p.ressurser} />
        <NestePerspektiv />
      </div>
    </>
  );
}

/* Planlagt utbygging i et naturtema, som fremhevet melding */
function PlanITema({ plan, hva }: { plan: ReturnType<typeof naturtema>['plan']; hva: string }) {
  const T = naturtema(hva === 'verneområder' ? 'vern' : hva === 'villreinområder' ? 'rein' : 'verdi').T;
  if (T.s !== 'ok' || !T.v.antall) return null;
  return (
    <Fremhevet>
      {plan ? (
        plan.planKm2 > 0 ? (
          <>
            <b>
              Planlagt utbygging i {hva}: ca. {iTekst(plan.planKm2)}
            </b>
            <span>
              I {antallOrd(plan.berort, hva === 'verdsatt natur' ? 'én' : 'ett')} av{' '}
              {hva === 'verdsatt natur' ? 'lokalitetene' : 'områdene'}, etter kommuneplanen{' '}
              {app.valgt ? `for ${app.valgt.navn}` : ''}. Smale striper er ikke med.
            </span>
          </>
        ) : (
          <b>Kommuneplanen har ingen utbygging i {hva}.</b>
        )
      ) : (
        <span>Planlagt utbygging i {hva} regnes ut når kartet for kommunen er hentet.</span>
      )}
    </Fremhevet>
  );
}

/* Kilden til lagene fra grunnkartet, i lagvelgeren */
const GK = 'Grunnkart for arealanalyse';
/* Kilden for tallene fra grunnkartet med detaljklassene */
const GRUNNKART_KILDE = (
  <p>
    {KILDE.grunnkart.navn}, {KILDE.grunnkart.datasett}. Tallene er regnet ut fra grunnkartet på 10 meter, klippet til
    kommunen. Andelen er av landarealet i grunnkartet, det vil si alt unntatt hav, innsjøer og elver. For noen kommuner
    er grunnkartet lagret sammen med siden. For de andre hentes det fra NIBIO når siden vises, og da tar det litt tid.
  </p>
);
/* Trekkspillene under figurene om skog og våtmark */
const OVERLAPP = (
  <>
    <Trekkspill tittel="Hvorfor overlapper verdiene?">
      <p>
        Tresatt myr og tresatt innmarksbeite er skog i grunnkartet, men myr og jordbruk i arealdekket. Derfor står
        tresatt myr både i tallene for skog og for våtmark.
      </p>
    </Trekkspill>
    <Trekkspill tittel="Hvordan brukes dataene i grafen?">
      <p>
        Hver bit er arealet i grunnkartet for kommunen, i dekar, og andelen av det samlede arealet i figuren. Arealet er
        regnet ut fra grunnkartet på 10 meter, klippet til kommunen.
      </p>
    </Trekkspill>
  </>
);
const TRESATT_MED = (tittel: string) => (
  <div className="trekkspill-liste">
    <Trekkspill tittel={tittel}>
      <p>
        I grunnkartet er myr og innmarksbeite med trær skog. De er likevel myr og jordbruk i arealdekket, og har mye av
        naturen og karbonet til myra og beitet. Derfor vises de som egne lag.
      </p>
    </Trekkspill>
  </div>
);

function Skog({ tema }: { tema: Tema }) {
  const S = skogen(),
    V = vernetNatur();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om skog">
            <p>
              Tallene er skog i grunnkartet fra NIBIO: økosystemtypen skog, også skog på myr og på innmarksbeite, delt
              etter treslaget som dominerer. Kartet viser skogen og skogtypene fra grunnkartet.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Dette får vi fra skogen (økosystemtjenester)" merke="–">
            <p>Hvilke økosystemtjenester skogen gir, og hvor mange, mangler kilde ennå.</p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Skog i kommunen', svar(S, s => iTekst(s.km2))],
        ['Andel av landarealet som er skog', svar(S, s => prosent(s.andel))],
        ['Skog som er vernet', svar(V, v => iTekst(v.skog))]
      ]}
      kilde={GRUNNKART_KILDE}
      lag={[
        { id: 'skog', navn: 'Økosystemtype skog', kilde: GK, farger: [['Skog', 'skog']], ol: SKOGLAG.skog, av: true },
        {
          id: 'skogtyper',
          navn: 'Skogtyper',
          kilde: GK,
          farger: [
            ['Blandingsskog', 'skog-bland'],
            ['Barskog', 'skog-bar'],
            ['Lauvskog', 'skog-lauv']
          ],
          ol: SKOGLAG.skogtyper
        },
        { id: 'myr', navn: 'Tresatt myr', kilde: GK, farger: [['Tresatt myr', 'myr-tresatt']], ol: SKOGLAG.myr },
        {
          id: 'beite',
          navn: 'Tresatt innmarksbeite',
          kilde: GK,
          farger: [['Tresatt innmarksbeite', 'beite-tresatt']],
          ol: SKOGLAG.beite
        },
        {
          id: 'naerhet',
          navn: 'Naturskogsnærhet',
          kilde: 'Naturskog (v1), Miljødirektoratet',
          farger: [
            ['Lav', 'ns-lav'],
            ['Høy', 'ns-hoy']
          ],
          ol: SKOGLAG.naerhet,
          av: true
        },
        {
          id: 'for1940',
          navn: 'Skog etablert før 1940, ikke flatehogd',
          kilde: 'Naturskog (v1), Miljødirektoratet',
          farger: [['Før 1940, ikke flatehogd', 'ns-1940']],
          ol: SKOGLAG.for1940,
          av: true
        },
        { ...KLASSER, av: true },
        { ...PLAN, av: true }
      ]}
      lagEtter={
        <>
          {S.s === 'mangler' && <p className="hint">Lagene fra grunnkartet kunne ikke lages for kommunen.</p>}
          {TRESATT_MED('Hvorfor er tresatt myr og tresatt innmarksbeite med?')}
        </>
      }
      sporsmal={[
        [
          'Hvorfor er ikke tallene for skog de samme som hos SSB?',
          <p>
            SSB har egne arealklasser, mens tallene her er NIBIOs grunnkart for arealanalyse, med økosystemtyper. De to
            deler arealet inn på ulike måter, så de gir ikke helt samme areal for skog.
          </p>
        ],
        [
          'Hvorfor er naturskog med i kartet?',
          <p>
            Kartet over naturskog fra Miljødirektoratet viser skog som har fått utvikle seg lenge uten flatehogst. Det
            er med som to lag, av til du slår dem på. Laget for naturtyper i skog venter på Naturkart, et heldekkende
            kart over naturtyper som ikke er klart ennå.
          </p>
        ]
      ]}
      ressurser={[
        ['SSB, tabell 09594', KILDE.ssb.adresse],
        ['Grunnkart for arealanalyse', KILDE.grunnkart.adresse],
        ['Kommunen i dagens løsning', iDagens('')]
      ]}
    >
      <Figur
        tittel={`Typer skog i ${kommunen()}`}
        tekst={
          <p>
            Skogen i kommunen deles inn etter hvilke typer treslag som dominerer. Det er vanlig å skille mellom barskog
            og lauvskog. I barskogen er gran og furu de viktigste treslagene, mens i lauvskogen vokser ulike typer
            lauvtrær. Enkelte steder finner du både bartrær og lauvtrær i samme skog. Mange arter av sopp, lav og andre
            artsgrupper er avhengige av skogen og er tilpasset spesifikke treslag. Derfor gir kunnskap om hvilke treslag
            og skogtyper vi har i kommunen viktig informasjon om naturmangfoldet.
          </p>
        }
        kilder={['grunnkart']}
      >
        {svar(S, s => (
          <Stolper
            hva="Skog etter treslag"
            data={[...s.treslag]
              .sort((a, b) => b.km2 - a.km2)
              .map(t => ({ navn: t.navn, km2: t.km2, farge: 'skog-' + t.id }))}
          />
        ))}
      </Figur>
      <Figur
        tittel={`Dette dekker skogen i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hva skogarealet i {kommunen()} står på: fastmark, myr eller innmarksbeite. Jo større en sektor
            er, desto større del av skogarealet dekker den.
          </p>
        }
        kilder={['grunnkart']}
        etter={OVERLAPP}
      >
        {svar(S, s => (
          <Kake
            hva="Skog i grunnkartet etter underlag"
            data={s.underlag.map(u =>
              u.id === 'vanlig'
                ? { navn: 'Skog på fastmark', km2: u.km2, farge: 'kake-graa' }
                : { navn: u.navn, km2: u.km2, farge: u.id === 'myr' ? 'myr-tresatt' : 'beite-tresatt', prikker: true }
            )}
          />
        ))}
      </Figur>
    </Temaside>
  );
}

/* Våtmark som er planlagt nedbygget, som fremhevet melding: åpen våtmark og tresatt myr satt av til utbygging */
function VatmarkIPlan({ P }: { P: ReturnType<typeof planPerOkosystem> }) {
  if (P.s === 'mangler') return null;
  if (P.s !== 'ok')
    return (
      <Fremhevet>
        <span>
          {P.s === 'ingen'
            ? 'Kommunen har ingen kommuneplan med utbygging hos DiBK.'
            : P.s === 'feil'
              ? 'Planlagt utbygging i våtmark kunne ikke regnes ut.'
              : 'Planlagt utbygging i våtmark regnes ut når kartet for kommunen er hentet.'}
        </span>
      </Fremhevet>
    );
  const { km2, apen, tresatt } = P.v.vatmark;
  return (
    <Fremhevet>
      {km2 > 0 ? (
        <>
          <b>Våtmark som er planlagt nedbygget: ca. {iTekst(km2)}</b>
          <span>
            {iTekst(apen)} åpen våtmark og {iTekst(tresatt)} tresatt myr, etter kommuneplanen
            {app.valgt ? ` for ${app.valgt.navn}` : ''}. Smale striper er ikke med.
          </span>
        </>
      ) : (
        <b>Kommuneplanen har ingen utbygging i våtmark.</b>
      )}
    </Fremhevet>
  );
}

function Vatmark({ tema }: { tema: Tema }) {
  const W = vatmarken(),
    P = planPerOkosystem();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Hva betyr verdiene?">
            <p>
              Tallene er våtmark i grunnkartet fra NIBIO: økosystemtypen våtmark, som er åpen myr og annen åpen våtmark,
              og tresatt myr.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Potensielle økosystemtjenester fra våtmark" merke="–">
            <p>Hvilke økosystemtjenester våtmarken gir, mangler kilde ennå.</p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Våtmark i kommunen', svar(W, w => iTekst(w.km2))],
        ['Andel av landarealet som er våtmark', svar(W, w => prosent(w.andel))]
      ]}
      kilde={GRUNNKART_KILDE}
      fremhevet={<VatmarkIPlan P={P} />}
      lag={[
        {
          id: 'vatmark',
          navn: 'Økosystemtype våtmark (myr)',
          kilde: GK,
          farger: [['Åpen myr og annen åpen våtmark', 'myr-apen']],
          ol: VATMARKLAG.apen
        },
        {
          id: 'tresatt',
          navn: 'Tresatt myr',
          kilde: GK,
          farger: [['Tresatt myr', 'myr-tresatt']],
          ol: VATMARKLAG.tresatt
        },
        { ...KLASSER, av: true },
        { ...PLAN, av: true }
      ]}
      lagEtter={
        <>
          {W.s === 'mangler' && <p className="hint">Lagene fra grunnkartet kunne ikke lages for kommunen.</p>}
          {TRESATT_MED('Hvorfor er tresatt myr med?')}
        </>
      }
      sporsmal={[
        [
          'Hvorfor er tresatt myr med i våtmarken?',
          <p>
            Grunnkartet regner myr med trær som skog. Skissene har den med i våtmarken, så her telles den både i
            våtmarken og i skogen.
          </p>
        ],
        [
          'Hvorfor mangler naturtyper i våtmark i kartet?',
          <p>
            Laget for naturtyper i våtmark venter på Naturkart, et heldekkende kart over naturtyper som ikke er klart
            ennå.
          </p>
        ]
      ]}
      ressurser={[
        ['Grunnkart for arealanalyse', KILDE.grunnkart.adresse],
        ['Kommunen i dagens løsning', iDagens('')]
      ]}
    >
      <Figur
        tittel={`Dette dekker våtmarken i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hva som dekker våtmarksarealet i kommunen. Mye av våtmarka har trær, enten som skog eller som
            myr med spredte trær. Jo større en sektor er, desto større del av våtmarksarealet dekker den.
          </p>
        }
        kilder={['grunnkart']}
        etter={OVERLAPP}
      >
        {svar(W, w => (
          <Kake
            hva="Våtmark i grunnkartet"
            data={[
              { navn: 'Våtmark i grunnkartet', km2: w.apen, farge: 'kake-vatmark' },
              { navn: 'Tresatt myr', km2: w.tresatt, farge: 'kake-myr', prikker: true }
            ]}
          />
        ))}
      </Figur>
    </Temaside>
  );
}

/* Verneformen slik Miljødirektoratet skriver den (MarintVerneomraade), som vanlig tekst (Marint verneområde) */
const verneform = (v: unknown) =>
  String(v || 'Uten verneform')
    .replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2')
    .toLowerCase()
    .replace(/omraade/g, 'område')
    .replace(/^./, c => c.toUpperCase());
/* Hvordan lokalitetene som vurderes, fordeler seg på per lokalitet og per naturtype, som slutten av en setning */
function vurderesTekst(v: { klasser: number[] }) {
  const [lok, typ] = v.klasser;
  if (lok > 0 && typ > 0) return `: ${iTekst(lok)} vurderes per lokalitet og ${iTekst(typ)} per naturtype`;
  return lok > 0 ? ', som alle vurderes per lokalitet' : ', som alle vurderes per naturtype';
}
/* Fargen for et hovedøkosystem i figuren om naturen som er vernet, som i skissene */
const OKOFARGE: Record<string, string> = {
  Skog: 'oko-skog',
  Våtmark: 'oko-vatmark',
  'Innsjøer og vannmagasiner': 'oko-innsjo',
  'Hei og buskmark': 'oko-hei',
  Grasmark: 'oko-gras',
  'Elver, bekker og kanaler': 'oko-elv',
  'Lite vegetert mark': 'oko-lite',
  'Kyststrender, svaberg og dyner': 'oko-kyst',
  'Dyrket mark': 'oko-dyrket',
  'Bebygd og opparbeidet areal': 'oko-bebygd',
  Hav: 'oko-hav',
  'Natur, uspesifisert': 'oko-annen',
  'Jordbruk, uspesifisert': 'oko-annen'
};

function Vern({ tema }: { tema: Tema }) {
  const { T, plan } = naturtema('vern'),
    v = T.s === 'ok' ? T.v : null,
    F = vernPerVerneform(),
    V = vernetNatur(),
    [hav, settHav] = useState(true);
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om verneområder">
            <p>
              Områdene er vernet etter naturmangfoldloven eller eldre lover. Verneformen sier hvor strenge reglene er:
              naturreservat er strengest, landskapsvernområde minst strengt.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Datagrunnlaget bak verneområder">
            <p>
              {KILDE.vern.datasett}, {KILDE.vern.navn}, med alle områdene som er vernet etter naturmangfoldloven og
              eldre lover.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Vernet natur i kommunen', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))],
        ['Andel av landarealet som er vernet', svar(V, x => prosent(x.andelLand))]
      ]}
      kilde={
        <p>
          {KILDE.vern.datasett}, {KILDE.vern.navn}. Arealet er den delen av hvert område som ligger i kommunen, også i
          sjø. Andelen er bare det vernede på land, av landarealet i grunnkartet. Der områder overlapper, telles arealet
          én gang.
        </p>
      }
      fremhevet={<PlanITema plan={plan} hva="verneområder" />}
      lag={[
        {
          id: 'verneformer',
          navn: 'Verneområder per verneform',
          kilde: 'Naturvernområder',
          farger: VERNEFORMGRUPPER.map(([id, navn]) => [navn, VERNEFORMFARGE[id]] as [string, string]),
          ol: VERNLAG.verneformer
        },
        { id: 'tema', navn: 'Verneområder', kilde: 'Naturvernområder', farger: [['Verneområde', 'vern']], av: true },
        {
          id: 'natur',
          navn: 'Naturen i verneområder',
          kilde: GK,
          farger: Object.entries(OKOFARGE),
          ol: VERNLAG.natur,
          av: true
        },
        { ...KLASSER, av: true },
        { ...PLAN, av: true }
      ]}
      lagEtter={
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hvordan deles verneområder inn?">
            <p>
              Verneområdene deles inn etter verneform, som nasjonalpark, naturreservat, landskapsvernområde og marint
              verneområde. Hvert område har sin egen verneforskrift.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva viser laget «Naturen i verneområder»?">
            <p>
              Laget viser grunnkartets økosystemtyper inne i verneområdene, med én farge per type, som i figuren over
              naturen som er vernet.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva er forskjellen på verneformene?">
            <p>
              Naturreservat har det strengeste vernet. Nasjonalparker verner store naturområder, og landskapsvernområder
              verner landskapet, der vanlig bruk ofte kan fortsette. Marine verneområder verner natur i sjø.
            </p>
          </Trekkspill>
        </div>
      }
      sporsmal={[
        [
          'Kan det bygges i et verneområde?',
          <p>
            Det avhenger av verneforskriften for hvert område. Planlagt utbygging i et verneområde betyr at
            kommuneplanen og vernet bør sees sammen.
          </p>
        ]
      ]}
      ressurser={[
        ['Naturvernområder, datasettet', KILDE.vern.adresse],
        ['Verneområdene i dagens løsning', iDagens('vern')]
      ]}
    >
      {v && v.antall > 0 && (
        <Figur
          tittel={`Slik er naturen vernet i ${kommunen()}`}
          tekst={
            <p>
              Figuren viser hvor mye areal som er vernet i {kommunen()}, fordelt på verneform. Det kan være nyttig å se
              fordelingen av verneformer, fordi forskjellige verneformer har ulike formål med vernet og ulikt
              restriksjonsnivå. For eksempel har naturreservater den strengeste formen for områdevern etter
              naturmangfoldloven.
            </p>
          }
          kilder={['vern']}
        >
          {svar(F, f => (
            <Stolper
              hva="Vernet areal per verneform"
              data={f.map(x => {
                return { navn: verneform(x.verneform), km2: x.km2, farge: VERNEFORMFARGE[x.gruppe] };
              })}
            />
          ))}
        </Figur>
      )}
      <Figur
        tittel={`Naturen som er vernet i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hva slags natur som er vernet i {kommunen()}, og hvor mye det er av hver type. Prosenten viser
            hvor stor del av det vernede arealet hver type utgjør. Verneområder kan også ha dyrket mark og bebyggelse,
            derfor er disse med i oversikten. Slå på laget «Naturen i verneområder» for å se hvor typene ligger.
          </p>
        }
        kilder={['grunnkart', 'vern']}
      >
        {svar(V, d => {
          if (d.sum <= 0) return <p>Kommunen har ingen verneområder.</p>;
          const rader = [...d.perOkosystem].filter(x => hav || x.navn !== 'Hav').sort((a, b) => b.km2 - a.km2),
            sum = rader.reduce((a, x) => a + x.km2, 0) || 1;
          return (
            <>
              <div className="figur-valg">
                <MdCheckbox label="Vis «hav» i oversikten" checked={hav} onChange={e => settHav(e.target.checked)} />
              </div>
              <Liggende
                hva="Vernet areal per økosystemtype"
                data={rader.map(x => ({ navn: x.navn, km2: x.km2, farge: OKOFARGE[x.navn] || 'oko-annen' }))}
                tekst={x => `${iTekst(x.km2)} (${andelTekst((x.km2 / sum) * 100)})`}
              />
            </>
          );
        })}
      </Figur>
      {v && v.antall > 0 && (
        <Figur
          tittel={`Verneområdene i ${kommunen()}`}
          tekst={<p>Alle verneområdene som ligger helt eller delvis i kommunen, med det største først.</p>}
          kilder={['vern']}
        >
          <Tabell
            hva="Verneområdene"
            kolonner={[
              { navn: 'Område' },
              { navn: 'Verneform' },
              { navn: 'I kommunen', tall: true },
              { navn: 'Faktaark' }
            ]}
            rader={[...v.omrader]
              .sort((a, b) => b.km2 - a.km2)
              .map(o => [
                o.navn,
                verneform(o.egenskaper.verneform),
                dekar(o.km2),
                o.url ? (
                  <a href={o.url} target="_blank" rel="noopener">
                    Åpne
                  </a>
                ) : (
                  ''
                )
              ])}
          />
        </Figur>
      )}
    </Temaside>
  );
}

function Verdi({ tema }: { tema: Tema }) {
  const { T, plan } = naturtema('verdi'),
    K = kartleggingen(),
    v = T.s === 'ok' ? T.v : null,
    kartlagt = K.s === 'ok' && K.v ? K.v.kartlagt : null,
    klasser = NATURTEMA.find(t => t.id === 'verdi')!.klasser!,
    VV = verdsattVurderes(),
    vv = VV.s === 'ok' && VV.v.omrader.length ? VV.v : null;
  const [bareHoy, settBareHoy] = useState(false),
    N = verdsattPerNaturtype(),
    typer = N.s === 'ok' ? (bareHoy ? N.v.hoy : N.v.alle) : [];
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Hvilke naturtyper er verdsatte?">
            <p>
              Alle naturtyper som er kartlagt etter Miljødirektoratets instruks, får en verdi. Her er alle lokalitetene
              med verdi med, fra noe verdi til svært stor verdi.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hvordan kartlegges det etter Miljødirektoratets instruks?">
            <p>
              Naturtypene kartlegges i felt etter Miljødirektoratets instruks, og hver lokalitet får en verdi fra noe
              verdi til svært stor verdi. Bare deler av landet er kartlagt.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Andel av kommunen kartlagt', svar(K, x => (x && x.kartlagt ? prosent(x.kartlagt.andelLand) : '–'))],
        ['Kartlagte verdsatte naturtyper', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))]
      ]}
      kilde={
        <p>
          {KILDE.verdsatt.datasett} og {KILDE.nin.datasett}, {KILDE.verdsatt.navn}. Bare lokaliteter med verdi er med.
        </p>
      }
      fremhevet={
        <>
          {kartlagt && kartlagt.andelLand !== null && kartlagt.andelLand < 99.5 && (
            <Fremhevet varsel>
              <b>Datasettet er ikke heldekkende, bare {prosent(kartlagt.andelLand)} er kartlagt</b>
              <span>
                Det vil si at kartleggingen kan være mangelfull i din kommune. Tomme områder i kartet betyr ikke
                nødvendigvis at det ikke finnes verdifull natur der, det er bare at ingen har sjekket der enda.
              </span>
              <span>
                Risikoen med mangelfull kartlegging i kommunen kan være at de tomme områdene blir oversett eller
                undervurdert.
              </span>
            </Fremhevet>
          )}
          <PlanITema plan={plan} hva="verdsatt natur" />
        </>
      }
      lag={[
        {
          id: 'tema',
          navn: 'Verdsatte naturtyper',
          kilde: 'Naturtyper – verdsatte',
          farger: klasser.map(([navn, farge]) => [navn, farge] as [string, string])
        },
        {
          id: 'vurderes',
          navn: 'Verdsatt natur som vurderes',
          kilde: 'Naturtyper – verdsatte',
          farger: [
            ['Vurderes per lokalitet', 'vurderes1'],
            ['Vurderes per naturtype', 'vurderes2']
          ],
          ol: VERDILAG.vurderes,
          av: true
        },
        {
          id: 'dekning',
          navn: 'Dekningskart for kartlegging',
          kilde: 'Naturtyper på land (NiN)',
          farger: [['Ikke kartlagt (slør)', 'slor-merke']]
        },
        { ...KLASSER, av: true },
        { ...PLAN, av: true }
      ]}
      lagEtter={
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hva betyr verdiene?">
            <p>
              Verdien sier hvor viktig lokaliteten er: svært stor og stor verdi er av nasjonal eller vesentlig regional
              betydning, middels og noe verdi er av mer lokal betydning.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva er verdsatt natur som vurderes?">
            <p>
              Noen lokaliteter har ikke fått en verdi fra noe verdi til svært stor verdi, men skal vurderes per
              lokalitet eller per naturtype. De er ikke med i tallene for verdsatt natur, men kan vises som eget lag.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hva er dekningskart?">
            <p>
              Dekningskartet viser hvor det er kartlagt naturtyper etter Miljødirektoratets instruks. Det som ikke er
              kartlagt, har et lyst slør i kartet.
            </p>
          </Trekkspill>
        </div>
      }
      sporsmal={[
        [
          'Hvorfor bør man passe på verdsatte naturtyper?',
          <p>
            Lokaliteter med stor og svært stor verdi er av nasjonal eller vesentlig regional betydning, og er særlig
            viktige i arealplanleggingen.
          </p>
        ]
      ]}
      ressurser={[
        ['Naturtyper – verdsatte, datasettet', KILDE.verdsatt.adresse],
        ['Naturtyper på land (NiN), dekningskartet', KILDE.nin.adresse],
        ['Verdsatt natur i dagens løsning', iDagens('verdi')]
      ]}
    >
      {v && v.perKlasse && (
        <Figur
          tittel="Fordeling av verdiene"
          tekst={
            <p>
              Det er flere faktorer som bestemmer hvilken verdi en naturtype får, det avhenger blant annet av:
              naturtypelokalitetens kvalitet, om naturtypen er en utvalgt naturtype etter naturmangfoldloven, om
              naturtypen har en sentral økosystemfunksjon, om den er truet, nær truet eller har status som spesielt
              dårlig kartlagt på rødlista for naturtyper.
            </p>
          }
          kilder={['verdsatt']}
          etter={
            <Trekkspill tittel="Hva betyr verdiene?">
              <p>
                Svært stor og stor verdi er av nasjonal eller vesentlig regional betydning. Middels og noe verdi er av
                mer lokal betydning. Lokaliteter som vurderes per lokalitet eller per naturtype, er ikke med i figuren.
                {vv
                  ? ` I ${kommunen()} gjelder det ${antallOrd(vv.omrader.length)} ${vv.omrader.length === 1 ? 'lokalitet' : 'lokaliteter'} med til sammen ${iTekst(vv.sum)}${vurderesTekst(vv)}. De kan vises som eget lag i kartet.`
                  : VV.s === 'ok'
                    ? ` ${kommunen()} har ingen slike lokaliteter.`
                    : ''}
              </p>
            </Trekkspill>
          }
        >
          <Stolper
            hva="Areal per verdikategori"
            data={klasser.map(([navn, farge], i) => ({ navn, km2: v.perKlasse![i].km2, farge }))}
          />
        </Figur>
      )}
      {v && v.antall > 0 && (
        <Figur
          tittel={`Verdsatte naturtyper funnet i ${kommunen()}`}
          tekst={
            <>
              <p>
                Miljødirektoratet regner over 120 naturtyper som verdsatte. Listen viser hvilke av dem som er funnet i
                kommunen og hvor mye det er av hver.
              </p>
              <p>
                Tallene gjelder bare det som er kartlagt. Verken kommunen eller resten av landet er ferdig kartlagt, så
                det kan finnes mer enn det listen viser. Andelen av det som er kartlagt i Norge krever en dataplattform,
                og står tom.
              </p>
            </>
          }
          kilder={['verdsatt']}
          etter={
            <>
              <Trekkspill tittel="Hva betyr det å ha mye av en naturtype?">
                <p>
                  Har kommunen mye av en naturtype, har den et særlig ansvar for den. Det gjelder særlig naturtyper som
                  er sjeldne eller truet.
                </p>
              </Trekkspill>
              <Trekkspill tittel="Hvordan er dataene brukt i tabellen?">
                <p>
                  Arealet er summen av lokalitetene med naturtypen i kommunen, klippet mot kommunen. Arealet i Norge
                  krever kartdata for alle kommuner.
                </p>
              </Trekkspill>
            </>
          }
        >
          <MdCheckbox
            label="Vis kun stor og svært stor verdi"
            checked={bareHoy}
            onChange={e => settBareHoy(e.target.checked)}
          />
          <Tabell
            hva="Naturtypene"
            kolonner={[
              { navn: 'Nr', tall: true },
              { navn: 'Naturtype' },
              { navn: `Dekar ${kommunen()}`, tall: true },
              { navn: 'Andel av kartlagt i Norge', tall: true, ikkeMobil: true }
            ]}
            rader={typer.map((t, i) => [
              String(i + 1),
              <span className="med-farge">
                <i style={{ background: `var(--${klasser[t.v][1]})` }} title={klasser[t.v][0]} />
                {t.navn}
              </span>,
              dekar(t.km2, 'dekar'),
              <span className="tom-celle" title="Krever dataplattform">
                –
              </span>
            ])}
          />
        </Figur>
      )}
    </Temaside>
  );
}

function Inon({ tema }: { tema: Tema }) {
  const I = inon();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om inngrepsfri natur">
            <p>
              Inngrepsfri natur er områder som ligger minst én kilometer fra tyngre tekniske inngrep. Miljødirektoratet
              har status for 1988, 2008, 2013, 2018 og 2023.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Hvordan inngrepsfri natur deles inn">
            <p>
              Inngrepsfri natur deles i tre soner etter avstanden til nærmeste tyngre tekniske inngrep: sone 2 (1–3 km),
              sone 1 (3–5 km) og villmarkspreget natur (5 km eller mer).
            </p>
          </Trekkspill>
          <Trekkspill tittel="Datagrunnlaget bak inngrepsfri natur">
            <p>
              {KILDE.inon.datasett}, {KILDE.inon.navn}. Arealet er regnet ut fra et bilde av kommunen med ruter på noen
              titalls meter.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Inngrepsfri natur i kommunen', svar(I, x => iTekst(x.sum), 'Ingen')],
        ['Andel av landarealet', svar(I, x => prosent(x.andelLand), '0 %')]
      ]}
      kilde={
        <p>
          {KILDE.inon.datasett}, {KILDE.inon.navn}. Arealet er regnet ut fra et bilde av kommunen med ruter på noen
          titalls meter. Andelen er av landarealet.
        </p>
      }
      lag={[
        {
          id: 'tema',
          navn: 'Inngrepsfri natur',
          kilde: 'Inngrepsfri natur i Norge',
          farger: [2, 1, 0].map(i => [INONSONER[i][4], INONSONER[i][1]] as [string, string])
        },
        { ...KLASSER, av: true },
        { ...PLAN, av: true }
      ]}
      sporsmal={[
        [
          'Kan inngrepsfri natur krysses med planlagt utbygging?',
          <p>
            Ikke slik de andre temaene kan. Sonene følger avstanden til inngrep, så et nytt inngrep kan flytte grensene
            flere kilometer, også utenfor der det bygges.
          </p>
        ]
      ]}
      ressurser={[
        ['Inngrepsfri natur i Norge, datasettet', KILDE.inon.adresse],
        ['Inngrepsfri natur i dagens løsning', iDagens('inon')]
      ]}
    >
      {I.s === 'ok' && (
        <Figur
          tittel={`Den inngrepsfrie naturen i ${kommunen()} fordelt i soner`}
          tekst={
            <p>
              Figuren viser hvor mye inngrepsfri natur det er i {kommunen()}, delt inn etter avstand til nærmeste
              inngrep. Det er sjelden mulig å reversere slike inngrep, så når inngrepsfri natur først er tapt, er den
              som regel borte for godt.
            </p>
          }
          kilder={['inon']}
        >
          <Stolper
            hva="Inngrepsfri natur per sone"
            data={[2, 1, 0].map(i => ({
              navn: INONSONER[i][4],
              under: `(${INONSONER[i][3]})`,
              km2: I.v.soner[i],
              farge: INONSONER[i][1]
            }))}
          />
        </Figur>
      )}
      <Figur
        tittel={`Slik har den inngrepsfrie naturen endret seg i ${kommunen()}`}
        tekst={
          <p>
            Figuren viser hvordan arealet med inngrepsfri natur i {kommunen()} har endret seg siden 1988.
            Miljødirektoratet har oppdatert status for inngrepsfri natur hvert femte år siden 2008. Når arealet blir
            mindre, skyldes det nye inngrep som veier, kraftlinjer eller vannkraftutbygging.
          </p>
        }
        kilder={['inon']}
        merke="Kilde finnes"
        tom="Miljødirektoratets kart over inngrepsfri natur for 1988, 2008, 2013, 2018 og 2023. De finnes i det samme datasettet, men er ikke koblet."
      />
      <Figur
        tittel="Endringer per sone"
        tekst={
          <>
            <p>
              Figuren viser hvordan arealet i hver sone har endret seg i hver femårsperiode. Søyler over null betyr at
              sonen har blitt større, og søyler under null betyr at den har blitt mindre.
            </p>
            <p>
              Når det kommer et nytt inngrep, flytter naturen rundt seg ned en sone: villmark blir til sone 1, sone 1
              blir til sone 2, og sone 2 blir til inngrepsnær natur, som ligger mindre enn én kilometer fra et inngrep.
            </p>
          </>
        }
        kilder={['inon']}
        merke="Kilde finnes"
        tom="de samme kartene for tidligere år."
      />
    </Temaside>
  );
}

function Rein({ tema }: { tema: Tema }) {
  const { T, plan } = naturtema('rein'),
    v = T.s === 'ok' ? T.v : null,
    R = villreinPerOmrade(),
    IV = inonIVillrein(),
    GV = graaIVillrein();
  const kommunenavn = (s: unknown) =>
    String(s || '')
      .split(',')
      .map(x => x.replace(/\s*\(\d+\)\s*/, '').trim())
      .filter(Boolean)
      .join(', ');
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <>
          <Trekkspill tittel="Mer om villreinområder">
            <p>
              Villreinområdene er fjellområdene der villreinen lever og trekker. Et område strekker seg ofte over flere
              kommuner.
            </p>
          </Trekkspill>
          <Trekkspill tittel="Datagrunnlaget bak villreinområder">
            <p>
              {KILDE.villrein.datasett}, {KILDE.villrein.navn}. Arealet er den delen av hvert område som ligger i
              kommunen.
            </p>
          </Trekkspill>
        </>
      }
      kort={[
        ['Villreinområder i kommunen', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))],
        ['Andel av landarealet som er villreinområde', svar(T, x => prosent(x.andelLand))],
        [
          'Andel villreinområde som er inngrepsfri natur',
          <span className="tallkort-to">
            <b>{svar(IV, x => prosent(x!.andel), 'Ingen villreinområder')}</b>
            <span className="tallkort-etikett">Andel villreinområde som er grå arealer</span>
            <b>{svar(GV, x => (x!.andel === null ? '–' : andelTekst(x!.andel)), 'Ingen villreinområder')}</b>
          </span>
        ]
      ]}
      kilde={
        <p>
          {KILDE.villrein.datasett}, {KILDE.villrein.navn}. Arealet er den delen av hvert område som ligger i kommunen.
          Grått areal i villreinområdene er fra {KILDE.graa.datasett}, {KILDE.graa.navn}, i ruter på 10 meter: hver rute
          teller med den delen av den som ligger i villreinområdene.
        </p>
      }
      fremhevet={<PlanITema plan={plan} hva="villreinområder" />}
      lag={[
        { id: 'tema', navn: 'Villreinområder', kilde: 'Villreinområder', farger: [['Villreinområde', 'rein']] },
        {
          id: 'graa',
          navn: 'Grått areal',
          kilde: KILDE.graa.datasett,
          farger: [['Grått areal', 'graa0']],
          ol: GRAALAG.graa
        },
        { ...KLASSER, av: true },
        { ...PLAN, av: true }
      ]}
      lagEtter={
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hva er sammenhengen mellom villreinområder og grå areal?">
            <p>
              Grått areal er areal som er tatt i bruk, som veier, hytter og anlegg. Villreinen holder seg unna slike
              inngrep, så grått areal i villreinområdene gjør området mindre brukbart for villreinen. Laget «Grått
              areal» viser det grå arealet i hele kommunen, sammen med villreinområdene.
            </p>
          </Trekkspill>
        </div>
      }
      sporsmal={[
        [
          'Hvorfor har Norge et særlig ansvar for villreinen?',
          <p>
            De siste gjenværende bestandene av vill fjellrein i Europa lever i Norge. Derfor har Norge et særlig ansvar
            for å ta vare på dem og områdene de lever i.
          </p>
        ],
        [
          'Hva betyr villreinområder for kommunens arealplanlegging?',
          <p>
            Villreinen er sky og trenger store områder uten inngrep. Utbygging i og nær villreinområdene kan stenge
            trekkveier og gjøre beiter mindre brukt.
          </p>
        ]
      ]}
      ressurser={[
        ['Villreinområder, datasettet', KILDE.villrein.adresse],
        ['Villrein i dagens løsning', iDagens('rein')]
      ]}
    >
      {v && v.antall > 0 && (
        <Figur
          tittel={`${kommunen()}s villreinområder`}
          tekst={
            <p>
              Tabellen viser villreinområdene som ligger helt eller delvis i {kommunen()}. Et villreinområde strekker
              seg ofte over flere kommuner. Dekar og andel viser hvor mye av området som ligger i kommunen. Tilstanden
              etter kvalitetsnormen for villrein mangler kilde, og står tom.
            </p>
          }
          kilder={['villrein']}
        >
          <Tabell
            hva="Villreinområdene"
            kolonner={[
              { navn: 'Område' },
              { navn: 'Dekar', tall: true },
              { navn: 'Andel (%)', tall: true, ikkeMobil: true },
              { navn: 'Kommuner', ikkeMobil: true },
              { navn: 'Tilstand', tall: true },
              { navn: 'Faktaark', tall: true }
            ]}
            rader={(R.s === 'ok' ? R.v : []).map(o => [
              o.navn,
              nf(o.km2 * 1000, 0),
              prosent(o.andel),
              kommunenavn(o.kommuner),
              <span className="tom-celle" title={MANGLER_KILDE}>
                –
              </span>,
              o.url ? (
                <a href={o.url} target="_blank" rel="noopener">
                  Åpne
                </a>
              ) : (
                ''
              )
            ])}
          />
        </Figur>
      )}
      {IV.s === 'ok' && IV.v ? (
        <Figur
          tittel="Inngrepsfri natur i villreinområdene"
          tekst={
            <>
              <p>
                Villrein er sky og holder seg unna veier, hytter, kraftlinjer og andre inngrep. Derfor trenger
                villreinen store områder uten slike inngrep. Inngrepsfri natur er områder som ligger mer enn én
                kilometer fra tyngre tekniske inngrep.
              </p>
              <p>
                Figuren viser hvor mye inngrepsfri natur det er i villreinområdene i {kommunen()} i dag, per sone.
                Hvordan dette har endret seg over tid, krever kartene for tidligere år, som ikke er koblet.
              </p>
            </>
          }
          kilder={['inon', 'villrein']}
        >
          <Liggende
            hva="Inngrepsfri natur i villreinområdene per sone"
            data={INONSONER.map(([, farge, , , navn], i) => ({ navn, km2: IV.v!.soner[i], farge }))}
          />
          <p>
            {iTekst(IV.v.sum)} av {iTekst(IV.v.villrein)} villreinområde i kommunen er inngrepsfri natur.
          </p>
        </Figur>
      ) : (
        <Figur
          tittel="Inngrepsfri natur i villreinområdene"
          tekst={
            <p>Hvor mye av villreinområdene i kommunen som er inngrepsfri natur, og hvordan det har endret seg.</p>
          }
          kilder={['inon', 'villrein']}
        >
          <p>{svar(IV, () => '', 'Kommunen har ingen villreinområder.')}</p>
        </Figur>
      )}
    </Temaside>
  );
}

function Bynatur({ tema }: { tema: Tema }) {
  const G = graa(),
    GA = gronneArealer(),
    P = graaIPlan(),
    p = P ? P.plan : null;
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <Trekkspill tittel="Mer om bynaturen">
          <p>
            Kartet over grå arealer viser areal som er tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet,
            og hvor stor del av hver flate som er vegetasjon. Mye av det grå er likevel grønt.
          </p>
        </Trekkspill>
      }
      kort={[
        ['Grått areal i kommunen', svar(G, x => iTekst(x.sum))],
        ['Andel av landarealet', svar(G, x => prosent(x.andelLand))],
        ['Planlagt utbygging på grått areal', p ? prosent(p.andelGraa) : <span className="henter">Regnes ut …</span>]
      ]}
      kilde={
        <p>
          {KILDE.graa.datasett}, {KILDE.graa.navn}.
        </p>
      }
      lag={[
        {
          id: 'tema',
          navn: 'Grått areal',
          kilde: KILDE.graa.datasett,
          farger: [
            ...GRAATRINN.map(([farge, navn]) => [navn, farge] as [string, string]),
            ['Grønt i bebygd område', 'gront']
          ]
        },
        {
          id: 'gronne',
          navn: 'Grønne arealer i bebyggelse',
          kilde: KILDE.graa.datasett,
          farger: [['50–100 % vegetasjon', 'gronne-arealer']],
          ol: GRAALAG.gronne,
          av: true
        },
        KLASSER,
        PLAN
      ]}
      sporsmal={[
        [
          'Er utbygging på grått areal bra?',
          <p>
            Det er gjenbruk av areal som alt er tatt i bruk, og sparer annen natur. Men også grått areal kan ha mye
            vegetasjon, så gjenbruk kan ta grønt.
          </p>
        ]
      ]}
      ressurser={[
        ['Kart over grå arealer, datasettet', KILDE.graa.adresse],
        ['Grått areal i dagens løsning', iDagens('graa')]
      ]}
    >
      {G.s === 'ok' && (
        <Figur
          tittel="Grått areal etter andel vegetasjon"
          tekst={<p>Figuren viser det grå arealet i kommunen etter hvor stor del av hver flate som er vegetasjon.</p>}
          kilder={['graa']}
        >
          <Stolper
            hva="Grått areal per trinn"
            data={GRAATRINN.map(([farge, navn], i) => ({
              navn: navn.replace(' vegetasjon', ''),
              km2: G.v.trinn[i + 1],
              farge
            }))}
          />
        </Figur>
      )}
      {p && (
        <Fremhevet>
          <b>
            Av ca. {iTekst(p.km2)} planlagt utbygging på land ligger ca. {iTekst(p.graa)} ({prosent(p.andelGraa)}) på
            grått areal.
          </b>
          <span>Her er all planlagt utbygging med, også på bebygd areal og i smale striper.</span>
        </Fremhevet>
      )}
      <Figur
        tittel="Grønne arealer i bebyggelse"
        tekst={
          <p>
            Grønne arealer i bebyggelse er den delen av det grå arealet der minst halvparten av flaten er vegetasjon,
            som hager, parker og grøntområder mellom husene. De kan vises som eget lag i kartet.
          </p>
        }
        kilder={['graa']}
      >
        {svar(GA, x => (
          <p>
            {kommunen()} har ca. {iTekst(x.km2)} grønne arealer i bebyggelse. Det er {prosent(x.andelAvGraa)} av det grå
            arealet og {prosent(x.andelLand)} av landarealet.
          </p>
        ))}
      </Figur>
    </Temaside>
  );
}

const SIDER: Record<string, (p: { tema: Tema }) => ReactNode> = {
  skog: Skog,
  vatmark: Vatmark,
  verneomrader: Vern,
  'verdsatte-naturtyper': Verdi,
  'inngrepsfri-natur': Inon,
  villrein: Rein,
  bynatur: Bynatur
};
export default function Temasider({ id }: { id: string }) {
  const t = temaet(id)!,
    Side = SIDER[t.id];
  return <Side tema={t} />;
}
