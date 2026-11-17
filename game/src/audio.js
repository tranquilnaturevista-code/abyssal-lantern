// Every sound is synthesised with the Web Audio API at run time: no audio files, no
// network. The context is created on the first user gesture, so a page that never gets one
// stays silent, and M mutes everything.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = 0) {
    if (!ensure() || muted || context === null || master === null) return;
    try {
      const start = context.currentTime + when;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, freq), start);
      if (slideTo > 0) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish: a failure here never breaks the game.
    }
  }

  function noise(seconds, volume, when = 0, lowpass = 1200) {
    if (!ensure() || muted || context === null || master === null) return;
    try {
      const start = context.currentTime + when;
      const length = Math.max(1, Math.floor(context.sampleRate * seconds));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound is garnish: a failure here never breaks the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    collect(combo) {
      const base = 540 + Math.min(combo, 8) * 45;
      tone(base, 0.12, 'sine', 0.5);
      tone(base * 1.5, 0.16, 'sine', 0.4, 0.06);
    },
    bubble() {
      tone(880, 0.14, 'sine', 0.4, 0, 520);
    },
    dash() {
      noise(0.18, 0.35, 0, 2400);
    },
    hit() {
      tone(120, 0.28, 'sawtooth', 0.55, 0, 55);
      noise(0.2, 0.5, 0, 700);
    },
    star() {
      tone(660, 0.12, 'triangle', 0.45);
      tone(880, 0.12, 'triangle', 0.45, 0.08);
      tone(1320, 0.2, 'triangle', 0.4, 0.16);
    },
    heart() {
      tone(523, 0.14, 'sine', 0.45);
      tone(784, 0.2, 'sine', 0.45, 0.1);
    },
    zone() {
      tone(523, 0.14, 'triangle', 0.45);
      tone(659, 0.14, 'triangle', 0.45, 0.1);
      tone(784, 0.26, 'triangle', 0.45, 0.2);
    },
    start() {
      tone(392, 0.12, 'sine', 0.4);
      tone(523, 0.12, 'sine', 0.4, 0.09);
      tone(659, 0.22, 'sine', 0.4, 0.18);
    },
    over() {
      tone(392, 0.3, 'triangle', 0.45);
      tone(311, 0.3, 'triangle', 0.45, 0.25);
      tone(233, 0.55, 'triangle', 0.45, 0.5);
    },
  };
}
