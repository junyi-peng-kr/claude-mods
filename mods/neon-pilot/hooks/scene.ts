// The NEON PILOT backdrop, pure vector: a hangar at night with a hex wall, a
// perspective deck, neon gantries on the left with the NEON PILOT wordmark,
// and KX-07's head on the right, its cyan visor breathing slowly. A faint
// scanline crosses every 14 s. Nothing flashes; each moving part rests where
// the plain markup puts it, for people who asked for reduced motion.

const W = 1600
const H = 1000

const BG = '#07060D'
const CYAN = '#2EF2FF'
const MAG = '#FF2E88'
const DIM = '#B1A4CC'
const EDGE = '#3A2C55'
const HEAD = "Rajdhani,'DIN Condensed','Avenir Next Condensed',sans-serif"
const MONO = "'Share Tech Mono','SF Mono',Menlo,monospace"

function deck(): string {
  const vx = 800
  const vy = 560
  let d = ''
  for (let x = -1600; x <= 3200; x += 170) d += `M${vx} ${vy}L${x} ${H + 40}`
  for (const y of [575, 596, 626, 668, 726, 806, 916]) d += `M0 ${y}H${W}`
  return `<path d="${d}" stroke="${CYAN}" stroke-opacity=".13" stroke-width="1.5" fill="none"/>`
}

function gantry(x: number): string {
  return (
    `<rect x="${x}" y="-20" width="46" height="600" fill="#0E0B18" stroke="${EDGE}" stroke-width="2"/>` +
    `<path d="M${x} 40L${x + 46} 110M${x + 46} 40L${x} 110M${x} 180L${x + 46} 250M${x + 46} 180L${x} 250M${x} 320L${x + 46} 390M${x + 46} 320L${x} 390" stroke="${EDGE}" stroke-width="2"/>` +
    `<rect x="${x + 50}" y="0" width="5" height="560" fill="${MAG}" fill-opacity=".85" filter="url(#glow)"/>`
  )
}

function kx07(): string {
  // drawn at x 1090-1660; moved left so the docked dashboard doesn't cover it
  return (
    '<g transform="translate(-250 50) scale(.85)">' +
    // crest blades
    `<polygon points="1210,150 1140,-30 1268,128" fill="#1E1438" stroke="${MAG}" stroke-opacity=".7" stroke-width="2"/>` +
    `<polygon points="1300,110 1330,-40 1360,108" fill="#1A1230" stroke="${EDGE}" stroke-width="2"/>` +
    // helmet
    `<polygon points="1090,250 1210,140 1430,96 1640,150 1660,450 1570,620 1310,660 1150,540 1100,400" fill="#140E26" stroke="${EDGE}" stroke-width="3"/>` +
    `<polygon points="1210,140 1430,96 1460,210 1250,250" fill="#1C1434"/>` +
    `<path d="M1150,540L1310,470L1570,620M1250,250L1330,470M1460,210L1520,440M1100,400L1240,420" stroke="#2A1F45" stroke-width="3" fill="none"/>` +
    // magenta armour stripes
    `<polygon points="1290,500 1430,462 1412,500 1276,540" fill="${MAG}" fill-opacity=".85"/>` +
    `<polygon points="1460,250 1560,232 1548,262 1452,282" fill="${MAG}" fill-opacity=".75"/>` +
    `<polygon points="1180,560 1250,540 1244,560 1176,580" fill="${MAG}" fill-opacity=".6"/>` +
    // visor
    `<polygon class="visor" points="1150,338 1420,300 1590,318 1430,362 1172,380" fill="${CYAN}" opacity=".9" filter="url(#glow)"/>` +
    `<polygon points="1190,346 1420,314 1540,322 1424,346 1196,366" fill="#E8FDFF" opacity=".75"/>` +
    // designation
    `<text x="1345" y="600" transform="rotate(-9 1345 600)" font-family="${HEAD}" font-size="64" font-weight="700" letter-spacing="4" fill="${DIM}" fill-opacity=".55">KX-07</text>` +
    '</g>'
  )
}

function wordmark(): string {
  return (
    '<g>' +
    `<text x="150" y="190" font-family="${HEAD}" font-size="104" font-weight="700" letter-spacing="8" fill="none" stroke="${CYAN}" stroke-width="2.5" filter="url(#glow)">NEON</text>` +
    `<text x="150" y="290" font-family="${HEAD}" font-size="104" font-weight="700" letter-spacing="8" fill="${MAG}" fill-opacity=".9">PILOT</text>` +
    `<text x="154" y="330" font-family="${MONO}" font-size="20" letter-spacing="5" fill="${DIM}">// PILOT LINK · KX-07</text>` +
    `<path d="M140 110V90H180M520 340V360H480" stroke="${CYAN}" stroke-width="3" fill="none"/>` +
    '</g>'
  )
}

function reticle(cx: number, cy: number): string {
  return (
    `<g stroke="${CYAN}" stroke-opacity=".45" fill="none">` +
    `<circle cx="${cx}" cy="${cy}" r="70" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="42" stroke-width="1.5" stroke-dasharray="6 8"/>` +
    `<path d="M${cx - 96} ${cy}H${cx - 54}M${cx + 54} ${cy}H${cx + 96}M${cx} ${cy - 96}V${cy - 54}M${cx} ${cy + 54}V${cy + 96}" stroke-width="2"/>` +
    '</g>'
  )
}

export const SCENE =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
  '<style>' +
  '@keyframes breathe { 0%, 100% { opacity: .9 } 50% { opacity: .62 } }' +
  '@keyframes sweep { from { transform: translateY(-200px) } to { transform: translateY(1200px) } }' +
  '.visor { animation: breathe 6s ease-in-out infinite }' +
  '.scan { animation: sweep 14s linear infinite }' +
  '</style>' +
  '<defs>' +
  `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D0920"/><stop offset=".56" stop-color="#0A0717"/><stop offset="1" stop-color="${BG}"/></linearGradient>` +
  '<pattern id="hex" width="84" height="146" patternUnits="userSpaceOnUse">' +
  `<path d="M42 0L84 24V73L42 97L0 73V24ZM42 97V146M0 146L0 122M84 146V122" fill="none" stroke="${CYAN}" stroke-opacity=".09" stroke-width="2"/>` +
  '</pattern>' +
  '<radialGradient id="wallfade" cx=".5" cy=".35" r=".6"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>' +
  '<mask id="wallmask"><rect width="1600" height="560" fill="url(#wallfade)"/></mask>' +
  '<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
  `<radialGradient id="calm" cx=".5" cy=".55" r=".48"><stop offset="0" stop-color="${BG}" stop-opacity=".5"/><stop offset=".75" stop-color="${BG}" stop-opacity=".22"/><stop offset="1" stop-color="${BG}" stop-opacity="0"/></radialGradient>` +
  `<linearGradient id="foot" x1="0" y1="0" x2="0" y2="1"><stop offset=".8" stop-color="${BG}" stop-opacity="0"/><stop offset="1" stop-color="${BG}" stop-opacity=".85"/></linearGradient>` +
  `<linearGradient id="scanline" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CYAN}" stop-opacity="0"/><stop offset=".5" stop-color="${CYAN}" stop-opacity=".07"/><stop offset="1" stop-color="${CYAN}" stop-opacity="0"/></linearGradient>` +
  '</defs>' +
  `<rect width="${W}" height="${H}" fill="url(#sky)"/>` +
  // hex wall behind the deck
  '<rect width="1600" height="560" fill="url(#hex)" mask="url(#wallmask)"/>' +
  // horizon light
  `<rect x="0" y="556" width="${W}" height="4" fill="${MAG}" fill-opacity=".5" filter="url(#glow)"/>` +
  deck() +
  gantry(40) +
  gantry(250) +
  // catwalk lights
  `<path d="M0 470H330" stroke="${EDGE}" stroke-width="8"/>` +
  `<path d="M10 470H330" stroke="${CYAN}" stroke-width="3" stroke-dasharray="3 22" stroke-linecap="round" filter="url(#glow)"/>` +
  wordmark() +
  reticle(330, 760) +
  kx07() +
  // keep the reading column and the message box calm
  `<rect width="${W}" height="${H}" fill="url(#calm)"/>` +
  `<rect width="${W}" height="${H}" fill="url(#foot)"/>` +
  // the slow scanline, resting above the frame
  `<rect class="scan" x="0" y="0" width="${W}" height="160" fill="url(#scanline)" transform="translate(0 -200)"/>` +
  '</svg>'
