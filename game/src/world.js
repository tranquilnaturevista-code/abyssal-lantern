// The game's rules and state, with no drawing and no browser in it: Luma the lanternfish,
// the pool of pearls, bubbles, predators and gifts, spawning, collisions, score, combo,
// oxygen, lives, depth and zones. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react (sound, announcements) without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.

import {
  ANGLER, BUBBLE, DESCENT, FIELD, JELLY, LIVES, LIVES_MAX, OXYGEN, PEARL, PLAYER,
  POOL, POWERUP, TRENCH_BONUS, URCHIN, ZONE_BONUS, ZONES,
} from './config.js';

export const KIND_PEARL = 0;
export const KIND_BUBBLE = 1;
export const KIND_ANGLER = 2;
export const KIND_URCHIN = 3;
export const KIND_JELLY = 4;
export const KIND_STAR = 5;
export const KIND_HEART = 6;

export const EVENT_COLLECT = 1;
export const EVENT_BUBBLE = 2;
export const EVENT_HIT = 4;
export const EVENT_OVER = 8;
export const EVENT_ZONE = 16;
export const EVENT_STAR = 32;
export const EVENT_HEART = 64;
export const EVENT_DASH = 128;
export const EVENT_TRENCH = 256;
export const EVENT_OXYGEN = 512;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, angle: 0,
    invulnerable: 0, dashTime: 0, dashCooldown: 0, dashX: 1, dashY: 0,
  };
  const entities = [];
  for (let index = 0; index < POOL.entity; index += 1) {
    entities.push({ active: false, kind: KIND_PEARL, x: 0, y: 0, vx: 0, vy: 0, radius: 0, phase: 0, speed: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL.particle; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const texts = [];
  for (let index = 0; index < POOL.text; index += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#ffffff' });
  }
  const motes = [];
  for (let index = 0; index < POOL.mote; index += 1) {
    motes.push({ x: 0, y: 0, size: 1, twinkle: 0, speed: 0 });
  }

  const state = {
    player, entities, particles, texts, motes,
    score: 0, lives: LIVES, depth: 0, zone: 0, oxygen: OXYGEN.max,
    combo: 0, comboTimer: 0, starTime: 0, elapsed: 0, scroll: 0,
    trenchReached: false, banner: { text: '', sub: '', timer: 0 },
    pearlTimer: 0, bubbleTimer: 0, anglerTimer: 0, urchinTimer: 0,
    jellyTimer: 0, starTimer: 0, heartTimer: 0, depthMark: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = 0;
    player.invulnerable = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    for (const entity of entities) entity.active = false;
    for (const particle of particles) particle.active = false;
    for (const text of texts) text.active = false;
    for (let index = 0; index < motes.length; index += 1) {
      motes[index].x = random() * FIELD.width;
      motes[index].y = random() * FIELD.height;
      motes[index].size = 1 + random() * 2;
      motes[index].twinkle = random() * Math.PI * 2;
      motes[index].speed = 6 + random() * 14;
    }
    state.score = 0;
    state.lives = LIVES;
    state.depth = 0;
    state.zone = 0;
    state.oxygen = OXYGEN.max;
    state.combo = 0;
    state.comboTimer = 0;
    state.starTime = 0;
    state.elapsed = 0;
    state.scroll = 0;
    state.trenchReached = false;
    state.banner.text = '';
    state.banner.sub = '';
    state.banner.timer = 0;
    state.pearlTimer = 0.6;
    state.bubbleTimer = 1.6;
    // The first hunters arrive late, so a new diver learns the water first: anglers
    // after 40 m, urchins after 80 m, jellies after 120 m.
    state.anglerTimer = 8;
    state.urchinTimer = 10;
    state.jellyTimer = 14;
    state.starTimer = POWERUP.starInterval;
    state.heartTimer = POWERUP.heartInterval;
    state.depthMark = 0;
  }

  function freeEntity() {
    for (let index = 0; index < entities.length; index += 1) if (!entities[index].active) return entities[index];
    return null;
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function freeText() {
    for (let index = 0; index < texts.length; index += 1) if (!texts[index].active) return texts[index];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const particle = freeParticle();
      if (particle === null) return;
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.4 + random() * 0.8);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.life = 0.5 + random() * 0.4;
      particle.maxLife = particle.life;
      particle.size = 1.5 + random() * 2.5;
      particle.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const entry = freeText();
    if (entry === null) return;
    entry.active = true;
    entry.x = x;
    entry.y = y;
    entry.life = 1.1;
    entry.text = text;
    entry.color = color;
  }

  function showBanner(text, sub) {
    state.banner.text = text;
    state.banner.sub = sub;
    state.banner.timer = 2.8;
  }

  function spawnPearl() {
    const entity = freeEntity();
    if (entity === null) return;
    entity.active = true;
    entity.kind = KIND_PEARL;
    entity.x = 40 + random() * (FIELD.width - 80);
    entity.y = -20;
    entity.vx = 0;
    entity.vy = PEARL.speed + random() * 26;
    entity.radius = PEARL.radius;
    entity.phase = random() * Math.PI * 2;
    entity.speed = entity.vy;
  }

  function spawnBubble() {
    const entity = freeEntity();
    if (entity === null) return;
    entity.active = true;
    entity.kind = KIND_BUBBLE;
    entity.x = 40 + random() * (FIELD.width - 80);
    entity.y = FIELD.height + 20;
    entity.vx = 0;
    entity.vy = -(BUBBLE.speed + random() * 24);
    entity.radius = BUBBLE.radius;
    entity.phase = random() * Math.PI * 2;
    entity.speed = -entity.vy;
  }

  function spawnAngler() {
    let hunters = 0;
    for (const entity of entities) if (entity.active && entity.kind === KIND_ANGLER) hunters += 1;
    if (hunters >= 3) return;
    const entity = freeEntity();
    if (entity === null) return;
    const fromLeft = random() < 0.5;
    entity.active = true;
    entity.kind = KIND_ANGLER;
    entity.x = fromLeft ? -30 : FIELD.width + 30;
    entity.y = 60 + random() * (FIELD.height - 120);
    entity.vx = 0;
    entity.vy = 0;
    entity.radius = ANGLER.radius;
    entity.phase = random() * Math.PI * 2;
    entity.speed = ANGLER.speed + ANGLER.speedPerZone * state.zone + random() * 30;
  }

  function spawnUrchin() {
    let hunters = 0;
    for (const entity of entities) if (entity.active && entity.kind === KIND_URCHIN) hunters += 1;
    if (hunters >= 3) return;
    const entity = freeEntity();
    if (entity === null) return;
    entity.active = true;
    entity.kind = KIND_URCHIN;
    entity.x = 40 + random() * (FIELD.width - 80);
    entity.y = -24;
    entity.vx = 0;
    entity.vy = URCHIN.speed + random() * 20;
    entity.radius = URCHIN.radius;
    entity.phase = random() * Math.PI * 2;
    entity.speed = entity.vy;
  }

  function spawnJelly() {
    let hunters = 0;
    for (const entity of entities) if (entity.active && entity.kind === KIND_JELLY) hunters += 1;
    if (hunters >= 3) return;
    const entity = freeEntity();
    if (entity === null) return;
    entity.active = true;
    entity.kind = KIND_JELLY;
    entity.x = 40 + random() * (FIELD.width - 80);
    entity.y = -26;
    entity.vx = 0;
    entity.vy = JELLY.speed + random() * 18;
    entity.radius = JELLY.radius;
    entity.phase = random() * Math.PI * 2;
    entity.speed = entity.vy;
  }

  function spawnPowerup(kind) {
    const entity = freeEntity();
    if (entity === null) return;
    entity.active = true;
    entity.kind = kind;
    entity.x = 60 + random() * (FIELD.width - 120);
    entity.y = -24;
    entity.vx = 0;
    entity.vy = 42;
    entity.radius = POWERUP.radius;
    entity.phase = random() * Math.PI * 2;
    entity.speed = entity.vy;
  }

  function loseLife(events) {
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    player.invulnerable = PLAYER.invulnerable;
    burst(player.x, player.y, '#ff6b6b', 18, 190);
    if (state.lives <= 0) return events | EVENT_HIT | EVENT_OVER;
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `move` is a unit swim vector, `dash` an edge-triggered dash request.
   * With `harmless` set (the title screen's backdrop) pearls and bubbles drift, nothing
   * touches the player and nothing scores.
   */
  function step(dt, move, dash, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.banner.timer > 0) state.banner.timer = Math.max(0, state.banner.timer - dt);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (state.starTime > 0) state.starTime = Math.max(0, state.starTime - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // The descent: depth and the background scroll grow, and new zones arrive.
    if (!harmless) {
      const rate = DESCENT.base + DESCENT.perZone * state.zone;
      state.depth += rate * dt;
      state.scroll += rate * dt * 12;
      const mark = Math.floor(state.depth / 10);
      if (mark > state.depthMark) {
        state.score += mark - state.depthMark;
        state.depthMark = mark;
      }
      while (state.zone + 1 < ZONES.length && state.depth >= ZONES[state.zone + 1].depth) {
        state.zone += 1;
        const zone = ZONES[state.zone];
        if (state.zone === ZONES.length - 1) {
          state.trenchReached = true;
          state.score += TRENCH_BONUS;
          showBanner('TRENCH MASTER', `You reached ${zone.name} — +${TRENCH_BONUS}`);
          events |= EVENT_TRENCH;
        } else {
          state.score += ZONE_BONUS;
          showBanner(zone.name, `Deeper water — +${ZONE_BONUS}`);
          events |= EVENT_ZONE;
        }
      }
      state.oxygen -= (OXYGEN.drain + OXYGEN.drainPerZone * state.zone) * dt;
      if (state.oxygen <= 0) {
        state.oxygen = 60;
        events = loseLife(events) | EVENT_OXYGEN;
        if (events & EVENT_OVER) return events;
      }
    }

    // The fish: thrust, drag, dash, and a soft bounce off the edges of the water.
    if (dash && !harmless && player.dashCooldown === 0 && player.dashTime === 0) {
      const dx = move.x !== 0 || move.y !== 0 ? move.x : Math.cos(player.angle);
      const dy = move.x !== 0 || move.y !== 0 ? move.y : Math.sin(player.angle);
      player.dashX = dx;
      player.dashY = dy;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      burst(player.x, player.y, '#9fe8ff', 10, 120);
      events |= EVENT_DASH;
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx += move.x * PLAYER.accel * dt;
      player.vy += move.y * PLAYER.accel * dt;
      player.vx -= player.vx * PLAYER.drag * dt;
      player.vy -= player.vy * PLAYER.drag * dt;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > PLAYER.maxSpeed) {
        player.vx = (player.vx / speed) * PLAYER.maxSpeed;
        player.vy = (player.vy / speed) * PLAYER.maxSpeed;
      }
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (player.x < PLAYER.radius) { player.x = PLAYER.radius; player.vx = Math.abs(player.vx) * 0.4; }
    if (player.x > FIELD.width - PLAYER.radius) { player.x = FIELD.width - PLAYER.radius; player.vx = -Math.abs(player.vx) * 0.4; }
    if (player.y < PLAYER.radius) { player.y = PLAYER.radius; player.vy = Math.abs(player.vy) * 0.4; }
    if (player.y > FIELD.height - PLAYER.radius) { player.y = FIELD.height - PLAYER.radius; player.vy = -Math.abs(player.vy) * 0.4; }
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 24) {
      const target = Math.atan2(player.vy, player.vx);
      let diff = target - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.angle += diff * Math.min(1, 10 * dt);
    }
    if (speed > 140 && random() < 0.35) {
      const bubble = freeParticle();
      if (bubble !== null) {
        bubble.active = true;
        bubble.x = player.x - Math.cos(player.angle) * 18;
        bubble.y = player.y - Math.sin(player.angle) * 18;
        bubble.vx = -player.vx * 0.08;
        bubble.vy = -player.vy * 0.08 - 22;
        bubble.life = 0.9;
        bubble.maxLife = 0.9;
        bubble.size = 2 + random() * 2;
        bubble.color = '#bfefff';
      }
    }

    // Spawning: pearls and bubbles always; predators and gifts only while playing.
    state.pearlTimer -= dt;
    if (state.pearlTimer <= 0) {
      spawnPearl();
      state.pearlTimer += 1.05 + random() * 0.5;
    }
    state.bubbleTimer -= dt;
    if (state.bubbleTimer <= 0) {
      spawnBubble();
      state.bubbleTimer += 2.4 + random() * 1.2;
    }
    if (!harmless) {
      state.anglerTimer -= dt;
      if (state.anglerTimer <= 0 && state.depth > 40) {
        spawnAngler();
        state.anglerTimer += Math.max(ANGLER.minInterval, ANGLER.interval * ANGLER.intervalScale ** state.zone) * (0.8 + random() * 0.5);
      }
      state.urchinTimer -= dt;
      if (state.urchinTimer <= 0 && state.depth > 80) {
        spawnUrchin();
        state.urchinTimer += Math.max(URCHIN.minInterval, URCHIN.interval * URCHIN.intervalScale ** state.zone) * (0.8 + random() * 0.5);
      }
      state.jellyTimer -= dt;
      if (state.jellyTimer <= 0 && state.depth > 120) {
        spawnJelly();
        state.jellyTimer += Math.max(JELLY.minInterval, JELLY.interval * JELLY.intervalScale ** state.zone) * (0.8 + random() * 0.5);
      }
      state.starTimer -= dt;
      if (state.starTimer <= 0) {
        spawnPowerup(KIND_STAR);
        state.starTimer += POWERUP.starInterval + random() * 8;
      }
      state.heartTimer -= dt;
      if (state.heartTimer <= 0) {
        spawnPowerup(KIND_HEART);
        state.heartTimer += POWERUP.heartInterval + random() * 20;
      }
    }

    // Entities move, drift, chase, and meet the fish.
    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index];
      if (!entity.active) continue;
      entity.phase += dt * 2;
      if (entity.kind === KIND_PEARL) {
        entity.y += entity.vy * dt;
        entity.x += Math.sin(entity.phase) * 22 * dt;
      } else if (entity.kind === KIND_BUBBLE) {
        entity.y += entity.vy * dt;
        entity.x += Math.sin(entity.phase * 1.4) * 30 * dt;
      } else if (entity.kind === KIND_ANGLER) {
        const dx = player.x - entity.x;
        const dy = player.y - entity.y;
        const length = Math.hypot(dx, dy) || 1;
        const wobble = Math.sin(entity.phase * 1.6) * 0.6;
        entity.vx += ((dx / length) * entity.speed - entity.vx) * Math.min(1, 1.6 * dt);
        entity.vy += ((dy / length + wobble) * entity.speed - entity.vy) * Math.min(1, 1.6 * dt);
        entity.x += entity.vx * dt;
        entity.y += entity.vy * dt;
      } else if (entity.kind === KIND_URCHIN || entity.kind === KIND_JELLY) {
        entity.y += entity.vy * dt;
        entity.x += Math.sin(entity.phase * 0.9) * 26 * dt;
      } else {
        entity.y += entity.vy * dt;
        entity.x += Math.sin(entity.phase) * 18 * dt;
      }
      if (entity.y > FIELD.height + 70 || entity.y < -80 || entity.x < -90 || entity.x > FIELD.width + 90) {
        entity.active = false;
        continue;
      }
      if (harmless) continue;
      const touch = distance(entity.x, entity.y, player.x, player.y) < entity.radius + PLAYER.radius - 4;
      if (!touch) continue;
      if (entity.kind === KIND_PEARL) {
        entity.active = false;
        state.combo = state.comboTimer > 0 ? state.combo + 1 : 1;
        state.comboTimer = PEARL.comboWindow;
        const multiplier = Math.min(state.combo, PEARL.comboMax) * (state.starTime > 0 ? 2 : 1);
        const points = PEARL.points * multiplier;
        state.score += points;
        burst(entity.x, entity.y, '#ffd76a', 10, 150);
        floatText(entity.x, entity.y - 14, `+${points}`, '#ffd76a');
        events |= EVENT_COLLECT;
      } else if (entity.kind === KIND_BUBBLE) {
        entity.active = false;
        state.oxygen = Math.min(OXYGEN.max, state.oxygen + OXYGEN.bubbleRefill);
        burst(entity.x, entity.y, '#8fe3ff', 8, 110);
        floatText(entity.x, entity.y - 14, `+${OXYGEN.bubbleRefill} O₂`, '#8fe3ff');
        events |= EVENT_BUBBLE;
      } else if (entity.kind === KIND_STAR) {
        entity.active = false;
        state.starTime = POWERUP.starSeconds;
        burst(entity.x, entity.y, '#ffe9a3', 14, 170);
        floatText(entity.x, entity.y - 14, 'SHINE!', '#ffe9a3');
        events |= EVENT_STAR;
      } else if (entity.kind === KIND_HEART) {
        entity.active = false;
        state.lives = Math.min(LIVES_MAX, state.lives + 1);
        burst(entity.x, entity.y, '#ff7d9c', 12, 150);
        floatText(entity.x, entity.y - 14, '+1 LIFE', '#ff7d9c');
        events |= EVENT_HEART;
      } else if (state.starTime > 0) {
        entity.active = false;
        state.score += 25;
        burst(entity.x, entity.y, '#ffe9a3', 12, 200);
        floatText(entity.x, entity.y - 14, '+25', '#ffe9a3');
      } else if (player.invulnerable === 0) {
        entity.active = false;
        events = loseLife(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Particles and floating texts age out; motes drift with the sinking water.
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 1 - 1.4 * dt;
      particle.vy *= 1 - 1.4 * dt;
    }
    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index];
      if (!text.active) continue;
      text.life -= dt;
      text.y -= 34 * dt;
      if (text.life <= 0) text.active = false;
    }
    for (let index = 0; index < motes.length; index += 1) {
      const mote = motes[index];
      mote.y += mote.speed * dt;
      mote.twinkle += dt * 2;
      if (mote.y > FIELD.height + 4) {
        mote.y = -4;
        mote.x = random() * FIELD.width;
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
