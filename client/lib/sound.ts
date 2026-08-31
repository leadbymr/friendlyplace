let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/* iOS требует явного resume по пользовательскому жесту */
export function unlockAudio() {
  const ac = ensureCtx();
  if (ac && ac.state === 'suspended') void ac.resume();
  // «прогреваем» контекст тихим буфером, чтобы iOS разрешил звук
  try {
    if (ac) {
      const buffer = ac.createBuffer(1, 1, 22050);
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.connect(ac.destination);
      src.start(0);
    }
  } catch {
    /* ignore */
  }
}

export function playClick() {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;

  const dur = 0.06;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
  }
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const nf = ac.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 2500;
  nf.Q.value = 1.2;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.1, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(ac.destination);
  noise.start(t);

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.07);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

export function playMatch() {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  [392, 523.25, 659.25].forEach((f, i) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t + i * 0.08);
    g.gain.setValueAtTime(0.0001, t + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.09, t + i * 0.08 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.5);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.55);
  });
}

export function playMessage() {
  const ac = ensureCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.06, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}