/* Gull for egne områder: radene som sammenligner kommuneplanen alene med kommuneplanen og egne områder. */

/* Radene i sammenligningen mellom kommuneplanen og egne områder. e er null for hele kommunen, ellers nummeret til området, og T er
   tallene for det området. R er planrutenettet, GK kryssingen med grått areal, tema temaene som er krysset med planen ({ navn, id,
   klasser, kryss }) og gap utbygging på natur som ikke er kartlagt. Hver rad er [navn, farge, planen alene, med egne områder, hva
   andelen regnes av, gruppe], med tallene i ruter. */
export function byggEgneRader(e, T, R, harPlan, GK, tema, gap) {
  const ut = [];
  ut.push([
    'Natur',
    'pnat',
    harPlan ? (T ? T.fnat : R.basis.rn) : null,
    T ? T.nnat : R.sum.rn,
    e === null ? R.iDag.nat : 0,
    ''
  ]);
  ut.push([
    'Jordbruk',
    'pjor',
    harPlan ? (T ? T.fjor : R.basis.rj) : null,
    T ? T.njor : R.sum.rj,
    e === null ? R.iDag.jor : 0,
    ''
  ]);
  if (GK) {
    const x = X => (e === null ? X : X.eg[e] || { graa: 0, gron: 0, gront: 0 });
    ut.push(['Grått areal', 'graa2', harPlan ? x(GK.P).graa : null, x(GK.S).graa, 0, '']);
    ut.push(['– minst halvt grønt', '', harPlan ? x(GK.P).gron : null, x(GK.S).gron, 0, '']);
    ut.push(['Grønt i bebygd', 'gront', harPlan ? x(GK.P).gront : null, x(GK.S).gront, 0, '']);
  }
  const verdi = [],
    ruter = (X, v) => (e === null ? X.alt[v] : X.eg[e] ? X.eg[e][v] : 0);
  for (const t of tema) {
    const K = t.kryss;
    if (t.klasser)
      t.klasser.forEach(([navn, id], v) =>
        verdi.push([navn, id, harPlan ? ruter(K.P, v) : null, ruter(K.S, v), 0, 'Av dette i verdsatt natur'])
      );
    else ut.push([t.navn, t.id, harPlan ? ruter(K.P, 0) : null, ruter(K.S, 0), 0, 'Av dette i']);
  }
  if (gap && gap.plan)
    ut.push([
      'Ikke kartlagt natur',
      '',
      harPlan ? (e === null ? gap.plan.ukjent : gap.plan.eg[e] ? gap.plan.eg[e].ukjent : 0) : null,
      e === null ? gap.ukjent : gap.eg[e] ? gap.eg[e].ukjent : 0,
      0,
      'Av dette i'
    ]);
  return ut.concat(verdi);
}
