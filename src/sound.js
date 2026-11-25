// 효과음(기본 꺼짐): 파일 없이 Web Audio로 짧게 합성한다(동전·잡기·성공).
let context = null;

function tone(ctx, { freq, start, length, type = 'square', gain = 0.06, to = null }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + start + length);
  amp.gain.setValueAtTime(gain, ctx.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + length + 0.02);
}

const SOUNDS = {
  coin: [{ freq: 988, start: 0, length: 0.08 }, { freq: 1319, start: 0.08, length: 0.22 }],
  grab: [{ freq: 220, start: 0, length: 0.18, type: 'triangle', gain: 0.12, to: 110 }],
  prize: [523, 659, 784, 1047].map((freq, index) => ({ freq, start: index * 0.09, length: 0.16, type: 'triangle', gain: 0.1 })),
};

export function playSound(name) {
  try {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    if (context.state === 'suspended') context.resume();
    for (const note of SOUNDS[name] || []) tone(context, note);
  } catch { /* 소리는 없어도 된다 */ }
}
