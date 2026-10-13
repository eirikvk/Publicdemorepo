/* Temasidene under «Utforsk naturen», etter malen i Figma: brødsmuler, toppen med ingress og bilde, tallkort, kartet med lagvelgeren,
   figurer med tekst og kilde, ofte stilte spørsmål, ressurser og flisene til de andre temaene. Tallene kommer fra datamotoren (se
   tall.ts). Det skissene viser som datamotoren ikke har ennå, står i en ramme som sier hva som trengs. */
import { useState, type ReactNode } from 'react';
import { app } from '../../src/data/motor/tilstand.ts';
import { INONSONER } from '../../src/data/solv/inon.ts';
import { GRAATRINN } from '../../src/data/solv/graa.ts';
import { NATURTEMA } from '../../src/data/solv/temaer.ts';
import { antallOrd, dekar, iTekst, nf, pst } from '../../src/ui/tekst.ts';
import { MdCheckbox } from '../md.ts';
import Kart, { KLASSER, PLAN, type Kartlag } from '../komponenter/Kart.tsx';
import Tabell from '../komponenter/Tabell.tsx';
import {
  Brodsmuler,
  Figur,
  Fremhevet,
  Helt,
  Liggende,
  Mangler,
  NestePerspektiv,
  Ressurser,
  Sporsmal,
  Stolper,
  Tallkort,
  Trekkspill,
  svar
} from '../komponenter/deler.tsx';
import {
  GK_LAND,
  GK_SKOG,
  GK_VATMARK,
  detaljer,
  detaljsum,
  iGrunnkartet,
  inonIVillrein,
  perOkosystem,
  planIDetaljer,
  graa,
  graaIPlan,
  inon,
  kartleggingen,
  naturtema
} from '../tall.ts';
import { temaet, type Tema } from '../temaer.ts';
import { SKOGLAG } from '../kartlag.ts';
import { KILDE } from '../../src/data/katalog.ts';

const kommunen = () => (app.valgt ? app.valgt.navn : 'kommunen');
const iDagens = (side: string) => `../#${app.valgt ? app.valgt.nr : ''}${side ? '/' + side : ''}`;
const prosent = (a: number | null) => (a === null ? '–' : pst(a) + ' %');

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
        <div className="trekkspill-liste">
          <Trekkspill tittel="Hvor er tallene hentet fra?">{p.kilde}</Trekkspill>
        </div>
        {p.fremhevet}
      </div>
      <Kart key={p.tema.id} lag={p.lag} etter={p.lagEtter} />
      <div className="innhold">
        {p.children}
        <Sporsmal liste={p.sporsmal} />
        <Ressurser lenker={p.ressurser} />
        <NestePerspektiv unntatt={p.tema.id} />
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
const GK = 'Grunnkart for arealanalyse, NIBIO';
/* Kilden for tallene fra grunnkartet med detaljklassene */
const GRUNNKART_KILDE = (
  <p>
    {KILDE.grunnkart.navn}, {KILDE.grunnkart.datasett}. Tallene er regnet ut fra grunnkartet på 10 meter, klippet til
    kommunen. Andelen er av landarealet i grunnkartet, det vil si alt unntatt hav, innsjøer og elver. Foreløpig er det
    regnet ut bare for Trondheim.
  </p>
);

function Skog({ tema }: { tema: Tema }) {
  const D = detaljer(),
    skog = D.s === 'ok' ? iGrunnkartet(D.v, GK_SKOG) : null,
    V = detaljer('vern');
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <Trekkspill tittel="Mer om skog">
          <p>
            Tallene er skog i grunnkartet fra NIBIO: økosystemtypen skog, også skog på myr og på innmarksbeite, delt
            etter treslaget som dominerer. Kartet viser dagens arealklasser fra NIBIO, der skog er en del av naturen.
          </p>
        </Trekkspill>
      }
      kort={[
        ['Skog i kommunen', svar(D, () => iTekst(skog!.km2))],
        ['Andel av landarealet som er skog', svar(D, () => prosent(skog!.andel))],
        ['Skog som er vernet', svar(V, v => iTekst(detaljsum(v, GK_SKOG)))]
      ]}
      kilde={GRUNNKART_KILDE}
      lag={[
        {
          id: 'skog',
          navn: 'Økosystemtype skog',
          kilde: GK,
          farger: [['Skog', 'skog']],
          ol: SKOGLAG.skog,
          av: true
        },
        {
          id: 'skogtyper',
          navn: 'Skogtyper',
          kilde: GK,
          farger: [
            ['Barskog', 'skog-bar'],
            ['Blandingsskog', 'skog-bland'],
            ['Lauvskog', 'skog-lauv']
          ],
          ol: SKOGLAG.skogtyper
        },
        {
          id: 'tresatt',
          navn: 'Tresatt myr og innmarksbeite',
          kilde: GK,
          farger: [
            ['Tresatt myr', 'myr-tresatt'],
            ['Tresatt innmarksbeite', 'beite-tresatt']
          ],
          ol: SKOGLAG.tresatt
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
        PLAN
      ]}
      lagEtter={
        <>
          {D.s === 'mangler' && <p className="hint">Lagene fra grunnkartet finnes foreløpig bare for Trondheim.</p>}
          <p className="hint">
            Skissene har ett lag for naturskog. Kartet over naturskog har flere; her er to av dem. Laget for naturtyper
            i skog er ikke laget ennå.
          </p>
        </>
      }
      sporsmal={[
        [
          'Hvorfor er ikke tallene for skog de samme som hos SSB?',
          <p>
            SSB har egne arealklasser, mens tallene her er NIBIOs grunnkart for arealanalyse, med økosystemtyper. De to
            deler arealet inn på ulike måter, så de gir ikke helt samme areal for skog.
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
            Skogen i kommunen deles inn etter hvilke treslag som dominerer. Det er vanlig å skille mellom barskog og
            lauvskog. I barskogen er gran og furu de viktigste treslagene. Der begge vokser, er det blandingsskog.
          </p>
        }
        kilder={['grunnkart']}
      >
        {svar(D, d => (
          <Stolper
            hva="Skog etter treslag"
            data={[
              ['bar', 'Barskog', 'skog-bar'],
              ['bland', 'Blandingsskog', 'skog-bland'],
              ['lauv', 'Lauvskog', 'skog-lauv']
            ].map(([t, navn, farge]) => ({ navn, km2: detaljsum(d, k => k.treslag === t), farge }))}
          />
        ))}
      </Figur>
      <Figur
        tittel={`Dette dekker skogen i ${kommunen()}`}
        tekst={
          <p>
            Skogen i grunnkartet fra NIBIO står på fastmark, på myr eller på innmarksbeite. Myr og beite med trær er
            skog i grunnkartet, og er med i tallene for skog over.
          </p>
        }
        kilder={['grunnkart']}
      >
        {svar(D, d => (
          <>
            <Liggende
              hva="Skog i grunnkartet etter underlag"
              data={[
                ['vanlig', 'Skog på fastmark', 'skog-bar'],
                ['myr', 'Tresatt myr', 'myr-tresatt'],
                ['beite', 'Tresatt innmarksbeite', 'beite-tresatt']
              ].map(([u, navn, farge]) => ({ navn, km2: detaljsum(d, k => k.underlag === u), farge }))}
            />
            <p>Til sammen {iTekst(detaljsum(d, GK_SKOG))} skog.</p>
          </>
        ))}
      </Figur>
    </Temaside>
  );
}

/* Våtmark som er planlagt nedbygget, som fremhevet melding: åpen våtmark og tresatt myr satt av til utbygging */
function VatmarkIPlan({ P }: { P: ReturnType<typeof planIDetaljer> }) {
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
  const apen = detaljsum(P.v, k => k.id === 'vat'),
    tresatt = detaljsum(P.v, k => k.underlag === 'myr');
  return (
    <Fremhevet>
      {apen + tresatt > 0 ? (
        <>
          <b>Våtmark som er planlagt nedbygget: ca. {iTekst(apen + tresatt)}</b>
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
  const D = detaljer(),
    vat = D.s === 'ok' ? iGrunnkartet(D.v, GK_VATMARK) : null,
    P = planIDetaljer();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <Trekkspill tittel="Mer om våtmark">
          <p>
            Tallene er våtmark i grunnkartet fra NIBIO: økosystemtypen våtmark, som er åpen myr og annen åpen våtmark,
            og tresatt myr.
          </p>
        </Trekkspill>
      }
      kort={[
        ['Våtmark i kommunen', svar(D, () => iTekst(vat!.km2))],
        ['Andel av landarealet som er våtmark', svar(D, () => prosent(vat!.andel))]
      ]}
      kilde={GRUNNKART_KILDE}
      fremhevet={<VatmarkIPlan P={P} />}
      lag={[KLASSER, PLAN]}
      lagEtter={
        <p className="hint">Lagene for økosystemtypen våtmark og tresatt myr fra skissene er ikke laget ennå.</p>
      }
      sporsmal={[
        [
          'Hvorfor er tresatt myr med i våtmarken?',
          <p>
            Grunnkartet regner myr med trær som skog. Skissene har den med i våtmarken, så her telles den både i
            våtmarken og i skogen.
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
            Våtmarken i grunnkartet fra NIBIO: økosystemtypen våtmark, som er åpen myr og annen åpen våtmark, og tresatt
            myr. Grunnkartet regner tresatt myr som skog, så den står også på siden om skog.
          </p>
        }
        kilder={['grunnkart']}
      >
        {svar(D, d => {
          const apen = detaljsum(d, k => k.id === 'vat'),
            tresatt = detaljsum(d, k => k.underlag === 'myr');
          return (
            <>
              <Liggende
                hva="Våtmark i grunnkartet"
                data={[
                  { navn: 'Åpen våtmark', km2: apen, farge: 'myr-apen' },
                  { navn: 'Tresatt myr', km2: tresatt, farge: 'myr-tresatt' }
                ]}
              />
              <p>Til sammen {iTekst(apen + tresatt)}.</p>
            </>
          );
        })}
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
/* Arealet i kommunen per verneform, fra egenskapene til hvert verneområde */
function perVerneform(omrader: { km2: number; egenskaper: Record<string, unknown> }[]) {
  const m = new Map<string, number>();
  omrader.forEach(o => {
    const f = verneform(o.egenskaper.verneform);
    m.set(f, (m.get(f) || 0) + o.km2);
  });
  return [...m].sort((a, b) => b[1] - a[1]);
}

function Vern({ tema }: { tema: Tema }) {
  const { T, plan } = naturtema('vern'),
    v = T.s === 'ok' ? T.v : null,
    V = detaljer('vern'),
    D = detaljer();
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <Trekkspill tittel="Mer om verneområder">
          <p>
            Områdene er vernet etter naturmangfoldloven eller eldre lover. Verneformen sier hvor strenge reglene er:
            naturreservat er strengest, landskapsvernområde minst strengt.
          </p>
        </Trekkspill>
      }
      kort={[
        ['Vernet natur i kommunen', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))],
        ['Andel av landarealet som er vernet', svar(T, x => prosent(x.andelLand))],
        ['Antall verneområder', svar(T, x => nf(x.antall, 0))]
      ]}
      kilde={
        <p>
          {KILDE.vern.datasett}, {KILDE.vern.navn}. Arealet er den delen av hvert område som ligger i kommunen. Der
          områder overlapper, telles arealet én gang.
        </p>
      }
      fremhevet={<PlanITema plan={plan} hva="verneområder" />}
      lag={[
        { id: 'tema', navn: 'Verneområder', kilde: KILDE.vern.datasett, farger: [['Verneområde', 'vern']] },
        KLASSER,
        PLAN
      ]}
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
        <>
          <Figur
            tittel={`Slik er naturen vernet i ${kommunen()}`}
            tekst={
              <p>
                Figuren viser hvor mye areal som er vernet i kommunen, fordelt på verneform. Ulike verneformer har ulike
                formål og regler.
              </p>
            }
            kilder={['vern']}
          >
            <Liggende
              hva="Vernet areal per verneform"
              data={perVerneform(v.omrader).map(([navn, km2]) => ({ navn, km2, farge: 'vern' }))}
            />
          </Figur>
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
        </>
      )}
      <Figur
        tittel={`Naturen som er vernet i ${kommunen()}`}
        tekst={
          <p>
            Grunnkartets økosystemtyper innenfor verneområdene. Myr og beite med trær er med i skogen. Der områder
            overlapper, telles arealet én gang.
          </p>
        }
        kilder={['grunnkart', 'vern']}
      >
        {svar(V, d => {
          const land = detaljsum(d, GK_LAND),
            hav = detaljsum(d, k => k.id === 'hav'),
            fersk = detaljsum(d, k => k.id === 'inn' || k.id === 'elv'),
            andel = D.s === 'ok' ? iGrunnkartet(d, GK_LAND, D.v).andel : null;
          return d.sum > 0 ? (
            <>
              <Liggende
                hva="Vernet areal per økosystemtype"
                data={perOkosystem(d.km2).map(([navn, km2]) => ({ navn, km2, farge: 'vern' }))}
              />
              <p>
                Av det vernede arealet er {iTekst(land)} på land, {iTekst(hav)} i sjø og {iTekst(fersk)} i innsjøer og
                elver.
                {andel !== null && <> Det vernede på land er {prosent(andel)} av landarealet i grunnkartet.</>}
              </p>
            </>
          ) : (
            <p>Kommunen har ingen verneområder.</p>
          );
        })}
      </Figur>
    </Temaside>
  );
}

function Verdi({ tema }: { tema: Tema }) {
  const { T, plan } = naturtema('verdi'),
    K = kartleggingen(),
    v = T.s === 'ok' ? T.v : null,
    kartlagt = K.s === 'ok' && K.v ? K.v.kartlagt : null,
    klasser = NATURTEMA.find(t => t.id === 'verdi')!.klasser!;
  const [bareHoy, settBareHoy] = useState(false);
  /* Lokalitetene gruppert per naturtype: arealet, antall og høyeste verdi */
  const typer = new Map<string, { km2: number; antall: number; v: number }>();
  (v ? v.omrader : [])
    .filter(o => !bareHoy || (o.v !== undefined && o.v <= 1))
    .forEach(o => {
      const navn = String(o.egenskaper.Naturtype || 'Uten naturtype'),
        t = typer.get(navn) || { km2: 0, antall: 0, v: 3 };
      t.km2 += o.km2;
      t.antall++;
      t.v = Math.min(t.v, o.v ?? 3);
      typer.set(navn, t);
    });
  return (
    <Temaside
      tema={tema}
      trekkspill={
        <Trekkspill tittel="Hvordan kartlegges det etter Miljødirektoratets instruks?">
          <p>
            Naturtypene kartlegges i felt etter Miljødirektoratets instruks, og hver lokalitet får en verdi fra noe
            verdi til svært stor verdi. Bare deler av landet er kartlagt.
          </p>
        </Trekkspill>
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
                Det vil si at kartleggingen kan være mangelfull i kommunen. Tomme områder i kartet betyr ikke
                nødvendigvis at det ikke finnes verdifull natur der, bare at ingen har sjekket ennå.
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
          kilde: KILDE.verdsatt.datasett,
          farger: klasser.map(([navn, farge]) => [navn, farge] as [string, string])
        },
        KLASSER,
        PLAN
      ]}
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
              Verdien settes etter kriterier for hver naturtype: blant annet lokalitetens kvalitet, om naturtypen er
              truet, og om den er sjelden.
            </p>
          }
          kilder={['verdsatt']}
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
            <p>
              Listen viser hvilke naturtyper som er funnet i kommunen og hvor mye det er av hver. Tallene gjelder bare
              det som er kartlagt.
            </p>
          }
          kilder={['verdsatt']}
        >
          <MdCheckbox
            label="Vis kun stor og svært stor verdi"
            checked={bareHoy}
            onChange={e => settBareHoy(e.target.checked)}
          />
          <Tabell
            hva="Naturtypene"
            kolonner={[{ navn: 'Naturtype' }, { navn: 'Antall', tall: true }, { navn: 'Areal', tall: true }]}
            rader={[...typer]
              .sort((a, b) => b[1].km2 - a[1].km2)
              .map(([navn, t]) => [
                <span className="med-farge">
                  <i style={{ background: `var(--${klasser[t.v][1]})` }} title={klasser[t.v][0]} />
                  {navn}
                </span>,
                nf(t.antall, 0),
                dekar(t.km2)
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
        <Trekkspill tittel="Hvordan inngrepsfri natur deles inn">
          <p>
            Inngrepsfri natur deles i tre soner etter avstanden til nærmeste tyngre tekniske inngrep: sone 2 (1–3 km),
            sone 1 (3–5 km) og villmarkspreget natur (5 km eller mer).
          </p>
        </Trekkspill>
      }
      kort={[
        ['Inngrepsfri natur i kommunen', svar(I, x => iTekst(x.sum), 'Ingen')],
        ['Andel av landarealet', svar(I, x => prosent(x.andelLand), '0 %')]
      ]}
      kilde={
        <p>
          {KILDE.inon.datasett}, {KILDE.inon.navn}. Arealet er regnet ut fra et bilde av kommunen med ruter på noen
          titalls meter.
        </p>
      }
      lag={[
        {
          id: 'tema',
          navn: 'Inngrepsfri natur',
          kilde: KILDE.inon.datasett,
          farger: [2, 1, 0].map(i => [INONSONER[i][4], INONSONER[i][1]] as [string, string])
        },
        KLASSER,
        PLAN
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
              Figuren viser hvor mye inngrepsfri natur det er i kommunen, delt inn etter avstand til nærmeste inngrep.
              Det er sjelden mulig å reversere inngrep, så når inngrepsfri natur først er tapt, er den som regel borte
              for godt.
            </p>
          }
          kilder={['inon']}
        >
          <Stolper
            hva="Inngrepsfri natur per sone"
            data={[2, 1, 0].map(i => ({
              navn: INONSONER[i][4],
              under: INONSONER[i][3],
              km2: I.v.soner[i],
              farge: INONSONER[i][1]
            }))}
          />
        </Figur>
      )}
      <Mangler
        tittel={`Slik har den inngrepsfrie naturen endret seg i ${kommunen()}`}
        trenger="Miljødirektoratets kart over inngrepsfri natur for tidligere år (1988–2023)."
      />
      <Mangler tittel="Endringer per sone" trenger="de samme kartene for tidligere år." />
    </Temaside>
  );
}

function Rein({ tema }: { tema: Tema }) {
  const { T, plan } = naturtema('rein'),
    v = T.s === 'ok' ? T.v : null,
    IV = inonIVillrein();
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
        <Trekkspill tittel="Mer om villreinområder">
          <p>
            Villreinområdene er fjellområdene der villreinen lever og trekker. Et område strekker seg ofte over flere
            kommuner.
          </p>
        </Trekkspill>
      }
      kort={[
        ['Villreinområder i kommunen', svar(T, x => (x.antall ? iTekst(x.sum) : 'Ingen'))],
        ['Andel av landarealet som er villreinområde', svar(T, x => prosent(x.andelLand))],
        ['Andel villreinområde som er inngrepsfri natur', svar(IV, x => prosent(x!.andel), 'Ingen villreinområder')]
      ]}
      kilde={
        <p>
          {KILDE.villrein.datasett}, {KILDE.villrein.navn}. Arealet er den delen av hvert område som ligger i kommunen.
        </p>
      }
      fremhevet={<PlanITema plan={plan} hva="villreinområder" />}
      lag={[
        { id: 'tema', navn: 'Villreinområder', kilde: KILDE.villrein.datasett, farger: [['Villreinområde', 'rein']] },
        KLASSER,
        PLAN
      ]}
      sporsmal={[
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
          tittel={`Villreinområdene i ${kommunen()}`}
          tekst={
            <p>
              Tabellen viser villreinområdene som ligger helt eller delvis i kommunen. Arealet og andelen gjelder delen
              som ligger i kommunen.
            </p>
          }
          kilder={['villrein']}
        >
          <Tabell
            hva="Villreinområdene"
            kolonner={[
              { navn: 'Område' },
              { navn: 'I kommunen', tall: true },
              { navn: 'Andel', tall: true, ikkeMobil: true },
              { navn: 'Kommuner', ikkeMobil: true },
              { navn: 'Faktaark' }
            ]}
            rader={[...v.omrader]
              .sort((a, b) => b.km2 - a.km2)
              .map(o => [
                o.navn,
                dekar(o.km2),
                prosent(v.sum > 0 && v.andelLand !== null ? (o.km2 / v.sum) * v.andelLand : null),
                kommunenavn(o.egenskaper.kommune),
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
      <Mangler
        tittel="Tilstand for villreinen"
        trenger="vurderingen etter kvalitetsnormen for villrein, som skissene viser per område."
      />
      {IV.s === 'ok' && IV.v && (
        <Figur
          tittel="Inngrepsfri natur i villreinområdene"
          tekst={
            <p>
              Hvor mye av villreinområdene i kommunen som er inngrepsfri natur, per sone. Sonene sier hvor langt fra
              tyngre tekniske inngrep naturen ligger.
            </p>
          }
          kilder={['villrein', 'inon']}
        >
          <Liggende
            hva="Inngrepsfri natur i villreinområdene per sone"
            data={INONSONER.map(([, farge, , , navn], i) => ({ navn, km2: IV.v!.soner[i], farge }))}
          />
          <p>
            {iTekst(IV.v.sum)} av {iTekst(IV.v.villrein)} villreinområde i kommunen er inngrepsfri natur.
          </p>
        </Figur>
      )}
      <Mangler
        tittel="Inngrepsfri natur i villreinområdene over tid"
        trenger="kartene over inngrepsfri natur for tidligere år, som finnes i det samme datasettet hos Miljødirektoratet."
      />
    </Temaside>
  );
}

function Bynatur({ tema }: { tema: Tema }) {
  const G = graa(),
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
      <Mangler
        tittel="Grønne arealer i bebyggelse"
        trenger="et eget lag for grønne arealer i bebyggelse, som skissene viser ved siden av grått areal."
      />
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
