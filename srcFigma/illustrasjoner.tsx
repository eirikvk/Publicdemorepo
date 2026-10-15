/* Illustrasjonene til temaene, i stedet for bildene i skissene (rettighetene til dem er ikke avklart). Flate landskap i lag, uten
   strek og uten fargeoverganger, i samme stil for alle temaene: himmel, åser bak og mark foran, og ett kjennetegn per tema (gran i
   skogen, myrull og pytter på myra, verneområdets grense over fjellet, blomstereng, elv uten veier, rein på vidda, park i byen).
   Alt viktig ligger i midten av bildet, mellom y = 90 og 210, så det tåler å bli beskåret bredt (temaflisene på oversikten) og
   smalt (flisene i «Utforsk neste perspektiv»). Tegnet for tvillingen; fargene er valgt for hvert tema og henger sammen med
   kartfargene der temaet har en (vern, villrein, verdsatt natur, vann). Tegningene er laget med KI, så Bilde (komponenter/deler.tsx)
   merker dem «KI-generert». */
import type { ReactNode } from 'react';

const B = 400,
  H = 300;

/* En gran: tre trekanter over hverandre på en stamme. x er midten, y bunnen, h høyden. */
function Gran({ x, y, h, farge }: { x: number; y: number; h: number; farge: string }) {
  const b = h * 0.42;
  return (
    <g fill={farge}>
      <rect x={x - h * 0.025} y={y - h * 0.12} width={h * 0.05} height={h * 0.12} />
      <polygon points={`${x - b / 2},${y - h * 0.1} ${x + b / 2},${y - h * 0.1} ${x},${y - h * 0.55}`} />
      <polygon points={`${x - b * 0.4},${y - h * 0.38} ${x + b * 0.4},${y - h * 0.38} ${x},${y - h * 0.8}`} />
      <polygon points={`${x - b * 0.28},${y - h * 0.62} ${x + b * 0.28},${y - h * 0.62} ${x},${y - h}`} />
    </g>
  );
}
/* Et lauvtre: rund krone på en stamme */
function Lauv({
  x,
  y,
  h,
  farge,
  stamme = '#6b5640'
}: {
  x: number;
  y: number;
  h: number;
  farge: string;
  stamme?: string;
}) {
  return (
    <g>
      <rect x={x - h * 0.04} y={y - h * 0.45} width={h * 0.08} height={h * 0.45} fill={stamme} />
      <ellipse cx={x} cy={y - h * 0.62} rx={h * 0.3} ry={h * 0.36} fill={farge} />
    </g>
  );
}
/* En rein i profil: kropp, hals og hode, fire bein og et gevir. s er størrelsen, vend speiler den. */
function Rein({ x, y, s, farge, vend }: { x: number; y: number; s: number; farge: string; vend?: boolean }) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${vend ? -s : s} ${s})`}
      fill={farge}
      stroke={farge}
      strokeLinecap="round"
    >
      <ellipse cx="0" cy="-14" rx="16" ry="7.5" stroke="none" />
      <path d="M10 -19 L18 -27 L23 -25 L17 -13 Z" stroke="none" />
      <ellipse cx="24" cy="-24" rx="6" ry="3.4" transform="rotate(25 24 -24)" stroke="none" />
      <path d="M-11 -9 L-12 0 M-6 -8 L-5 0 M7 -8 L6 0 M12 -9 L13 0" strokeWidth="2.4" fill="none" />
      <path
        d="M20 -27 L16 -38 L11 -42 M16 -38 L19 -43 M22 -27 L24 -38 L21 -44 M24 -38 L28 -42"
        strokeWidth="1.4"
        fill="none"
      />
    </g>
  );
}
/* En blomst: stilk og en rund krone */
const Blomst = ({ x, y, h, farge }: { x: number; y: number; h: number; farge: string }) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y - h} stroke="#5f8a3c" strokeWidth="1.4" />
    <circle cx={x} cy={y - h} r={h * 0.22 + 1.5} fill={farge} />
  </g>
);
/* Myrull: tynn stilk med en hvit dott */
const Myrull = ({ x, y, h }: { x: number; y: number; h: number }) => (
  <g>
    <line x1={x} y1={y} x2={x} y2={y - h} stroke="#8a8457" strokeWidth="1.2" />
    <circle cx={x} cy={y - h - 2} r="3" fill="#fbfbf7" />
  </g>
);

/* Et tall fra et frø, så mønstrene (trær, blomster) er like hver gang siden tegnes */
function tilfeldig(frø: number) {
  let t = frø;
  return () => {
    t = (t * 9301 + 49297) % 233280;
    return t / 233280;
  };
}

function Skog() {
  const r = tilfeldig(7);
  return (
    <>
      <rect width={B} height={H} fill="#e4efe1" />
      <circle cx="318" cy="74" r="26" fill="#f4e4a6" />
      <path d="M0 165 Q70 118 150 148 T300 136 T400 146 V300 H0Z" fill="#b8d2a6" />
      {Array.from({ length: 16 }, (_, i) => (
        <Gran key={'b' + i} x={i * 27 + 6 + r() * 8} y={176 + r() * 8} h={34 + r() * 14} farge="#6d9a58" />
      ))}
      <path d="M0 200 Q110 172 210 192 T400 184 V300 H0Z" fill="#8bb576" />
      {Array.from({ length: 11 }, (_, i) =>
        i % 4 === 2 ? (
          <Lauv key={'m' + i} x={i * 38 + 10 + r() * 10} y={218} h={48 + r() * 10} farge="#a9c95f" />
        ) : (
          <Gran key={'m' + i} x={i * 38 + 10 + r() * 10} y={222 + r() * 6} h={62 + r() * 18} farge="#3f6f34" />
        )
      )}
      <rect y="238" width={B} height="62" fill="#5d8c4a" />
      <Gran x={46} y={292} h={120} farge="#2c5226" />
      <Gran x={352} y={296} h={136} farge="#2c5226" />
    </>
  );
}

function Vatmark() {
  const r = tilfeldig(3);
  return (
    <>
      <rect width={B} height={H} fill="#e5eef0" />
      <path d="M0 150 Q90 120 180 140 T400 128 V300 H0Z" fill="#b5c8c4" />
      {Array.from({ length: 7 }, (_, i) => (
        <Gran key={'f' + i} x={20 + i * 14 + r() * 6} y={160} h={22 + r() * 8} farge="#7f9b78" />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <Gran key={'g' + i} x={300 + i * 16 + r() * 6} y={156} h={20 + r() * 8} farge="#7f9b78" />
      ))}
      <rect y="158" width={B} height="142" fill="#cbc38c" />
      <path d="M0 158 H400 V176 Q300 170 200 178 T0 172Z" fill="#bdb57b" />
      <ellipse cx="120" cy="196" rx="70" ry="11" fill="#7fb0c6" />
      <ellipse cx="108" cy="194" rx="34" ry="4" fill="#a8cbd9" />
      <ellipse cx="300" cy="214" rx="52" ry="9" fill="#7fb0c6" />
      <ellipse cx="236" cy="184" rx="30" ry="6" fill="#7fb0c6" />
      {Array.from({ length: 14 }, (_, i) => (
        <ellipse
          key={'t' + i}
          cx={10 + i * 29 + r() * 10}
          cy={232 + r() * 40}
          rx={16 + r() * 8}
          ry={6}
          fill="#a79c5f"
        />
      ))}
      {Array.from({ length: 46 }, (_, i) => (
        <Myrull key={'m' + i} x={r() * B} y={190 + r() * 100} h={8 + r() * 12} />
      ))}
    </>
  );
}

function Vern() {
  return (
    <>
      <rect width={B} height={H} fill="#ebe7f1" />
      <polygon points="40,190 140,70 230,190" fill="#9aa5b4" />
      <polygon points="118,96 140,70 162,96 150,92 140,100 128,92" fill="#fbfbfd" />
      <polygon points="170,190 270,92 380,190" fill="#8794a5" />
      <polygon points="252,110 270,92 290,112 278,108 270,116 262,108" fill="#fbfbfd" />
      <path d="M0 180 Q100 160 200 176 T400 170 V300 H0Z" fill="#7d9a7c" />
      <ellipse cx="200" cy="214" rx="120" ry="16" fill="#8cb8cf" />
      <path d="M0 228 Q120 214 220 232 T400 226 V300 H0Z" fill="#5f8456" />
      {Array.from({ length: 9 }, (_, i) => (
        <Gran key={i} x={18 + i * 46} y={262} h={46 + (i % 3) * 8} farge="#35602f" />
      ))}
      <path
        d="M-10 248 C80 236 90 150 160 140 S300 150 320 120 S380 100 410 110"
        fill="none"
        stroke="#6a1b9a"
        strokeWidth="3"
        strokeDasharray="10 7"
        strokeLinecap="round"
        opacity="0.75"
      />
      <g fill="#7d7a73">
        <ellipse cx="334" cy="250" rx="11" ry="5" />
        <ellipse cx="334" cy="242" rx="8" ry="4" />
        <ellipse cx="334" cy="235" rx="5" ry="3" />
      </g>
    </>
  );
}

function Verdi() {
  const r = tilfeldig(11),
    farger = ['#c026d3', '#e478e8', '#f2c94c', '#fbfbf7', '#7a5cc9', '#c026d3'];
  return (
    <>
      <rect width={B} height={H} fill="#f3edf2" />
      <path d="M0 150 Q120 118 230 142 T400 132 V300 H0Z" fill="#c4d99a" />
      <rect x="322" y="112" width="8" height="58" fill="#6b5136" />
      <g fill="#6f9a48">
        <circle cx="306" cy="108" r="24" />
        <circle cx="346" cy="106" r="24" />
        <circle cx="326" cy="86" r="28" />
      </g>
      <path d="M0 178 Q100 160 200 172 T400 166 V300 H0Z" fill="#a8c77d" />
      <path d="M0 214 Q140 198 260 210 T400 204 V300 H0Z" fill="#8fb766" />
      {Array.from({ length: 70 }, (_, i) => {
        const y = 182 + r() * 112;
        return <Blomst key={i} x={r() * B} y={y} h={6 + (y - 170) * 0.12} farge={farger[i % farger.length]} />;
      })}
      <g fill="#c026d3">
        <ellipse cx="146" cy="118" rx="6" ry="4" transform="rotate(-30 146 118)" />
        <ellipse cx="155" cy="118" rx="6" ry="4" transform="rotate(30 155 118)" />
      </g>
      <g fill="#f2c94c">
        <ellipse cx="86" cy="138" rx="5" ry="3.4" transform="rotate(-30 86 138)" />
        <ellipse cx="93" cy="138" rx="5" ry="3.4" transform="rotate(30 93 138)" />
      </g>
    </>
  );
}

function Inon() {
  return (
    <>
      <rect width={B} height={H} fill="#e2ede5" />
      <polygon points="0,150 60,110 110,138 170,96 240,142 300,108 360,134 400,118 400,180 0,180" fill="#a5b9a7" />
      <path d="M0 160 Q110 140 220 156 T400 150 V300 H0Z" fill="#8bbf73" />
      <path d="M0 196 Q120 180 230 194 T400 188 V300 H0Z" fill="#6daf55" />
      <path d="M0 236 Q140 220 260 234 T400 228 V300 H0Z" fill="#3e8e41" />
      <path
        d="M214 158 C230 172 170 180 186 196 S280 214 236 232 S120 262 160 300"
        fill="none"
        stroke="#8cc3d8"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g fill="#9aa39a">
        <ellipse cx="70" cy="254" rx="14" ry="6" />
        <ellipse cx="330" cy="264" rx="17" ry="7" />
        <ellipse cx="300" cy="208" rx="8" ry="3.5" />
      </g>
      <g fill="#2f6f35">
        <circle cx="96" cy="250" r="8" />
        <circle cx="104" cy="252" r="6" />
        <circle cx="352" cy="256" r="9" />
      </g>
      <path d="M118 92 q10 -8 18 0 q8 -8 18 0" fill="none" stroke="#3c4a3e" strokeWidth="2.4" strokeLinecap="round" />
    </>
  );
}

function Villrein() {
  return (
    <>
      <rect width={B} height={H} fill="#f5e6da" />
      <circle cx="96" cy="96" r="30" fill="#f0b07a" />
      <polygon points="0,170 80,118 150,150 230,104 320,146 400,124 400,190 0,190" fill="#b7aea2" />
      <polygon points="212,116 230,104 248,118 238,116 230,122 222,116" fill="#fbf8f4" />
      <path d="M0 172 Q120 156 240 168 T400 162 V300 H0Z" fill="#cfc59c" />
      <ellipse cx="300" cy="184" rx="40" ry="5" fill="#f7f4ec" />
      <ellipse cx="70" cy="196" rx="28" ry="4" fill="#f7f4ec" />
      <path d="M0 226 Q130 212 250 224 T400 218 V300 H0Z" fill="#b9ae80" />
      <Rein x={146} y={212} s={1.15} farge="#4a3b2f" />
      <Rein x={214} y={206} s={0.95} farge="#5a4838" vend />
      <Rein x={262} y={216} s={1.05} farge="#4a3b2f" />
      <Rein x={104} y={204} s={0.8} farge="#6a5644" />
      <Rein x={312} y={208} s={0.8} farge="#6a5644" />
      <rect x="0" y="262" width={B} height="38" fill="#a99e70" />
    </>
  );
}

function Bynatur() {
  const hus: [number, number, number, string][] = [
    [20, 70, 44, '#aab2b8'],
    [70, 100, 36, '#8f969c'],
    [112, 60, 52, '#c3c8cc'],
    [170, 120, 40, '#9aa1a7'],
    [216, 84, 48, '#b4bbc0'],
    [270, 108, 38, '#8f969c'],
    [314, 72, 54, '#c3c8cc']
  ];
  return (
    <>
      <rect width={B} height={H} fill="#e8eef0" />
      {hus.map(([x, h, b, f]) => (
        <g key={x}>
          <rect x={x} y={190 - h} width={b} height={h} fill={f} />
          {Array.from({ length: Math.floor(h / 18) }, (_, j) => (
            <rect key={j} x={x + 7} y={190 - h + 9 + j * 18} width={b - 14} height="5" fill="#eef2f4" opacity="0.8" />
          ))}
        </g>
      ))}
      <rect y="186" width={B} height="114" fill="#9ecc73" />
      <path d="M0 214 Q120 204 220 220 T400 212" fill="none" stroke="#7fb3c9" strokeWidth="9" />
      <path d="M150 300 C170 260 230 250 260 186" fill="none" stroke="#e6e1d3" strokeWidth="10" />
      <Lauv x={46} y={226} h={70} farge="#5f9a45" />
      <Lauv x={110} y={244} h={58} farge="#7ab35a" />
      <Lauv x={302} y={236} h={66} farge="#5f9a45" />
      <Lauv x={360} y={256} h={54} farge="#7ab35a" />
      <Lauv x={208} y={200} h={40} farge="#7ab35a" />
    </>
  );
}

const TEGNING: Record<string, () => ReactNode> = {
  skog: Skog,
  vatmark: Vatmark,
  verneomrader: Vern,
  'verdsatte-naturtyper': Verdi,
  'inngrepsfri-natur': Inon,
  villrein: Villrein,
  bynatur: Bynatur
};

/* Illustrasjonen for temaet med id, som fyller boksen den står i (beskåret i midten). null når temaet ikke har en. */
export function Illustrasjon({ tema }: { tema: string }) {
  const T = TEGNING[tema];
  if (!T) return null;
  return (
    <svg className="illustrasjon" viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <T />
    </svg>
  );
}
