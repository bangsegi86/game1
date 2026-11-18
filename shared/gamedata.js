// 서버와 클라이언트가 함께 쓰는 게임 기본 데이터 (그림 데이터는 mockup/art.js)
export const TANK_IDS = ['mole', 'hammer', 'cloud', 'bee', 'magnet', 'shroom', 'whale', 'laser'];
export const TANK_NAMES = { mole: '두더지', hammer: '망치', cloud: '구름열차', bee: '불꽃벌', magnet: '자석포', shroom: '버섯포', whale: '얼음고래', laser: '레이저로봇', random: '랜덤' };
export const MAP_IDS = ['valley', 'hills', 'mesa', 'ice', 'sky', 'factory', 'shroom', 'volcano', 'moon'];
export const MAP_NAMES = { valley: '골짜기', hills: '초록언덕', mesa: '모래협곡', ice: '얼음호수', sky: '구름섬', factory: '폐공장', shroom: '버섯숲', volcano: '화산섬', moon: '달기지', random: '무작위' };
export const ITEM_SIZES = { double: 2, power: 1, repair: 1, teamrepair: 2, teleport: 2, calm: 1, shield: 1, fuel: 1 };
export const BAG_CELLS = 6;
export const TURN_SECONDS = [10, 20, 30];
export const MAX_PLAYERS = 8;
export const DEFAULT_BAG = ['double', 'power', 'repair', 'shield'];

export function bagSize(items) { return items.reduce((n, id) => n + (ITEM_SIZES[id] || 99), 0); }
export function validBag(items) { return Array.isArray(items) && items.length <= BAG_CELLS && items.every(id => ITEM_SIZES[id]) && bagSize(items) <= BAG_CELLS; }
export const RULES = {
  username: /^[A-Za-z0-9]{4,16}$/,
  passwordMin: 8, passwordMax: 64,
  nicknameMin: 2, nicknameMax: 10,
};
export function checkNickname(n) {
  if (typeof n !== 'string') return '닉네임을 입력해 주세요.';
  const s = n.trim();
  if (s.length < RULES.nicknameMin || s.length > RULES.nicknameMax) return `닉네임은 ${RULES.nicknameMin}~${RULES.nicknameMax}자로 정해 주세요.`;
  if (!/^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_]+$/.test(s)) return '닉네임에는 한글, 영문, 숫자, _ 만 쓸 수 있어요.';
  return null;
}
