// ===== Supabase =====
const SUPABASE_URL = 'https://sffljnxvevyfjuthpiez.supabase.co';
const SUPABASE_KEY = 'sb_publishable_luMdr9UAXpIUNINvyzUeIw_-aQgdxiZ';
const SUPABASE_TABLE = 'tabs_state';
const SUPABASE_ROW_ID = 1;
const sb = (SUPABASE_KEY !== 'HIER_ANON_KEY_EINFUEGEN' && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const STORAGE_KEY = 'dishwasher_state_v2';
const OLD_KEY = 'dishwasher_state_v1';
const INCOME = { S: 1, M: 5, L: 10 };
const COST = { S: 10, M: 20, L: 50 };

const DEFAULT_STATE = {
  standTime: new Date('2026-04-13T08:00:00').toISOString(),
  families: [
    { id: 'silbermann',  name: 'Silbermann',      color: '#5a5a65', coinsAtStand: 14,  buildings: { S: 1, M: 15, L: 1 } },
    { id: 'goldstein',   name: 'Goldstein',       color: '#b8862a', coinsAtStand: 1,   buildings: { S: 2, M: 9,  L: 0 } },
    { id: 'rosenberg',   name: 'Rosenberg',       color: '#8b2c1e', coinsAtStand: 6,   buildings: { S: 2, M: 11, L: 0 } },
    { id: 'montfort',    name: 'Montfort',        color: '#3a5a3a', coinsAtStand: 5,   buildings: { S: 2, M: 14, L: 0 } },
    { id: 'reichenberg', name: 'von Reichenberg', color: '#2a4a6a', coinsAtStand: 6,   buildings: { S: 1, M: 9,  L: 0 } },
    { id: 'falkenstein', name: 'Falkenstein',     color: '#6b3a1c', coinsAtStand: 174, buildings: { S: 2, M: 11, L: 0 } },
  ]
};

let state = loadState();
let editMode = false;
let sbSaveTimer = null;
let sbSkipNextRealtime = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const oldRaw = localStorage.getItem(OLD_KEY);
    if (oldRaw) {
      const old = JSON.parse(oldRaw);
      old.families = old.families.map(f => {
        const def = DEFAULT_STATE.families.find(d => d.id === f.id);
        return def ? { ...f, color: def.color } : f;
      });
      return old;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!sb) return;
  clearTimeout(sbSaveTimer);
  sbSaveTimer = setTimeout(async () => {
    sbSkipNextRealtime = true;
    const { error } = await sb.from(SUPABASE_TABLE).upsert({
      id: SUPABASE_ROW_ID,
      data: state,
      updated_at: new Date().toISOString(),
    });
    if (error) { console.warn('Supabase save:', error); sbSkipNextRealtime = false; }
  }, 350);
}

async function bootstrapSupabase() {
  if (!sb) { console.info('Supabase nicht konfiguriert — nur localStorage.'); return; }
  try {
    const { data, error } = await sb
      .from(SUPABASE_TABLE)
      .select('data')
      .eq('id', SUPABASE_ROW_ID)
      .maybeSingle();
    if (error) { console.warn('Supabase load:', error); return; }
    if (data && data.data && data.data.families) {
      state = data.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    } else {
      sbSkipNextRealtime = true;
      await sb.from(SUPABASE_TABLE).upsert({ id: SUPABASE_ROW_ID, data: state });
    }
  } catch (e) { console.warn(e); }
  sb.channel('tabs_state_rt')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: SUPABASE_TABLE, filter: `id=eq.${SUPABASE_ROW_ID}` },
      (payload) => {
        if (sbSkipNextRealtime) { sbSkipNextRealtime = false; return; }
        if (payload.new && payload.new.data && payload.new.data.families) {
          state = payload.new.data;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          render();
        }
      })
    .subscribe();
}
function income(f) {
  return f.buildings.S * INCOME.S + f.buildings.M * INCOME.M + f.buildings.L * INCOME.L;
}
function currentCoins(f) {
  const elapsedH = (Date.now() - new Date(state.standTime).getTime()) / 3600000;
  return f.coinsAtStand + income(f) * elapsedH;
}
function snapshot() {
  const now = new Date().toISOString();
  state.families.forEach(fam => {
    fam.coinsAtStand = Math.floor(currentCoins(fam));
  });
  state.standTime = now;
}

function svgHouse(cx, cy, color, size) {
  size = size || 18;
  const s = size, h = s/2;
  return `<g transform="translate(${cx-h},${cy-h})">
    <polygon points="0,${s*0.42} ${h},${s*0.05} ${s},${s*0.42}" fill="${color}" stroke="#3d2817" stroke-width="0.9" stroke-linejoin="round"/>
    <rect x="${s*0.1}" y="${s*0.42}" width="${s*0.8}" height="${s*0.5}" fill="${color}" stroke="#3d2817" stroke-width="0.9"/>
    <rect x="${s*0.42}" y="${s*0.6}" width="${s*0.16}" height="${s*0.32}" fill="#3d2817"/>
  </g>`;
}

function svgManor(cx, cy, color, size) {
  size = size || 22;
  const s = size, h = s/2;
  return `<g transform="translate(${cx-h},${cy-h})">
    <polygon points="${s*0.05},${s*0.4} ${s*0.18},${s*0.12} ${s*0.82},${s*0.12} ${s*0.95},${s*0.4}" fill="${color}" stroke="#3d2817" stroke-width="0.9" stroke-linejoin="round"/>
    <rect x="${s*0.08}" y="${s*0.4}" width="${s*0.84}" height="${s*0.55}" fill="${color}" stroke="#3d2817" stroke-width="0.9"/>
    <rect x="${s*0.42}" y="${s*0.62}" width="${s*0.16}" height="${s*0.33}" fill="#3d2817"/>
    <rect x="${s*0.18}" y="${s*0.5}" width="${s*0.13}" height="${s*0.1}" fill="#3d2817"/>
    <rect x="${s*0.69}" y="${s*0.5}" width="${s*0.13}" height="${s*0.1}" fill="#3d2817"/>
  </g>`;
}

function svgCastle(cx, cy, color, size) {
  size = size || 26;
  const s = size, h = s/2;
  return `<g transform="translate(${cx-h},${cy-h})">
    <rect x="${s*0.02}" y="${s*0.28}" width="${s*0.22}" height="${s*0.67}" fill="${color}" stroke="#3d2817" stroke-width="0.9"/>
    <rect x="${s*0.76}" y="${s*0.28}" width="${s*0.22}" height="${s*0.67}" fill="${color}" stroke="#3d2817" stroke-width="0.9"/>
    <rect x="${s*0.24}" y="${s*0.45}" width="${s*0.52}" height="${s*0.5}" fill="${color}" stroke="#3d2817" stroke-width="0.9"/>
    <rect x="${s*0.02}" y="${s*0.22}" width="${s*0.06}" height="${s*0.06}" fill="${color}" stroke="#3d2817" stroke-width="0.5"/>
    <rect x="${s*0.11}" y="${s*0.22}" width="${s*0.06}" height="${s*0.06}" fill="${color}" stroke="#3d2817" stroke-width="0.5"/>
    <rect x="${s*0.18}" y="${s*0.22}" width="${s*0.06}" height="${s*0.06}" fill="${color}" stroke="#3d2817" stroke-width="0.5"/>
    <rect x="${s*0.76}" y="${s*0.22}" width="${s*0.06}" height="${s*0.06}" fill="${color}" stroke="#3d2817" stroke-width="0.5"/>
    <rect x="${s*0.85}" y="${s*0.22}" width="${s*0.06}" height="${s*0.06}" fill="${color}" stroke="#3d2817" stroke-width="0.5"/>
    <rect x="${s*0.92}" y="${s*0.22}" width="${s*0.06}" height="${s*0.06}" fill="${color}" stroke="#3d2817" stroke-width="0.5"/>
    <rect x="${s*0.42}" y="${s*0.7}" width="${s*0.16}" height="${s*0.25}" fill="#3d2817"/>
    <line x1="${h}" y1="${s*0.05}" x2="${h}" y2="${s*0.22}" stroke="#3d2817" stroke-width="0.8"/>
    <path d="M${h},${s*0.05} L${s*0.7},${s*0.1} L${h},${s*0.15} Z" fill="#8b2c1e" stroke="#3d2817" stroke-width="0.4"/>
  </g>`;
}

function compassRoseSVG(cx, cy, r) {
  let pts = '';
  const inner = r * 0.22;
  for (let i = 0; i < 4; i++) {
    const a = (i * 90 - 90) * Math.PI / 180;
    const aNext = ((i+1) * 90 - 90) * Math.PI / 180;
    const aMid = (a + aNext) / 2;
    const x1 = cx + r * Math.cos(a), y1 = cy + r * Math.sin(a);
    const xMid = cx + inner * Math.cos(aMid), yMid = cy + inner * Math.sin(aMid);
    if (i === 0) pts += `M ${x1},${y1} `;
    pts += `L ${xMid},${yMid} `;
    const x2 = cx + r * Math.cos(aNext), y2 = cy + r * Math.sin(aNext);
    pts += `L ${x2},${y2} `;
  }
  pts += 'Z';
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r+8}" fill="#f0e0bc" stroke="#3d2817" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r+4}" fill="none" stroke="#3d2817" stroke-width="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="${r-2}" fill="none" stroke="#3d2817" stroke-width="0.5" opacity="0.5"/>
    <path d="${pts}" fill="#a87830" stroke="#3d2817" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M${cx},${cy-r} L${cx+inner*0.7},${cy-inner*0.7} L${cx},${cy} Z M${cx+r},${cy} L${cx+inner*0.7},${cy+inner*0.7} L${cx},${cy} Z" fill="#5c3d22"/>
    <text x="${cx}" y="${cy-r-13}" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="13" font-weight="bold" fill="#3d2817">N</text>
    <text x="${cx+r+15}" y="${cy+5}" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="13" font-weight="bold" fill="#3d2817">E</text>
    <text x="${cx}" y="${cy+r+19}" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="13" font-weight="bold" fill="#3d2817">S</text>
    <text x="${cx-r-15}" y="${cy+5}" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="13" font-weight="bold" fill="#3d2817">W</text>
  </g>`;
}

function seaMonsterSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <path d="M5,0 Q20,-18 35,0 T65,0 T95,0" fill="none" stroke="#3d2817" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M5,4 Q20,-14 35,4 T65,4 T95,4" fill="none" stroke="#5c3d22" stroke-width="2"/>
    <path d="M14,-12 L17,-20 L20,-12 Z" fill="#3d2817"/>
    <path d="M44,-12 L47,-20 L50,-12 Z" fill="#3d2817"/>
    <path d="M74,-12 L77,-20 L80,-12 Z" fill="#3d2817"/>
    <ellipse cx="-2" cy="-2" rx="11" ry="8" fill="#5c3d22" stroke="#3d2817" stroke-width="1.5"/>
    <circle cx="-5" cy="-4" r="2" fill="#f0e0bc"/>
    <circle cx="-5" cy="-4" r="1" fill="#3d2817"/>
    <path d="M-12,2 L-10,5 L-8,2 L-6,5 L-4,2 L-2,5 L0,2" fill="none" stroke="#3d2817" stroke-width="0.8"/>
  </g>`;
}

function treeSVG(x, y) {
  const variant = Math.abs(Math.round(x + y)) % 3;
  if (variant === 0) {
    return `<g transform="translate(${x},${y})">
      <rect x="-2" y="0" width="4" height="9" fill="#5c3d22" stroke="#3d2817" stroke-width="0.5"/>
      <circle cx="0" cy="-5" r="9" fill="#3a5a3a" stroke="#1a3a1a" stroke-width="0.8"/>
      <circle cx="-5" cy="-1" r="6" fill="#3a5a3a" stroke="#1a3a1a" stroke-width="0.6"/>
      <circle cx="5" cy="-1" r="6" fill="#3a5a3a" stroke="#1a3a1a" stroke-width="0.6"/>
    </g>`;
  } else if (variant === 1) {
    return `<g transform="translate(${x},${y})">
      <rect x="-1.5" y="0" width="3" height="8" fill="#5c3d22" stroke="#3d2817" stroke-width="0.5"/>
      <polygon points="-8,-2 8,-2 0,-18" fill="#2a4a2a" stroke="#1a3a1a" stroke-width="0.8"/>
      <polygon points="-7,-7 7,-7 0,-20" fill="#2a4a2a" stroke="#1a3a1a" stroke-width="0.8"/>
    </g>`;
  } else {
    return `<g transform="translate(${x},${y})">
      <rect x="-2" y="0" width="4" height="9" fill="#5c3d22" stroke="#3d2817" stroke-width="0.5"/>
      <ellipse cx="0" cy="-7" rx="11" ry="9" fill="#3a5a3a" stroke="#1a3a1a" stroke-width="0.8"/>
    </g>`;
  }
}

function rockSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <path d="M-10,0 Q-12,-8 -5,-12 Q5,-14 10,-8 Q12,0 0,2 Z" fill="#7a6a55" stroke="#3d2817" stroke-width="1"/>
    <path d="M-6,-6 Q-2,-9 3,-7" fill="none" stroke="#3d2817" stroke-width="0.5"/>
  </g>`;
}

function flatTopHexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 60 * Math.PI / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function renderMap() {
  const svg = document.getElementById('cityMap');
  let html = '';
  html += `<defs>
    <radialGradient id="parchGrad" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#f8eecf"/>
      <stop offset="55%" stop-color="#ecd8a8"/>
      <stop offset="100%" stop-color="#c9a878"/>
    </radialGradient>
    <radialGradient id="plazaGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e8d4a8"/>
      <stop offset="100%" stop-color="#b89866"/>
    </radialGradient>
  </defs>`;
  html += `<rect width="900" height="800" fill="url(#parchGrad)"/>`;

  const stains = [
    [80, 120, 25, 0.08], [820, 200, 35, 0.1],
    [750, 720, 30, 0.06], [100, 650, 28, 0.09],
    [450, 60, 18, 0.05], [50, 400, 22, 0.07],
    [870, 480, 24, 0.06]
  ];
  stains.forEach(([cx, cy, r, op]) => {
    html += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#5c3d22" opacity="${op}"/>`;
  });

  html += `<rect x="14" y="14" width="872" height="772" fill="none" stroke="#3d2817" stroke-width="3"/>`;
  html += `<rect x="22" y="22" width="856" height="756" fill="none" stroke="#3d2817" stroke-width="0.8"/>`;

  // Title banner
  html += `<g>
    <path d="M205,38 L695,38 L710,62 L695,86 L640,93 L260,93 L205,86 L190,62 Z"
          fill="#8b2c1e" stroke="#3d2817" stroke-width="2.5"/>
    <path d="M215,46 L685,46 L697,62 L685,78 L635,84 L265,84 L215,78 L203,62 Z"
          fill="none" stroke="#c79a4a" stroke-width="0.8"/>
    <text x="450" y="69" text-anchor="middle"
          font-family="Palatino Linotype, serif" font-size="22"
          font-variant="small-caps" letter-spacing="6" fill="#f0e0bc"
          font-weight="bold">⚜ Civitas Dishwasher ⚜</text>
  </g>`;

  html += compassRoseSVG(810, 155, 38);
  html += seaMonsterSVG(95, 705);
  html += `<text x="155" y="745" font-family="Palatino Linotype, serif" font-size="11" font-style="italic" fill="#5c3d22">Hic sunt dracones</text>`;

  const trees = [
    [60, 200], [50, 270], [75, 340], [55, 420], [70, 500], [60, 580],
    [840, 270], [855, 350], [820, 430], [840, 510], [825, 590],
    [295, 755], [370, 745], [445, 755], [520, 745], [595, 755], [670, 745], [745, 755]
  ];
  trees.forEach(([tx, ty]) => { html += treeSVG(tx, ty); });

  const rocks = [[140, 720], [770, 700], [120, 180]];
  rocks.forEach(([rx, ry]) => { html += rockSVG(rx, ry); });

  // City wall
  const wallCx = 450, wallCy = 440, wallR = 305;
  html += `
    <circle cx="${wallCx}" cy="${wallCy}" r="${wallR}" fill="#e8d4a8" fill-opacity="0.4"/>
    <circle cx="${wallCx}" cy="${wallCy}" r="${wallR}" fill="none" stroke="#5c3d22" stroke-width="11"/>
    <circle cx="${wallCx}" cy="${wallCy}" r="${wallR}" fill="none" stroke="#3d2817" stroke-width="2" stroke-dasharray="14 3"/>
    <circle cx="${wallCx}" cy="${wallCy}" r="${wallR-7}" fill="none" stroke="#3d2817" stroke-width="0.8" opacity="0.5"/>
  `;

  // 6 wall towers between hex positions
  for (let i = 0; i < 6; i++) {
    const a = i * 60 * Math.PI / 180;
    const tx = wallCx + wallR * Math.cos(a);
    const ty = wallCy + wallR * Math.sin(a);
    html += `
      <circle cx="${tx}" cy="${ty}" r="14" fill="#7a5430" stroke="#3d2817" stroke-width="2"/>
      <circle cx="${tx}" cy="${ty}" r="9" fill="#5c3d22" stroke="#3d2817" stroke-width="1"/>
      <rect x="${tx-9}" y="${ty-19}" width="3" height="5" fill="#7a5430" stroke="#3d2817" stroke-width="0.6"/>
      <rect x="${tx-4}" y="${ty-19}" width="3" height="5" fill="#7a5430" stroke="#3d2817" stroke-width="0.6"/>
      <rect x="${tx+1}" y="${ty-19}" width="3" height="5" fill="#7a5430" stroke="#3d2817" stroke-width="0.6"/>
      <rect x="${tx+6}" y="${ty-19}" width="3" height="5" fill="#7a5430" stroke="#3d2817" stroke-width="0.6"/>
    `;
  }

  // Gate at south
  html += `
    <rect x="${wallCx-22}" y="${wallCy+wallR-12}" width="44" height="24" fill="#5c3d22" stroke="#3d2817" stroke-width="2"/>
    <path d="M${wallCx-22},${wallCy+wallR-12} Q${wallCx},${wallCy+wallR-30} ${wallCx+22},${wallCy+wallR-12}" fill="#3d2817" stroke="#3d2817" stroke-width="2"/>
  `;

  // 6 family hexes (flat-top arrangement)
  const hexR = 92;
  const hexPositions = [
    [0, -hexR * Math.sqrt(3)],
    [hexR * 1.5, -hexR * Math.sqrt(3)/2],
    [hexR * 1.5, hexR * Math.sqrt(3)/2],
    [0, hexR * Math.sqrt(3)],
    [-hexR * 1.5, hexR * Math.sqrt(3)/2],
    [-hexR * 1.5, -hexR * Math.sqrt(3)/2],
  ];
  state.families.forEach((f, i) => {
    const [dx, dy] = hexPositions[i % 6];
    html += drawDistrict(f, wallCx + dx, wallCy + dy, hexR);
  });

  html += drawCentralPlaza(wallCx, wallCy, hexR * 0.55);

  const cardinals = [
    { lbl: 'Septentrio', x: wallCx, y: wallCy - wallR - 18, anchor: 'middle' },
    { lbl: 'Oriens', x: wallCx + wallR + 22, y: wallCy + 4, anchor: 'start' },
    { lbl: 'Meridies', x: wallCx, y: wallCy + wallR + 32, anchor: 'middle' },
    { lbl: 'Occidens', x: wallCx - wallR - 22, y: wallCy + 4, anchor: 'end' },
  ];
  cardinals.forEach(c => {
    html += `<text x="${c.x}" y="${c.y}" text-anchor="${c.anchor}" font-family="Palatino Linotype, serif" font-size="12" font-style="italic" fill="#5c3d22" font-variant="small-caps" letter-spacing="2">${c.lbl}</text>`;
  });

  svg.innerHTML = html;
}

function drawDistrict(f, cx, cy, r) {
  const pts = flatTopHexPoints(cx, cy, r);
  const polyStr = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

  let html = `
    <polygon points="${polyStr}" fill="${f.color}" fill-opacity="0.18" stroke="#3d2817" stroke-width="2.5" stroke-linejoin="round"/>
    <polygon points="${polyStr}" fill="none" stroke="${f.color}" stroke-width="1.2" stroke-linejoin="round" opacity="0.7"/>
  `;

  const apothem = r * Math.sqrt(3) / 2;
  const bannerY = cy - apothem + 4;
  const bannerW = r * 0.95;
  const maxTextW = bannerW - 10;
  const fitAttr = f.name.length > 10
    ? `textLength="${maxTextW}" lengthAdjust="spacingAndGlyphs"`
    : '';
  html += `
    <path d="M${cx - bannerW/2},${bannerY} L${cx + bannerW/2},${bannerY} L${cx + bannerW/2 - 5},${bannerY + 16} L${cx - bannerW/2 + 5},${bannerY + 16} Z"
          fill="${f.color}" stroke="#3d2817" stroke-width="1.3"/>
    <text x="${cx}" y="${bannerY + 12}" text-anchor="middle"
          font-family="Palatino Linotype, serif" font-size="11"
          font-variant="small-caps" letter-spacing="1.5" fill="#f0e0bc"
          font-weight="bold" ${fitAttr}>${f.name}</text>
  `;

  const coinY = bannerY + 32;
  html += `
    <text x="${cx}" y="${coinY}" text-anchor="middle"
          font-family="Palatino Linotype, serif" font-size="15"
          font-weight="bold" fill="#3d2817">${Math.floor(currentCoins(f))} ⚜</text>
  `;

  const totalB = f.buildings.S + f.buildings.M + f.buildings.L;
  if (totalB === 0) return html;

  const buildingList = [];
  for (let k = 0; k < f.buildings.L; k++) buildingList.push('L');
  for (let k = 0; k < f.buildings.M; k++) buildingList.push('M');
  for (let k = 0; k < f.buildings.S; k++) buildingList.push('S');

  const gridTop = coinY + 10;
  const gridBottom = cy + apothem - 8;
  const gridH = gridBottom - gridTop;
  const gridW = r * 1.3;

  const cols = totalB <= 6 ? 3 : (totalB <= 12 ? 4 : 5);
  const rows = Math.ceil(totalB / cols);
  const cellW = gridW / cols;
  const cellH = Math.min(cellW, gridH / Math.max(rows, 1));
  const buildingSize = Math.min(cellW, cellH) * 0.9;

  buildingList.forEach((type, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const usedW = (cols - 1) * cellW;
    const bx = cx - usedW/2 + col * cellW;
    const by = gridTop + cellH/2 + row * cellH;

    if (type === 'S') html += svgHouse(bx, by, f.color, buildingSize * 0.9);
    else if (type === 'M') html += svgManor(bx, by, f.color, buildingSize);
    else html += svgCastle(bx, by, f.color, buildingSize * 1.1);
  });

  return html;
}

function drawCentralPlaza(cx, cy, r) {
  let html = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#plazaGrad)" stroke="#3d2817" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${r-3}" fill="none" stroke="#3d2817" stroke-width="0.5" opacity="0.4"/>
  `;
  const s = r * 1.5;
  html += `
    <g transform="translate(${cx},${cy})">
      <rect x="${-s*0.45}" y="${-s*0.1}" width="${s*0.9}" height="${s*0.55}" fill="#9a7548" stroke="#3d2817" stroke-width="1.5"/>
      <rect x="${-s*0.55}" y="${-s*0.45}" width="${s*0.18}" height="${s*0.9}" fill="#9a7548" stroke="#3d2817" stroke-width="1.5"/>
      <polygon points="${-s*0.55},${-s*0.45} ${-s*0.46},${-s*0.78} ${-s*0.37},${-s*0.45}" fill="#5c3d22" stroke="#3d2817" stroke-width="1.5" stroke-linejoin="round"/>
      <line x1="${-s*0.46}" y1="${-s*0.78}" x2="${-s*0.46}" y2="${-s*0.92}" stroke="#3d2817" stroke-width="1"/>
      <circle cx="${-s*0.46}" cy="${-s*0.94}" r="${s*0.03}" fill="#a87830" stroke="#3d2817" stroke-width="0.5"/>
      <rect x="${s*0.37}" y="${-s*0.45}" width="${s*0.18}" height="${s*0.9}" fill="#9a7548" stroke="#3d2817" stroke-width="1.5"/>
      <polygon points="${s*0.37},${-s*0.45} ${s*0.46},${-s*0.78} ${s*0.55},${-s*0.45}" fill="#5c3d22" stroke="#3d2817" stroke-width="1.5" stroke-linejoin="round"/>
      <line x1="${s*0.46}" y1="${-s*0.78}" x2="${s*0.46}" y2="${-s*0.92}" stroke="#3d2817" stroke-width="1"/>
      <circle cx="${s*0.46}" cy="${-s*0.94}" r="${s*0.03}" fill="#a87830" stroke="#3d2817" stroke-width="0.5"/>
      <rect x="${-s*0.1}" y="${-s*0.4}" width="${s*0.2}" height="${s*0.5}" fill="#9a7548" stroke="#3d2817" stroke-width="1.5"/>
      <polygon points="${-s*0.1},${-s*0.4} 0,${-s*0.7} ${s*0.1},${-s*0.4}" fill="#5c3d22" stroke="#3d2817" stroke-width="1.5" stroke-linejoin="round"/>
      <rect x="${-s*0.08}" y="${s*0.25}" width="${s*0.16}" height="${s*0.2}" fill="#3d2817"/>
      <path d="M${-s*0.08},${s*0.25} Q0,${s*0.18} ${s*0.08},${s*0.25}" fill="none" stroke="#3d2817" stroke-width="1"/>
      <circle cx="0" cy="0" r="${s*0.07}" fill="#a87830" stroke="#3d2817" stroke-width="0.8"/>
      <line x1="${-s*0.07}" y1="0" x2="${s*0.07}" y2="0" stroke="#3d2817" stroke-width="0.5"/>
      <line x1="0" y1="${-s*0.07}" x2="0" y2="${s*0.07}" stroke="#3d2817" stroke-width="0.5"/>
    </g>
  `;
  html += `
    <text x="${cx}" y="${cy + r + 15}" text-anchor="middle"
          font-family="Palatino Linotype, serif" font-size="11"
          font-style="italic" fill="#3d2817" font-variant="small-caps" letter-spacing="1">Regierungsplatz</text>
  `;
  return html;
}

function renderFamilies() {
  const grid = document.getElementById('famGrid');
  let html = '';
  state.families.forEach((f, idx) => {
    const inc = income(f);
    const coins = currentCoins(f);
    const nameLen = f.name.length;
    const nameStyle = nameLen > 11
      ? `letter-spacing:${Math.max(0.5, 3 - (nameLen - 11) * 0.6)}px;font-size:${Math.max(0.78, 1 - (nameLen - 11) * 0.04)}em`
      : '';
    html += `
      <div class="fam-card">
        <img class="crest" src="crest_${f.id}.png" alt="${f.name}">

        <div class="fam-name" style="${nameStyle}">${f.name}</div>
        <div class="fam-coins">${Math.floor(coins)}</div>
        <div class="fam-income">+<b>${inc}</b> pro Stunde</div>
        <div class="fam-buildings">
          <span>S ×<b>${f.buildings.S}</b></span>
          <span>M ×<b>${f.buildings.M}</b></span>
          <span>L ×<b>${f.buildings.L}</b></span>
        </div>
        <div class="fam-edit">
          <div class="fam-edit-row">
            <button data-act="addS" data-i="${idx}">Kauf S (10)</button>
            <button data-act="addM" data-i="${idx}">Kauf M (20)</button>
            <button data-act="addL" data-i="${idx}">Kauf L (50)</button>
          </div>
          <div class="fam-edit-row">
            <button data-act="subS" data-i="${idx}">−S</button>
            <button data-act="subM" data-i="${idx}">−M</button>
            <button data-act="subL" data-i="${idx}">−L</button>
          </div>
          <div class="fam-edit-row">
            <input type="number" id="setC${idx}" placeholder="${Math.floor(coins)}">
            <button data-act="setCoins" data-i="${idx}">setzen</button>
            <button data-act="del" data-i="${idx}" class="danger">×</button>
          </div>
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

function render() {
  renderMap();
  renderFamilies();
  document.getElementById('standInfo').textContent =
    'Stand: ' + new Date(state.standTime).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' });
}

document.getElementById('famGrid').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const i = parseInt(btn.dataset.i);
  const act = btn.dataset.act;
  const f = state.families[i];
  if (!f) return;

  function buy(size) {
    snapshot();
    if (f.coinsAtStand < COST[size]) {
      if (!confirm(f.name + ' hat nur ' + f.coinsAtStand + ' Coins, ' + size + ' kostet ' + COST[size] + '. Trotzdem kaufen (Schulden)?')) return false;
    }
    f.coinsAtStand -= COST[size];
    f.buildings[size]++;
    return true;
  }
  function refund(size) {
    if (f.buildings[size] <= 0) return false;
    snapshot();
    f.buildings[size]--;
    f.coinsAtStand += COST[size];
    return true;
  }

  if (act === 'addS') { if (!buy('S')) return; }
  else if (act === 'subS') { if (!refund('S')) return; }
  else if (act === 'addM') { if (!buy('M')) return; }
  else if (act === 'subM') { if (!refund('M')) return; }
  else if (act === 'addL') { if (!buy('L')) return; }
  else if (act === 'subL') { if (!refund('L')) return; }
  else if (act === 'setCoins') {
    const v = parseInt(document.getElementById('setC' + i).value);
    if (!isNaN(v)) {
      snapshot();
      f.coinsAtStand = v;
    }
  }
  else if (act === 'del') {
    if (confirm('Familie ' + f.name + ' löschen?')) state.families.splice(i, 1);
  }
  saveState();
  render();
});

document.getElementById('editToggle').addEventListener('click', () => {
  editMode = !editMode;
  document.getElementById('editToggle').textContent = editMode ? '✓ Fertig' : '✎ Bearbeiten';
  document.getElementById('editToggle').classList.toggle('primary', editMode);
  document.getElementById('famPanel').classList.toggle('editing', editMode);
});

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dishwasher_state_' + new Date().toISOString().slice(0,16).replace(':','-') + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      state = JSON.parse(ev.target.result);
      saveState();
      render();
    } catch (err) { alert('Import fehlgeschlagen: ' + err.message); }
  };
  reader.readAsText(file);
});

document.getElementById('resetBtn')?.addEventListener('click', () => {
  if (!confirm('⚠️ ALLE Käufe des Tages werden gelöscht und der Stand auf 08:00 zurückgesetzt.\n\nWirklich fortfahren?')) return;
  const typed = prompt('Letzte Sicherheitsfrage: Tippe RESET (in Grossbuchstaben) um zu bestätigen:');
  if (typed !== 'RESET') { alert('Abgebrochen.'); return; }
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  saveState();
  render();
});

setInterval(() => {
  if (!editMode) render();
}, 1000);

render();
bootstrapSupabase();
