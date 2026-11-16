// VOIDLIGHT's rules and state, with no drawing and no browser in it: the
// player's ship, the waves of enemies, bullets, power-ups and particles,
// spawning, collisions, score, lives and waves. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import {
  EBULLET,
  ENEMY,
  FIELD,
  KIND_CHASER,
  KIND_MINI,
  KIND_SHOOTER,
  KIND_SPLITTER,
  KIND_WEAVER,
  LIVES,
  MAX_LIVES,
  PLAYER,
  POOL,
  POW_LIFE,
  POW_RAPID,
  POW_SHIELD,
  POW_SPREAD,
  POWERUP,
  spawnInterval,
  waveBonus,
  waveComposition,
} from './config.js';

export const EVENT_SHOOT = 1;
export const EVENT_KILL = 2;
export const EVENT_HIT = 4;
export const EVENT_POWERUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_OVER = 32;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function pickSpawnEdge(random) {
  // A point just outside one of the four edges, biased away from the player is
  // the spawner's job; here it is simply a random edge point.
  const side = Math.floor(random() * 4);
  if (side === 0) return { x: random() * FIELD.width, y: -30 };
  if (side === 1) return { x: random() * FIELD.width, y: FIELD.height + 30 };
  if (side === 2) return { x: -30, y: random() * FIELD.height };
  return { x: FIELD.width + 30, y: random() * FIELD.height };
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    fireTimer: 0,
    invulnerable: 0,
    shield: 0,
    spread: 0,
    rapid: 0,
    thrust: 0,
  };

  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 10, angle: 0, fireTimer: 0, weavePhase: 0, flash: 0 });
  }
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const ebullets = [];
  for (let i = 0; i < POOL.ebullets; i += 1) {
    ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const powerups = [];
  for (let i = 0; i < POOL.powerups; i += 1) {
    powerups.push({ active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const stars = [];
  for (let i = 0; i < POOL.stars; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, layer: 1 + Math.floor(random() * 3), size: 1 + random() * 1.6 });
  }

  const state = {
    player,
    enemies,
    bullets,
    ebullets,
    particles,
    powerups,
    stars,
    score: 0,
    lives: LIVES,
    wave: 1,
    waveQueue: [],
    spawnTimer: 0,
    betweenWaves: 0,
    elapsed: 0,
    kills: 0,
    shake: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.fireTimer = 0;
    player.invulnerable = 0;
    player.shield = 0;
    player.spread = 0;
    player.rapid = 0;
    player.thrust = 0;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const b of ebullets) b.active = false;
    for (const p of particles) p.active = false;
    for (const p of powerups) p.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.wave = 1;
    state.waveQueue = waveComposition(1);
    state.spawnTimer = 1.2;
    state.betweenWaves = 0;
    state.elapsed = 0;
    state.kills = 0;
    state.shake = 0;
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.size = 1.5 + random() * 2.5;
      p.color = color;
    }
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (e === null) return;
    const at = pickSpawnEdge(random);
    const def = ENEMY[kind];
    e.active = true;
    e.kind = kind;
    e.x = at.x;
    e.y = at.y;
    e.vx = 0;
    e.vy = 0;
    e.hp = def.hp;
    e.radius = def.radius;
    e.angle = 0;
    e.fireTimer = 1 + random() * 1.5;
    e.weavePhase = random() * TAU;
    e.flash = 0;
  }

  function dropPowerup(x, y) {
    if (random() > POWERUP.dropChance) return;
    const p = free(powerups);
    if (p === null) return;
    const roll = random();
    p.active = true;
    p.kind = roll < POWERUP.lifeChance ? POW_LIFE : roll < 0.45 ? POW_SPREAD : roll < 0.72 ? POW_RAPID : POW_SHIELD;
    p.x = x;
    p.y = y;
    const angle = random() * TAU;
    p.vx = Math.cos(angle) * 30;
    p.vy = Math.sin(angle) * 30;
    p.life = POWERUP.lifetime;
  }

  function fireBullet(angle) {
    const b = free(bullets);
    if (b === null) return false;
    b.active = true;
    b.x = player.x + Math.cos(angle) * (PLAYER.radius + 6);
    b.y = player.y + Math.sin(angle) * (PLAYER.radius + 6);
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed + player.vx * 0.4;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed + player.vy * 0.4;
    return true;
  }

  function killEnemy(e, events) {
    e.active = false;
    const def = ENEMY[e.kind];
    state.score += def.points;
    state.kills += 1;
    burst(e.x, e.y, def.color, e.kind === KIND_SPLITTER ? 26 : 16, 260);
    state.shake = Math.max(state.shake, 3);
    dropPowerup(e.x, e.y);
    if (e.kind === KIND_SPLITTER) {
      for (let i = 0; i < 2; i += 1) {
        const m = free(enemies);
        if (m === null) break;
        const mdef = ENEMY[KIND_MINI];
        m.active = true;
        m.kind = KIND_MINI;
        m.x = e.x + (i === 0 ? -12 : 12);
        m.y = e.y;
        m.vx = 0;
        m.vy = 0;
        m.hp = mdef.hp;
        m.radius = mdef.radius;
        m.angle = 0;
        m.fireTimer = 0;
        m.weavePhase = random() * TAU;
        m.flash = 0;
      }
    }
    return events | EVENT_KILL;
  }

  function damagePlayer(events) {
    if (player.invulnerable > 0) return events;
    if (player.shield > 0) {
      player.shield = 0;
      player.invulnerable = 1.2;
      burst(player.x, player.y, '#5ea8ff', 24, 300);
      return events | EVENT_HIT;
    }
    state.lives -= 1;
    player.invulnerable = PLAYER.invulnerable;
    player.spread = 0;
    player.rapid = 0;
    burst(player.x, player.y, '#5df2ff', 40, 340);
    state.shake = 10;
    events |= EVENT_HIT;
    if (state.lives <= 0) {
      events |= EVENT_OVER;
    }
    return events;
  }

  /**
   * One fixed step. `steer` is {x, y} each -1..1; `aim` is the aim point in
   * field coordinates (or null to keep the last angle); `firing` is whether
   * the fire button is held. With `harmless` set (the title screen's
   * backdrop) enemies drift but nothing touches the player and nothing scores.
   */
  function step(dt, steer, aim, firing, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

    // --- player movement (thrust with damping, so the ship has weight) ---
    const len = Math.hypot(steer.x, steer.y);
    const nx = len > 0 ? steer.x / len : 0;
    const ny = len > 0 ? steer.y / len : 0;
    player.vx += nx * PLAYER.accel * dt;
    player.vy += ny * PLAYER.accel * dt;
    const damp = Math.pow(PLAYER.drag, dt * 60);
    player.vx *= damp;
    player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    player.thrust = len > 0 ? 1 : 0;
    if (aim !== null) player.angle = Math.atan2(aim.y - player.y, aim.x - player.x);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.shield > 0) player.shield = Math.max(0, player.shield - dt);
    if (player.spread > 0) player.spread = Math.max(0, player.spread - dt);
    if (player.rapid > 0) player.rapid = Math.max(0, player.rapid - dt);

    // --- firing ---
    player.fireTimer -= dt;
    if (firing && !harmless && player.fireTimer <= 0) {
      const interval = player.rapid > 0 ? PLAYER.fireInterval / 2 : PLAYER.fireInterval;
      player.fireTimer += interval;
      const spread = player.spread > 0 ? [-0.22, 0, 0.22] : [0];
      let fired = false;
      for (const off of spread) {
        if (fireBullet(player.angle + off)) fired = true;
      }
      if (fired) events |= EVENT_SHOOT;
    }

    // --- spawning ---
    if (!harmless) {
      const alive = enemies.some((e) => e.active);
      if (state.waveQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnEnemy(state.waveQueue.pop());
          state.spawnTimer += spawnInterval(state.wave);
        }
      } else if (!alive && state.betweenWaves <= 0) {
        state.betweenWaves = 2.2;
      }
      if (state.betweenWaves > 0) {
        state.betweenWaves -= dt;
        if (state.betweenWaves <= 0) {
          state.score += waveBonus(state.wave);
          state.wave += 1;
          state.waveQueue = waveComposition(state.wave);
          state.spawnTimer = 0.8;
          events |= EVENT_WAVE;
        }
      }
    } else if (state.waveQueue.length === 0 && !enemies.some((e) => e.active)) {
      // The title backdrop keeps a few drifters on screen.
      state.waveQueue = [KIND_CHASER, KIND_WEAVER, KIND_CHASER];
      state.spawnTimer = 0.5;
    } else if (state.waveQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.waveQueue.pop());
        state.spawnTimer += 1.0;
      }
    }

    // --- enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
      const def = ENEMY[e.kind];
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === KIND_CHASER || e.kind === KIND_MINI) {
        e.vx = (dx / d) * def.speed;
        e.vy = (dy / d) * def.speed;
        e.angle = Math.atan2(dy, dx);
      } else if (e.kind === KIND_WEAVER) {
        e.weavePhase += dt * 4;
        const along = (dx / d) * def.speed;
        const perp = Math.cos(e.weavePhase) * def.speed * 0.7;
        e.vx = along - (dy / d) * perp;
        e.vy = (dy / d) * along + (dx / d) * perp;
        e.angle = Math.atan2(dy, dx);
      } else if (e.kind === KIND_SHOOTER) {
        if (d > 320) {
          e.vx = (dx / d) * def.speed;
          e.vy = (dy / d) * def.speed;
        } else if (d < 220) {
          e.vx = (-dx / d) * def.speed * 0.7;
          e.vy = (-dy / d) * def.speed * 0.7;
        } else {
          e.vx *= 0.95;
          e.vy *= 0.95;
        }
        e.angle = Math.atan2(dy, dx);
        if (!harmless) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0 && d < 520) {
            e.fireTimer = 2.2 + random() * 0.8;
            const b = free(ebullets);
            if (b !== null) {
              b.active = true;
              b.x = e.x + Math.cos(e.angle) * (e.radius + 6);
              b.y = e.y + Math.sin(e.angle) * (e.radius + 6);
              b.vx = Math.cos(e.angle) * EBULLET.speed;
              b.vy = Math.sin(e.angle) * EBULLET.speed;
            }
          }
        }
      } else if (e.kind === KIND_SPLITTER) {
        e.vx = (dx / d) * def.speed;
        e.vy = (dy / d) * def.speed;
        e.angle += dt * 1.5;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Enemies stay in the field (they entered from outside; clamp them in).
      e.x = Math.min(FIELD.width - e.radius, Math.max(e.radius, e.x));
      e.y = Math.min(FIELD.height - e.radius, Math.max(e.radius, e.y));
    }

    // --- bullets ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + PLAYER.bulletRadius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.active = false;
          e.hp -= 1;
          e.flash = 0.08;
          burst(b.x, b.y, '#ffe45e', 4, 140);
          if (e.hp <= 0 && !harmless) events = killEnemy(e, events);
          else if (e.hp <= 0) e.active = false;
          break;
        }
      }
    }

    // --- enemy bullets ---
    for (const b of ebullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      if (!harmless) {
        const rr = PLAYER.radius + EBULLET.radius - 2;
        if (dist2(b.x, b.y, player.x, player.y) < rr * rr) {
          b.active = false;
          events = damagePlayer(events);
          if (events & EVENT_OVER) return events;
        }
      }
    }

    // --- player vs enemies ---
    if (!harmless) {
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + PLAYER.radius - 4;
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
          events = killEnemy(e, events);
          events = damagePlayer(events);
          if (events & EVENT_OVER) return events;
          break;
        }
      }
    }

    // --- power-ups ---
    for (const p of powerups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.x = Math.min(FIELD.width - 14, Math.max(14, p.x));
      p.y = Math.min(FIELD.height - 14, Math.max(14, p.y));
      if (!harmless) {
        const rr = POWERUP.radius + PLAYER.radius;
        if (dist2(p.x, p.y, player.x, player.y) < rr * rr) {
          p.active = false;
          if (p.kind === POW_SPREAD) player.spread = POWERUP.effectSeconds;
          else if (p.kind === POW_RAPID) player.rapid = POWERUP.effectSeconds;
          else if (p.kind === POW_SHIELD) player.shield = POWERUP.effectSeconds;
          else if (p.kind === POW_LIFE) state.lives = Math.min(MAX_LIVES, state.lives + 1);
          burst(p.x, p.y, '#ffffff', 14, 200);
          events |= EVENT_POWERUP;
        }
      }
    }

    // --- particles ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }

    // --- starfield drift ---
    for (const s of stars) {
      s.y += dt * (4 + s.layer * 6);
      if (s.y > FIELD.height) {
        s.y = -2;
        s.x = random() * FIELD.width;
      }
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
