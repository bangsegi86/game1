// 효과음: 파일 없이 브라우저에서 바로 만들어 낸다 (Web Audio). 처음 클릭·키 입력 뒤에 켜진다
let ac = null, master = null, muted = false;
try { muted = localStorage.getItem('sc_mute') === '1'; } catch {}
function ctx() {
  if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); master = ac.createGain(); master.gain.value = muted ? 0 : .5; master.connect(ac.destination); }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => ctx(), { once: true }));
function noise(dur) { const a = ac, b = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = a.createBufferSource(); s.buffer = b; return s; }
function env(node, t, peak, attack, decay) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + attack); node.gain.exponentialRampToValueAtTime(.001, t + attack + decay); }
function tone(type, f0, f1, dur, vol, delay = 0) {
  const a = ac, t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, vol, .005, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
function burst(dur, cutoff, vol, delay = 0, q = .7) {
  const a = ac, t = a.currentTime + delay, s = noise(dur + .1), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff / 6), t + dur); f.Q.value = q;
  env(g, t, vol, .004, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .1);
}
const SFX = {
  fire: () => { burst(.18, 1800, .5); tone('square', 180, 60, .15, .18); },
  boom: big => { burst(big ? .9 : .5, big ? 900 : 1400, big ? .9 : .65); tone('sine', big ? 90 : 120, 35, big ? .7 : .4, .5); },
  hit: () => { tone('square', 520, 260, .09, .12); },
  splash: () => { burst(.45, 3500, .35, 0, 3); },
  item: () => { tone('triangle', 660, 0, .08, .2); tone('triangle', 990, 0, .12, .2, .07); },
  turn: () => { tone('sine', 784, 0, .12, .22); tone('sine', 1175, 0, .2, .22, .1); },
  banner: () => { tone('sawtooth', 220, 440, .35, .12); tone('sawtooth', 330, 660, .35, .1, .05); },
  zap: () => { burst(.25, 6000, .3, 0, 8); tone('sawtooth', 1400, 200, .2, .12); },
  tick: () => { tone('square', 1200, 0, .03, .06); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, .25, .2, i * .12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone('triangle', f, 0, .3, .18, i * .16)),
};
export function play(name, arg) { if (muted) return; const a = ctx(); if (!a || a.state !== 'running') return; try { SFX[name]?.(arg); } catch {} }
export function setMuted(m) { muted = m; try { localStorage.setItem('sc_mute', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : .5; }
export const isMuted = () => muted;
