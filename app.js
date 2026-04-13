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
  verkehrteZeit: false,
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
  const sign = state.verkehrteZeit ? -1 : 1;
  return f.coinsAtStand + sign * income(f) * elapsedH;
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

function dragonMountainSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <polygon points="-42,32 -22,-18 -2,2 18,-38 42,32" fill="#7a6a55" stroke="#3d2817" stroke-width="1.2" stroke-linejoin="round"/>
    <polygon points="-42,32 -22,-18 -15,-2 -2,2 8,-8 18,-38 28,-5 42,32" fill="#5c4a35" opacity="0.35"/>
    <polygon points="15,-35 21,-35 24,-28 12,-28" fill="#f0e0bc" opacity="0.75"/>
    <ellipse cx="4" cy="-20" rx="11" ry="5" fill="#8b2c1e" stroke="#3d2817" stroke-width="1"/>
    <circle cx="14" cy="-24" r="4" fill="#8b2c1e" stroke="#3d2817" stroke-width="1"/>
    <path d="M13,-28 L11,-32 M16,-28 L18,-32" stroke="#3d2817" stroke-width="1"/>
    <path d="M-2,-22 Q-6,-32 4,-30 Q7,-24 -2,-22" fill="#5c1a12" stroke="#3d2817" stroke-width="0.8"/>
    <path d="M-6,-20 Q-14,-17 -16,-22 Q-13,-14 -6,-14" fill="none" stroke="#8b2c1e" stroke-width="2.5"/>
    <path d="M18,-24 Q24,-23 26,-19 Q28,-24 31,-20" fill="none" stroke="#c79a4a" stroke-width="1.5"/>
    <circle cx="15" cy="-24" r="0.7" fill="#f0e0bc"/>
    <text x="0" y="46" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-style="italic" fill="#5c3d22">Mons Draconis</text>
  </g>`;
}

function krakenSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <path d="M-36,2 Q-26,-4 -16,2 T4,2 T24,2 T40,2" fill="none" stroke="#3d2817" stroke-width="1.2"/>
    <path d="M-36,6 Q-26,0 -16,6 T4,6 T24,6 T40,6" fill="none" stroke="#5c3d22" stroke-width="0.8" opacity="0.7"/>
    <line x1="-6" y1="-18" x2="-4" y2="5" stroke="#5c3d22" stroke-width="2.5"/>
    <polygon points="-6,-16 -15,-8 -6,-10" fill="#f0e0bc" stroke="#3d2817" stroke-width="0.8"/>
    <line x1="-6" y1="-13" x2="3" y2="-13" stroke="#5c3d22" stroke-width="1"/>
    <path d="M-14,3 Q-4,9 10,3 L8,7 Q-4,11 -12,7 Z" fill="#5c3d22" stroke="#3d2817" stroke-width="1"/>
    <ellipse cx="22" cy="-3" rx="14" ry="10" fill="#2a4a5a" stroke="#3d2817" stroke-width="1.5"/>
    <circle cx="16" cy="-6" r="2" fill="#f0e0bc"/>
    <circle cx="16" cy="-6" r="1" fill="#3d2817"/>
    <circle cx="26" cy="-7" r="1.6" fill="#f0e0bc"/>
    <circle cx="26" cy="-7" r="0.8" fill="#3d2817"/>
    <path d="M10,4 Q2,10 -8,5 Q-2,12 -12,12" fill="none" stroke="#2a4a5a" stroke-width="3" stroke-linecap="round"/>
    <path d="M16,7 Q18,14 10,16" fill="none" stroke="#2a4a5a" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M26,7 Q33,12 30,20" fill="none" stroke="#2a4a5a" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M34,3 Q42,6 40,13" fill="none" stroke="#2a4a5a" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M32,-10 Q40,-14 38,-20" fill="none" stroke="#2a4a5a" stroke-width="2.5" stroke-linecap="round"/>
    <text x="4" y="30" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-style="italic" fill="#5c3d22">Navis Perdita</text>
  </g>`;
}

function ufoSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <polygon points="-8,2 8,2 14,22 -14,22" fill="#c79a4a" opacity="0.22"/>
    <ellipse cx="0" cy="0" rx="16" ry="4" fill="#5c3d22" stroke="#3d2817" stroke-width="1.2"/>
    <ellipse cx="0" cy="-1" rx="12" ry="3" fill="#7a6a55" stroke="#3d2817" stroke-width="0.8"/>
    <path d="M-8,-1 Q-8,-9 0,-9 Q8,-9 8,-1 Z" fill="#a87830" stroke="#3d2817" stroke-width="1"/>
    <ellipse cx="-3" cy="-5" rx="2" ry="2" fill="#f0e0bc" opacity="0.75"/>
    <circle cx="-10" cy="1" r="1.2" fill="#c79a4a"/>
    <circle cx="-4" cy="1.5" r="1.2" fill="#8b2c1e"/>
    <circle cx="4" cy="1.5" r="1.2" fill="#c79a4a"/>
    <circle cx="10" cy="1" r="1.2" fill="#8b2c1e"/>
    <text x="0" y="34" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-style="italic" fill="#5c3d22">Quid est hoc?</text>
  </g>`;
}

function mermaidSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <path d="M-16,4 Q-18,-6 -8,-9 Q6,-11 14,-3 Q16,6 0,8 Z" fill="#7a6a55" stroke="#3d2817" stroke-width="1"/>
    <circle cx="-2" cy="-16" r="3.8" fill="#e8c8a0" stroke="#3d2817" stroke-width="0.8"/>
    <circle cx="-3.5" cy="-16.5" r="0.5" fill="#3d2817"/>
    <path d="M-5,-17 Q-11,-10 -6,-5" fill="none" stroke="#8b2c1e" stroke-width="1.8"/>
    <path d="M-1,-19 Q4,-19 4,-13" fill="none" stroke="#8b2c1e" stroke-width="1.8"/>
    <path d="M-5,-15 Q-9,-6 -4,-2" fill="#8b2c1e" stroke="#3d2817" stroke-width="0.6" opacity="0.8"/>
    <path d="M-5,-13 Q-2,-6 5,-7 Q7,-11 -5,-13" fill="#e8c8a0" stroke="#3d2817" stroke-width="0.8"/>
    <path d="M5,-7 Q13,-5 15,-11 Q19,-7 17,1 Q11,-1 5,-3 Z" fill="#3a5a3a" stroke="#3d2817" stroke-width="1"/>
    <path d="M16,-10 Q22,-13 20,-5" fill="#3a5a3a" stroke="#3d2817" stroke-width="0.8"/>
    <line x1="7" y1="-6" x2="11" y2="-5" stroke="#2a4a2a" stroke-width="0.6"/>
    <line x1="9" y1="-8" x2="13" y2="-7" stroke="#2a4a2a" stroke-width="0.6"/>
    <text x="0" y="22" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-style="italic" fill="#5c3d22">Sirena Cantans</text>
  </g>`;
}

function knightSnailSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <rect x="-22" y="-4" width="6" height="10" fill="#5a5a65" stroke="#3d2817" stroke-width="0.8"/>
    <rect x="-24" y="-13" width="10" height="9" fill="#5a5a65" stroke="#3d2817" stroke-width="0.8"/>
    <rect x="-21" y="-11" width="4" height="2" fill="#3d2817"/>
    <polygon points="-24,-13 -19,-20 -14,-13" fill="#8b2c1e" stroke="#3d2817" stroke-width="0.8"/>
    <line x1="-16" y1="-18" x2="-14" y2="-22" stroke="#3d2817" stroke-width="0.6"/>
    <rect x="-20" y="6" width="2" height="6" fill="#3d2817"/>
    <rect x="-17" y="6" width="2" height="6" fill="#3d2817"/>
    <line x1="-15" y1="-4" x2="-1" y2="-14" stroke="#3d2817" stroke-width="2"/>
    <polygon points="-1,-14 -4,-17 -1,-19 2,-16" fill="#c79a4a" stroke="#3d2817" stroke-width="0.5"/>
    <path d="M-29,-4 Q-32,-2 -31,4 Q-29,8 -27,4 Q-26,-2 -29,-4" fill="#3a5a3a" stroke="#3d2817" stroke-width="0.8"/>
    <line x1="-29" y1="0" x2="-27" y2="0" stroke="#c79a4a" stroke-width="0.6"/>
    <line x1="-28" y1="-2" x2="-28" y2="2" stroke="#c79a4a" stroke-width="0.6"/>
    <ellipse cx="12" cy="5" rx="9" ry="3" fill="#9a7548" stroke="#3d2817" stroke-width="0.8"/>
    <circle cx="12" cy="-1" r="7" fill="#7a5430" stroke="#3d2817" stroke-width="1"/>
    <circle cx="12" cy="-1" r="4" fill="none" stroke="#3d2817" stroke-width="0.8"/>
    <circle cx="12" cy="-1" r="2" fill="none" stroke="#3d2817" stroke-width="0.6"/>
    <line x1="6" y1="1" x2="2" y2="-5" stroke="#3d2817" stroke-width="0.9"/>
    <line x1="8" y1="0" x2="5" y2="-6" stroke="#3d2817" stroke-width="0.9"/>
    <circle cx="2" cy="-5" r="0.9" fill="#3d2817"/>
    <circle cx="5" cy="-6" r="0.9" fill="#3d2817"/>
    <text x="-6" y="22" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-style="italic" fill="#5c3d22">Certamen Heroicum</text>
  </g>`;
}

function pulexMaximusSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <ellipse cx="0" cy="0" rx="14" ry="11" fill="#5c3d22" stroke="#3d2817" stroke-width="1.2"/>
    <ellipse cx="-3" cy="-3" rx="6" ry="4" fill="#7a5430" stroke="#3d2817" stroke-width="0.6" opacity="0.7"/>
    <circle cx="-14" cy="-2" r="5" fill="#5c3d22" stroke="#3d2817" stroke-width="1"/>
    <circle cx="-16" cy="-3" r="1.1" fill="#f0e0bc"/>
    <circle cx="-16" cy="-3" r="0.5" fill="#3d2817"/>
    <path d="M-17,-6 Q-21,-13 -17,-15" fill="none" stroke="#3d2817" stroke-width="1"/>
    <path d="M-15,-6 Q-12,-13 -8,-14" fill="none" stroke="#3d2817" stroke-width="1"/>
    <circle cx="-17" cy="-15" r="0.7" fill="#3d2817"/>
    <circle cx="-8" cy="-14" r="0.7" fill="#3d2817"/>
    <path d="M-8,9 L-13,14" stroke="#3d2817" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M-3,10 L-6,16" stroke="#3d2817" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M2,10 L5,16" stroke="#3d2817" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M7,9 L12,14" stroke="#3d2817" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M9,3 Q18,-2 15,-10 Q12,-5 18,-3" fill="none" stroke="#3d2817" stroke-width="2" stroke-linecap="round"/>
    <path d="M-20,-10 L-18,-14 L-16,-11 L-14,-14 L-12,-10 Z" fill="#c79a4a" stroke="#3d2817" stroke-width="0.6"/>
    <text x="0" y="26" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-weight="bold" font-style="italic" fill="#5c3d22">Pulex Maximus</text>
    <text x="0" y="36" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="7" font-style="italic" fill="#5c3d22">Princeps Agrorum</text>
  </g>`;
}

function treasureSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <path d="M-65,-15 Q-50,-22 -35,-14 Q-20,-4 -10,-12 Q-3,-16 -1,-4" fill="none" stroke="#8b2c1e" stroke-width="1.3" stroke-dasharray="4 3"/>
    <line x1="-8" y1="-4" x2="8" y2="12" stroke="#8b2c1e" stroke-width="3"/>
    <line x1="8" y1="-4" x2="-8" y2="12" stroke="#8b2c1e" stroke-width="3"/>
    <text x="0" y="26" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="9" font-style="italic" fill="#5c3d22">Thesaurus</text>
  </g>`;
}

function dishwasherArtefactSVG(x, y) {
  return `<g transform="translate(${x},${y})">
    <path d="M-18,6 Q0,9 18,6 L18,12 L-18,12 Z" fill="#7a6a55" stroke="#3d2817" stroke-width="0.8"/>
    <rect x="-13" y="-10" width="26" height="15" fill="#5a5a65" stroke="#3d2817" stroke-width="1"/>
    <rect x="-11" y="-8" width="22" height="7" fill="#2a4a5a" stroke="#3d2817" stroke-width="0.6"/>
    <rect x="-10" y="-7" width="20" height="5" fill="#1a2a3a"/>
    <circle cx="-7" cy="2" r="1.2" fill="#c79a4a" stroke="#3d2817" stroke-width="0.3"/>
    <circle cx="-2" cy="2" r="1.2" fill="#c79a4a" stroke="#3d2817" stroke-width="0.3"/>
    <circle cx="3" cy="2" r="1.2" fill="#c79a4a" stroke="#3d2817" stroke-width="0.3"/>
    <circle cx="8" cy="2" r="1.4" fill="#8b2c1e" stroke="#3d2817" stroke-width="0.4"/>
    <text x="0" y="26" text-anchor="middle" font-family="Palatino Linotype, serif" font-size="7" font-style="italic" fill="#5c3d22">Artefactum Ignotum</text>
  </g>`;
}

function fitFlexText(root) {
  const nodes = root.querySelectorAll('text[data-fit-w]');
  nodes.forEach(el => {
    const maxW = parseFloat(el.getAttribute('data-fit-w'));
    const minSize = parseFloat(el.getAttribute('data-fit-min') || '6');
    let origSize = parseFloat(el.getAttribute('data-fit-orig-size'));
    let origLs = parseFloat(el.getAttribute('data-fit-orig-ls'));
    if (isNaN(origSize)) {
      origSize = parseFloat(el.getAttribute('font-size')) || 11;
      el.setAttribute('data-fit-orig-size', origSize);
    }
    if (isNaN(origLs)) {
      origLs = parseFloat(el.getAttribute('letter-spacing')) || 0;
      el.setAttribute('data-fit-orig-ls', origLs);
    }
    el.setAttribute('font-size', origSize);
    el.setAttribute('letter-spacing', origLs);
    let w;
    try { w = el.getComputedTextLength(); } catch (e) { return; }
    if (w <= maxW) return;
    const scale = Math.max(minSize / origSize, maxW / w);
    el.setAttribute('font-size', (origSize * scale).toFixed(2));
    el.setAttribute('letter-spacing', (origLs * scale).toFixed(2));
  });
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
  html += `<rect width="900" height="820" fill="url(#parchGrad)"/>`;

  const stains = [
    [80, 120, 25, 0.08], [820, 200, 35, 0.1],
    [750, 720, 30, 0.06], [100, 650, 28, 0.09],
    [450, 60, 18, 0.05], [50, 400, 22, 0.07],
    [870, 480, 24, 0.06]
  ];
  stains.forEach(([cx, cy, r, op]) => {
    html += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#5c3d22" opacity="${op}"/>`;
  });

  html += `<rect x="14" y="14" width="872" height="792" fill="none" stroke="#3d2817" stroke-width="3"/>`;
  html += `<rect x="22" y="22" width="856" height="776" fill="none" stroke="#3d2817" stroke-width="0.8"/>`;

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

  html += dragonMountainSVG(155, 95);
  html += krakenSVG(330, 122);
  html += ufoSVG(620, 130);
  html += mermaidSVG(260, 770);
  html += knightSnailSVG(395, 795);
  html += pulexMaximusSVG(828, 660);
  html += treasureSVG(835, 750);
  html += dishwasherArtefactSVG(820, 220);

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
  fitFlexText(svg);
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
  const maxTextW = bannerW - 12;
  html += `
    <path d="M${cx - bannerW/2},${bannerY} L${cx + bannerW/2},${bannerY} L${cx + bannerW/2 - 5},${bannerY + 16} L${cx - bannerW/2 + 5},${bannerY + 16} Z"
          fill="${f.color}" stroke="#3d2817" stroke-width="1.3"/>
    <text x="${cx}" y="${bannerY + 12}" text-anchor="middle"
          font-family="Palatino Linotype, serif" font-size="11"
          font-variant="small-caps" letter-spacing="1.5" fill="#f0e0bc"
          font-weight="bold" data-fit-w="${maxTextW.toFixed(1)}" data-fit-min="7">${f.name}</text>
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
        <div class="fam-income${state.verkehrteZeit ? ' verkehrt' : ''}">${state.verkehrteZeit ? '−' : '+'}<b>${inc}</b> pro Stunde</div>
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
  document.body.classList.toggle('verkehrte-zeit', !!state.verkehrteZeit);
  const h1 = document.querySelector('h1');
  if (h1) h1.textContent = state.verkehrteZeit ? '★ REHSAWHSID ★' : '★ DISHWASHER ★';
  const sub = document.querySelector('.subtitle');
  if (sub) sub.textContent = state.verkehrteZeit
    ? 'Verkehrtes Vermögensregister · Anno MMXXVI retrograd'
    : 'Königliches Vermögensregister · Anno MMXXVI';
  renderMap();
  renderFamilies();
  const fmt = d => new Date(d).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' });
  const prefix = state.verkehrteZeit ? 'Verkehrte Zeit · ' : '';
  document.getElementById('standInfo').innerHTML =
    prefix + 'Stand letzter manueller Eingabe: ' + fmt(state.standTime) +
    '<br>Letzte Aktualisierung Dividenden: ' + fmt(Date.now());
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
  if (!editMode) {
    const pw = prompt('Passwort:');
    if (pw === null) return;
    if (pw !== 'AndiArbeit') {
      alert('Falsches Passwort.');
      return;
    }
  }
  editMode = !editMode;
  document.getElementById('editToggle').textContent = editMode ? '✓ Fertig' : '✎ Bearbeiten';
  document.getElementById('editToggle').classList.toggle('primary', editMode);
  document.getElementById('famPanel').classList.toggle('editing', editMode);
});

document.getElementById('exportBtn')?.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dishwasher_state_' + new Date().toISOString().slice(0,16).replace(':','-') + '.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn')?.addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile')?.addEventListener('change', e => {
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

window.verkehrteZeit = function(force) {
  const target = (typeof force === 'boolean') ? force : !state.verkehrteZeit;
  if (target === !!state.verkehrteZeit) {
    console.log('%c  Verkehrte Zeit ist bereits ' + (target ? 'AKTIV.' : 'AUS.') + '  ', 'color: #a87830; font-style: italic;');
    return target;
  }
  snapshot();
  state.verkehrteZeit = target;
  state.standTime = new Date().toISOString();
  saveState();
  render();
  if (target) {
    console.log('%c  DIE ZEIT VERKEHRT SICH · Anno MMXXVI retrograd  ', 'background: #8b2c1e; color: #f0e0bc; font-size: 16px; padding: 8px 16px; font-variant: small-caps; letter-spacing: 3px;');
  } else {
    console.log('%c  DIE ORDNUNG KEHRT ZURÜCK  ', 'background: #3a5a3a; color: #f0e0bc; font-size: 16px; padding: 8px 16px; font-variant: small-caps; letter-spacing: 3px;');
  }
  return target;
};
window.vz = window.verkehrteZeit;

console.log('%c  Dishwasher TABS · Konsolen-Befehle  ', 'background: #3d2817; color: #c79a4a; font-weight: bold; font-size: 13px; padding: 4px 10px; letter-spacing: 2px;');
console.log('%c   verkehrteZeit()       ', 'font-family: monospace; color: #f0e0bc; background: #5c3d22; padding: 2px 6px;', '— toggle ein/aus');
console.log('%c   verkehrteZeit(true)   ', 'font-family: monospace; color: #f0e0bc; background: #5c3d22; padding: 2px 6px;', '— erzwingt AN');
console.log('%c   verkehrteZeit(false)  ', 'font-family: monospace; color: #f0e0bc; background: #5c3d22; padding: 2px 6px;', '— erzwingt AUS');
console.log('%c   vz()                  ', 'font-family: monospace; color: #f0e0bc; background: #5c3d22; padding: 2px 6px;', '— Kurzform');

render();
bootstrapSupabase();
