/* Tallene datamotoren har regnet ut for valgt kommune, lest fra katalogen gjennom window.motor, som siden setter med ?teknisk (se
   src/ui/teknisk.ts). Brukes av regresjonstesten, så tallene kan sammenlignes direkte og ikke bare som tekst. Funksjonen kjøres i nettleseren, så den kan bare
   bruke det som finnes i siden: typene hentes fra src, men ingen funksjoner. */
import type { Motor } from '../src/ui/teknisk.ts';

export function motortall() {
  const M: Motor | undefined = window.motor;
  if (!M) return null;
  const A = M.app,
    K = M.katalog,
    v = M.verdi,
    side = (id: string) => M.ui.side === id,
    r = (x: unknown) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x),
    rund = (o: unknown): unknown =>
      o == null
        ? o
        : Array.isArray(o) || ArrayBuffer.isView(o)
          ? Array.from(o as ArrayLike<unknown>, rund)
          : typeof o === 'object'
            ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rund(v)]))
            : r(o);
  /* Utvalgte felt fra o, avrundet */
  const plukk = <T extends object, N extends keyof T>(o: T | null, ...navn: N[]) =>
    o ? Object.fromEntries(navn.map(n => [n, rund(o[n])])) : null;
  /* Tilstanden til en rad: henter, feil eller ok */
  const tilstand = (x: { status: string } | null) => (x ? x.status : null);
  /* Verdien i tabellen t for et utvalg av utbyggingen (src/data/gull/utbygging.ts): den nye planen (ny) eller den gamle (gammel), i
     hele kommunen (e null) eller i det egne området på plass e (0 er det første). Tabellene regnes per utvalg, og tallene settes
     sammen her i samme form som før 19. oktober 2026, da hver kryssing regnet begge planene og hvert område i én tabell, så de kan
     sammenlignes med eldre utgaver. */
  const nr = A.valgt ? A.valgt.nr : '',
    iUtvalg = <V>(t: { naa: (n: string) => V | null }, plan: 'ny' | 'gammel', e: number | null) =>
      t.naa(nr + (plan === 'ny' && e === null ? '' : '/' + plan + (e === null ? '' : '/' + (e + 1)))),
    /* for hele kommunen (alt) og per eget område (eg), som før */
    perOmrade = <V, U>(t: { naa: (n: string) => V | null }, plan: 'ny' | 'gammel', f: (x: V) => U) => {
      const x = iUtvalg(t, plan, null);
      return x
        ? {
            alt: f(x),
            eg: (R ? R.egneIder : []).map((_, e) => {
              const y = iUtvalg(t, plan, e);
              return y ? f(y) : null;
            })
          }
        : null;
    };
  const R = M.utbyggingen(),
    T = M.valgt(K.solv.arealtall),
    P = v(K.solv.grense) ? M.valgt(K.gull.kommuneplan) : null,
    I = M.valgt(K.gull.inon),
    G = M.valgt(K.gull.graa),
    egne = R ? R.egneIder : [];
  return {
    valgt: A.valgt && A.valgt.nr,
    arealtall:
      T &&
      (T.status === 'ok'
        ? plukk({ tilstand: 'ok', a: M.perKlasse(T.verdi!).a, aar: M.perKlasse(T.verdi!).aar }, 'tilstand', 'a', 'aar')
        : { tilstand: T.status }),
    ferskvann: rund(T && T.status === 'ok' ? M.perKlasse(T.verdi!).ferskvann : null),
    flate: r(v(K.solv.grense) ? v(K.solv.grense)!.km2 : 0),
    historie: plukk(v(K.solv.arealtall) ? M.historie(v(K.solv.arealtall)!) : null, 'fra', 'til', 'a0', 'a1', 'endret'),
    planInfo:
      P &&
      (P.status === 'ok'
        ? plukk(
            { tilstand: P.verdi!.finnes ? 'ok' : 'ingen', dekning: P.verdi!.dekning, plan: P.verdi!.plan },
            'tilstand',
            'dekning',
            'plan'
          )
        : { tilstand: P.status === 'henter' ? 'sjekker' : 'feil' }),
    planTall: M.planTall(),
    plan: R && {
      ...plukk(R, 'n', 'sum', 'iDag', 'fliser', 'rute', 'w', 'h', 'antallEgne', 'egneTall'),
      basis: R.basisSum ? { rn: R.basisSum.rn, rj: R.basisSum.rj } : null
    },
    planSum: rund(v(K.gull.plansum)),
    tema: M.NATURTEMA.map(t => {
      const T = M.TEMATABELLER[t.id],
        x = v(T.tall);
      if (!x) return { id: t.id, data: null };
      const I = v(T.iPlan),
        C = I && I.omrader === x.omrader ? I.K : null,
        harGammel = !!(R && R.basis),
        B = T.kartlagt ? v(T.kartlagt) : null,
        U = T.utenforKartlagt ? v(T.utenforKartlagt) : null,
        /* ruter med planlagt utbygging per område, og av dem i smale striper */
        plan = C ? Array.from(C.plan) : x.omrader.map(() => 0),
        smal = C ? Array.from(C.smal) : x.omrader.map(() => 0);
      return {
        id: t.id,
        feil: false,
        sum: r(x.sum),
        antall: x.omrader.length,
        klasser: rund(x.klasser || null),
        regnet: !!C,
        plan: plan.reduce((s, x) => s + x, 0),
        smal: smal.reduce((s, x) => s + x, 0),
        /* unionen: planlagt utbygging i temaet der overlapp telles én gang, og i smale striper (fra 18. oktober 2026) */
        samlet: C && 'samlet' in C ? [C.samlet, C.samletSmal] : null,
        berort: plan.filter(x => x).length,
        kryss: C
          ? {
              S: rund(perOmrade(T.iPlan, 'ny', y => (y ? y.K.klasser : null))),
              P: harGammel ? rund(perOmrade(T.iPlan, 'gammel', y => (y ? y.K.klasser : null))) : null
            }
          : null,
        gap: U
          ? {
              nat: U.nat,
              ukjent: U.ukjent,
              plan:
                harGammel && T.utenforKartlagt
                  ? rund(
                      (({ alt, eg }) => ({ ...alt, eg }))(
                        perOmrade(T.utenforKartlagt, 'gammel', y => (y ? { nat: y.nat, ukjent: y.ukjent } : null))!
                      )
                    )
                  : null
            }
          : null,
        kartlagt: B && B.E ? r(B.E.km2) : null,
        inne: B && B.inne ? rund(B.inne) : null
      };
    }),
    /* bildene av hele kommunen: tallene når de er hentet, ellers bare tilstanden */
    inon:
      I &&
      (I.status === 'ok'
        ? { tilstand: 'ok', soner: rund(I.verdi!.soner), sum: r(I.verdi!.sum) }
        : { tilstand: tilstand(I) }),
    graa:
      G &&
      (G.status === 'ok'
        ? { tilstand: 'ok', trinn: rund(G.verdi!.trinn), sum: r(G.verdi!.sum) }
        : { tilstand: tilstand(G) }),
    graaKryss: (() => {
      const k = v(K.gull.graakryss);
      if (!k) return null;
      const som = (plan: 'ny' | 'gammel') => {
        const x = perOmrade(K.gull.graakryss, plan, y => (y ? y.tall : null));
        return x && x.alt ? { ...x.alt, eg: x.eg } : null;
      };
      return rund({
        S: som('ny'),
        P: som(R && R.basis ? 'gammel' : 'ny'),
        bebygd: k.bebygd,
        gront: k.gront,
        antallEgne: k.antallEgne
      });
    })(),
    egne: A.egne.map(g => {
      const i = egne.indexOf(g.id);
      return {
        navn: g.navn,
        kilde: g.kilde,
        km2: r(g.km2),
        deler: g.deler.length,
        tall: rund(i < 0 ? null : R!.egneTall[i])
      };
    }),
    vis: { inon: side('inon'), graa: side('graa'), smale: M.ui.visSmale },
    tema_paa: M.NATURTEMA.map(t => side(t.id))
  };
}
