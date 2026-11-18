// 서버와 클라이언트가 함께 쓰는 게임 기본 데이터 (그림 데이터는 mockup/art.js)
export const TANK_IDS = ['mole', 'hammer', 'cloud', 'bee', 'magnet', 'shroom', 'whale', 'laser'];
export const TANK_NAMES = { mole: '두더지', hammer: '망치', cloud: '구름열차', bee: '불꽃벌', magnet: '자석포', shroom: '버섯포', whale: '얼음고래', laser: '레이저로봇', random: '랜덤' };
export const MAP_IDS = ['hills', 'valley', 'dunes', 'snow'];
export const MAP_NAMES = { hills: '초록언덕', valley: '골짜기', dunes: '모래언덕', snow: '눈벌판', random: '무작위' };
export const ITEM_SIZES = { double: 2, power: 1, repair: 1, teamrepair: 2, teleport: 2, calm: 1, shield: 1, fuel: 1 };
export const BAG_CELLS = 6;
export const TURN_SECONDS = [10, 20, 30];
export const MAX_PLAYERS = 8;
export const DEFAULT_BAG = ['double', 'power', 'repair', 'shield'];

export function bagSize(items) { return items.reduce((n, id) => n + (ITEM_SIZES[id] || 99), 0); }
export function validBag(items) { return Array.isArray(items) && items.length <= BAG_CELLS && items.every(id => ITEM_SIZES[id]) && bagSize(items) <= BAG_CELLS; }
export const RULES = {
  username: /^[A-Za-z0-9]{4,16}$/,
  passwordMin: 1, passwordMax: 200,
  nicknameMin: 2, nicknameMax: 10,
};
export function checkNickname(n) {
  if (typeof n !== 'string') return '닉네임을 입력해 주세요.';
  const s = n.trim();
  if (s.length < RULES.nicknameMin || s.length > RULES.nicknameMax) return `닉네임은 ${RULES.nicknameMin}~${RULES.nicknameMax}자로 정해 주세요.`;
  if (!/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]+$/.test(s)) return '닉네임에는 한글, 영문, 숫자, _ 만 쓸 수 있어요.';
  return null;
}

/* ---------- 전투 수치 (그림은 mockup/art.js, 수치는 여기) ---------- */
export const TANK_STATS = {
  mole:   { hp: 1000, amin: 0,  amax: 70, pivot: [-8, -50], len: 42, w: 96 },
  hammer: { hp: 1200, amin: 20, amax: 60, pivot: [12, -60], len: 46, w: 112 },
  cloud:  { hp: 900,  amin: 30, amax: 90, pivot: [18, -46], len: 38, w: 92, hover: true },
  bee:    { hp: 950,  amin: 0,  amax: 80, pivot: [40, -32], len: 30, w: 90 },
  magnet: { hp: 1000, amin: 10, amax: 70, pivot: [30, -46], len: 36, w: 100 },
  shroom: { hp: 1050, amin: 25, amax: 85, pivot: [32, -32], len: 34, w: 96 },
  whale:  { hp: 1100, amin: 5,  amax: 65, pivot: [14, -60], len: 34, w: 104 },
  laser:  { hp: 850,  amin: 0,  amax: 45, pivot: [-20, -58], len: 44, w: 96 },
};
// dmg 피해, r 피해 반경, cr 파임 반경, wind 바람계수, wt 무게계수, R 폭발 그림 크기
export const SHELL_STATS = {
  mole:   [{ n: '돌탄', dmg: 200, r: 34, cr: 34, wind: 1, wt: 1, R: 24 }, { n: '파편탄', dmg: 110, r: 24, cr: 20, wind: 1, wt: 1, R: 15, spread: [-1.5, 0, 1.5], pspread: [.91, 1, 1.09] }, { n: '땅굴 폭탄', dmg: 380, r: 60, cr: 50, wind: .8, wt: 1.1, R: 36, shape: 'tunnel', sp: 'erupt' }],
  hammer: [{ n: '철구', dmg: 260, r: 30, cr: 30, wind: .5, wt: 1.2, R: 24 }, { n: '지진탄', dmg: 230, r: 44, cr: [70, 24], wind: .6, wt: 1.2, R: 28, shape: 'ellipse' }, { n: '메테오', dmg: 480, r: 56, cr: 64, wind: .4, wt: 1.3, R: 44, sp: 'meteor' }],
  cloud:  [{ n: '물방울', dmg: 180, r: 30, cr: 18, wind: 1.2, wt: .9, R: 22 }, { n: '번개구름', dmg: 210, r: 30, cr: 26, wind: 0, wt: 1, R: 24 }, { n: '폭풍', dmg: 300, r: 70, cr: 20, wind: 1.5, wt: .8, R: 40, sp: 'tornado' }],
  bee:    [{ n: '불씨', dmg: 190, r: 30, cr: 30, wind: 1, wt: 1, R: 22 }, { n: '화염병', dmg: 160, r: 36, cr: 22, wind: 1, wt: 1, R: 26, fx: 'burn' }, { n: '불사조', dmg: 420, r: 50, cr: 48, wind: .7, wt: .9, R: 40, sp: 'phoenix' }],
  magnet: [{ n: '자기탄', dmg: 190, r: 30, cr: 30, wind: 1, wt: 1, R: 22 }, { n: '끌어당김탄', dmg: 220, r: 30, cr: 30, wind: 1, wt: 1, R: 24, fx: 'home' }, { n: '자기폭풍', dmg: 340, r: 64, cr: 40, wind: .8, wt: 1, R: 40, sp: 'storm' }],
  shroom: [{ n: '포자', dmg: 170, r: 30, cr: 26, wind: 1.4, wt: .8, R: 22 }, { n: '포자비', dmg: 70, r: 20, cr: 14, wind: 1.4, wt: .8, R: 12, spread: [-3, -1.5, 0, 1.5, 3], pspread: [.84, .92, 1, 1.08, 1.16] }, { n: '독버섯밭', dmg: 240, r: 60, cr: 30, wind: 1, wt: 1, R: 38, sp: 'shroom' }],
  whale:  [{ n: '얼음덩이', dmg: 200, r: 32, cr: 30, wind: .9, wt: 1.1, R: 24 }, { n: '빙결탄', dmg: 150, r: 32, cr: 16, wind: 1, wt: 1, R: 26, fx: 'freeze' }, { n: '해일', dmg: 400, r: 62, cr: 40, wind: .6, wt: 1.2, R: 42, sp: 'wave' }],
  laser:  [{ n: '빔탄', dmg: 210, r: 28, cr: 28, wind: .7, wt: .9, R: 22 }, { n: '관통 레이저', dmg: 170, r: 22, cr: 12, wind: 0, wt: 0, R: 20, shape: 'line' }, { n: '궁극 빔', dmg: 500, r: 44, cr: 40, wind: 0, wt: 1, R: 40, sp: 'ufo' }],
};
export const SLOT_DELAY = [0, 60, 120];
export const ITEM_INFO = {
  double: { n: '연발탄', delay: 150 }, power: { n: '강화탄', delay: 80 }, repair: { n: '수리킷', delay: 60 }, teamrepair: { n: '팀 수리킷', delay: 120 },
  teleport: { n: '순간이동탄', delay: 100 }, calm: { n: '바람정지', delay: 50 }, shield: { n: '보호막', delay: 70 }, fuel: { n: '연료통', delay: 30 },
};
export const TURN_BASE_DELAY = 100;
export const SUDDEN_DEATH_TURN = 30;
