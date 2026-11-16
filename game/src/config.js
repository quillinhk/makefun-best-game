// VOIDLIGHT — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  accel: 2400,
  maxSpeed: 340,
  drag: 0.9,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletRadius: 4,
  invulnerable: 2.0,
  radiusShield: 22,
};

export const LIVES = 3;
export const MAX_LIVES = 5;

/** Enemy kinds. */
export const KIND_CHASER = 0;
export const KIND_SHOOTER = 1;
export const KIND_SPLITTER = 2;
export const KIND_WEAVER = 3;
export const KIND_MINI = 4;

export const ENEMY = {
  [KIND_CHASER]: { radius: 16, speed: 130, hp: 1, points: 100, color: '#ff4fd8' },
  [KIND_SHOOTER]: { radius: 18, speed: 90, hp: 2, points: 150, color: '#ff9f2e' },
  [KIND_SPLITTER]: { radius: 24, speed: 70, hp: 2, points: 200, color: '#2ee6ff' },
  [KIND_WEAVER]: { radius: 14, speed: 170, hp: 1, points: 120, color: '#b06bff' },
  [KIND_MINI]: { radius: 9, speed: 230, hp: 1, points: 50, color: '#ff4fd8' },
};

/** Enemy bullets. */
export const EBULLET = { radius: 5, speed: 260 };

/** A wave is a list of [kind, count]; the spawner releases them over time. */
export function waveComposition(wave) {
  const list = [];
  const chasers = 4 + wave * 2;
  const weavers = wave >= 2 ? 2 + wave : 0;
  const shooters = wave >= 3 ? 1 + Math.floor(wave / 2) : 0;
  const splitters = wave >= 4 ? 1 + Math.floor((wave - 2) / 2) : 0;
  for (let i = 0; i < chasers; i += 1) list.push(KIND_CHASER);
  for (let i = 0; i < weavers; i += 1) list.push(KIND_WEAVER);
  for (let i = 0; i < shooters; i += 1) list.push(KIND_SHOOTER);
  for (let i = 0; i < splitters; i += 1) list.push(KIND_SPLITTER);
  return list;
}

/** Seconds between spawns inside a wave; shrinks as waves rise, down to a floor. */
export function spawnInterval(wave) {
  return Math.max(0.3, 0.75 - wave * 0.05);
}

/** Points for clearing a wave, before the wave number is raised. */
export function waveBonus(wave) {
  return wave * 100;
}

/** Power-up kinds. */
export const POW_SPREAD = 0;
export const POW_RAPID = 1;
export const POW_SHIELD = 2;
export const POW_LIFE = 3;

export const POWERUP = {
  dropChance: 0.12,
  lifeChance: 0.15,
  radius: 13,
  lifetime: 9,
  effectSeconds: 10,
};

/** How many of each pool the world allocates once, at boot. */
export const POOL = { enemies: 48, bullets: 128, ebullets: 64, particles: 512, powerups: 12, stars: 110 };

export const PALETTE = {
  backdrop: '#05060f',
  space: '#0a0d24',
  nebulaA: '#1b1445',
  nebulaB: '#0d2b3d',
  player: '#5df2ff',
  playerCore: '#eafcff',
  bullet: '#ffe45e',
  ebullet: '#ff5a3c',
  text: '#eef4ff',
  muted: '#8b93b8',
  panel: '#12162e',
  panelEdge: '#2a3160',
  spread: '#7dff5e',
  rapid: '#ffe45e',
  shield: '#5ea8ff',
  life: '#ff6b9d',
  wave: '#b06bff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidlight.best';
