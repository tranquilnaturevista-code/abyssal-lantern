// Every tuning number and colour of Abyssal Lantern in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. Depth is measured in metres; the world sinks at DESCENT metres a second
// and the zones below mark how deep (and how dangerous) the water has become.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Metres of depth gained every second, before the zone bonus is added. */
export const DESCENT = { base: 9, perZone: 2.5 };

export const PLAYER = {
  radius: 20,
  accel: 1500,
  maxSpeed: 300,
  drag: 2.4,
  dashSpeed: 720,
  dashTime: 0.22,
  dashCooldown: 1.1,
  invulnerable: 2,
};

export const LIVES = 3;
export const LIVES_MAX = 5;

export const OXYGEN = {
  max: 100,
  drain: 1.1,
  drainPerZone: 0.14,
  bubbleRefill: 25,
  lowWarn: 30,
};

/** Pearls pay 10 points times the combo multiplier; the combo grows while pearls keep coming. */
export const PEARL = { radius: 10, points: 10, comboWindow: 3, comboMax: 8, speed: 46 };

export const BUBBLE = { radius: 12, speed: 62 };

export const ANGLER = {
  radius: 24,
  speed: 104,
  speedPerZone: 12,
  interval: 4.8,
  intervalScale: 0.88,
  minInterval: 2.4,
};

export const URCHIN = { radius: 17, speed: 52, interval: 5.6, intervalScale: 0.9, minInterval: 3 };

export const JELLY = { radius: 19, speed: 58, interval: 7, intervalScale: 0.92, minInterval: 4 };

/** Star (double points + invulnerable) and heart (an extra life) are rare drifting gifts. */
export const POWERUP = { starSeconds: 5, starInterval: 26, heartInterval: 55, radius: 13 };

/** Seconds of play per level are depth-driven instead: the zones are the levels. */
export const ZONES = [
  { depth: 0, name: 'Sunlit Twilight', top: '#0d4a6b', bottom: '#062a44', glow: '#7fe7ff' },
  { depth: 200, name: 'Midnight Zone', top: '#0a2c50', bottom: '#04101f', glow: '#6fd8ff' },
  { depth: 500, name: 'The Abyss', top: '#131034', bottom: '#050510', glow: '#9db4ff' },
  { depth: 800, name: 'The Trench', top: '#1d0a2e', bottom: '#050208', glow: '#ffb3d9' },
];

/** Reaching a new zone pays this bonus, and the Trench itself pays the victory bonus. */
export const ZONE_BONUS = 100;
export const TRENCH_BONUS = 500;

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOL = { entity: 96, particle: 240, text: 24, mote: 70 };

export const PALETTE = {
  panel: 'rgba(4, 12, 24, 0.62)',
  text: '#eaf6ff',
  muted: '#9db8cc',
  gold: '#ffd76a',
  danger: '#ff6b6b',
  oxygen: '#5fd4ff',
  heart: '#ff7d9c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'abyssal-lantern.best';
