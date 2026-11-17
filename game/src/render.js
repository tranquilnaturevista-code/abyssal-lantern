// Everything the eye sees: the sinking water, the lanternfish and its glow, the pearls,
// bubbles, predators and gifts, the particles, the HUD and the title, pause and game-over
// screens. The renderer only reads state; it never changes a rule.

import { FIELD, FONT, LIVES_MAX, OXYGEN, PALETTE, PLAYER, ZONES } from './config.js';
import { KIND_ANGLER, KIND_BUBBLE, KIND_HEART, KIND_JELLY, KIND_PEARL, KIND_STAR, KIND_URCHIN } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)}, ${Math.round(ca[1] + (cb[1] - ca[1]) * t)}, ${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`;
}

/** A deterministic 0..1 hash of an integer, for the rock silhouettes. */
function hash(index) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.9);
  ctx.bezierCurveTo(x - size * 1.2, y, x - size * 0.55, y - size, x, y - size * 0.25);
  ctx.bezierCurveTo(x + size * 0.55, y - size, x + size * 1.2, y, x, y + size * 0.9);
  ctx.closePath();
}

function starPath(ctx, x, y, radius, points = 5) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const r = index % 2 === 0 ? radius : radius * 0.45;
    const angle = (index * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let shake = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * ratio);
    const height = Math.floor(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function zoneColors(state) {
    const zone = ZONES[state.zone];
    const next = ZONES[Math.min(state.zone + 1, ZONES.length - 1)];
    let progress = 0;
    if (state.zone < ZONES.length - 1) {
      progress = Math.min(1, Math.max(0, (state.depth - zone.depth) / (next.depth - zone.depth)));
    }
    return { top: mix(zone.top, next.top, progress), bottom: mix(zone.bottom, next.bottom, progress), glow: zone.glow };
  }

  function drawBackdrop(state) {
    const colors = zoneColors(state);
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, colors.top);
    gradient.addColorStop(1, colors.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Sunbeams from above, fading with depth.
    const beamAlpha = Math.max(0, 0.10 - state.depth / 4000);
    if (beamAlpha > 0.004) {
      ctx.save();
      ctx.globalAlpha = beamAlpha;
      ctx.fillStyle = '#bfefff';
      for (let index = 0; index < 5; index += 1) {
        const x = 180 + index * 260 + Math.sin(state.elapsed * 0.2 + index) * 30;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 70, 0);
        ctx.lineTo(x + 190, FIELD.height);
        ctx.lineTo(x + 40, FIELD.height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Rock spires on the seafloor, two parallax layers scrolling with the descent.
    for (let layer = 0; layer < 2; layer += 1) {
      const speed = layer === 0 ? 0.3 : 0.65;
      const spacing = layer === 0 ? 150 : 100;
      const offset = (state.scroll * speed) % spacing;
      ctx.fillStyle = layer === 0 ? 'rgba(2, 8, 18, 0.55)' : 'rgba(2, 6, 14, 0.8)';
      for (let x = -spacing; x < FIELD.width + spacing; x += spacing) {
        const index = Math.floor((x + offset) / spacing) + layer * 1000;
        const height = 50 + hash(index) * (layer === 0 ? 90 : 150);
        const peak = x + offset + spacing * (0.3 + hash(index + 7) * 0.4);
        ctx.beginPath();
        ctx.moveTo(x + offset, FIELD.height);
        ctx.lineTo(peak, FIELD.height - height);
        ctx.lineTo(x + offset + spacing, FIELD.height);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Hydrothermal vents glow on the Trench floor.
    if (state.zone >= ZONES.length - 1) {
      for (let index = 0; index < 4; index += 1) {
        const x = ((index * 340 + 120 - state.scroll * 0.65) % 1400 + 1400) % 1400 - 60;
        const flicker = 0.5 + Math.sin(state.elapsed * 3 + index * 2) * 0.25;
        const glow = ctx.createRadialGradient(x, FIELD.height - 8, 2, x, FIELD.height - 8, 70);
        glow.addColorStop(0, `rgba(255, 120, 60, ${0.5 * flicker})`);
        glow.addColorStop(1, 'rgba(255, 120, 60, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 70, FIELD.height - 78, 140, 78);
      }
    }

    // Plankton motes drifting in the water.
    for (const mote of state.motes) {
      const alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(mote.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfeeff';
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPearl(entity) {
    const pulse = 1 + Math.sin(entity.phase * 2) * 0.12;
    const glow = ctx.createRadialGradient(entity.x, entity.y, 1, entity.x, entity.y, entity.radius * 3.2);
    glow.addColorStop(0, 'rgba(255, 215, 106, 0.55)');
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
    const body = ctx.createRadialGradient(entity.x - 3, entity.y - 4, 1, entity.x, entity.y, entity.radius * pulse);
    body.addColorStop(0, '#fff6d8');
    body.addColorStop(0.55, '#ffd76a');
    body.addColorStop(1, '#e8a93d');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBubble(entity) {
    ctx.strokeStyle = 'rgba(190, 235, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.radius * 0.62, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
  }

  function drawAngler(entity, player) {
    const angle = Math.atan2(entity.vy, entity.vx);
    const facing = Math.abs(angle) > Math.PI / 2 ? -1 : 1;
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.scale(facing, 1);
    ctx.rotate(facing === 1 ? angle : Math.PI - angle);
    // Lure stalk and glow.
    ctx.strokeStyle = '#3a2a55';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, -14);
    ctx.quadraticCurveTo(26, -30, 34, -22);
    ctx.stroke();
    const lure = ctx.createRadialGradient(34, -22, 1, 34, -22, 16);
    lure.addColorStop(0, 'rgba(255, 150, 200, 0.95)');
    lure.addColorStop(1, 'rgba(255, 150, 200, 0)');
    ctx.fillStyle = lure;
    ctx.beginPath();
    ctx.arc(34, -22, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff9ec7';
    ctx.beginPath();
    ctx.arc(34, -22, 5, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    const body = ctx.createLinearGradient(-24, -18, 24, 18);
    body.addColorStop(0, '#4a2b63');
    body.addColorStop(1, '#1c1030');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    // Jaw with teeth.
    ctx.fillStyle = '#241335';
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.quadraticCurveTo(22, 8, 26, 2);
    ctx.quadraticCurveTo(18, 16, 4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4f0ff';
    for (let index = 0; index < 4; index += 1) {
      const tx = 10 + index * 4.5;
      ctx.beginPath();
      ctx.moveTo(tx, 5);
      ctx.lineTo(tx + 2.5, 5);
      ctx.lineTo(tx + 1.2, 11);
      ctx.closePath();
      ctx.fill();
    }
    // Eye.
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(12, -7, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    void player;
  }

  function drawUrchin(entity) {
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.rotate(entity.phase * 0.7);
    ctx.strokeStyle = '#8d6bd8';
    ctx.lineWidth = 2.5;
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
      ctx.lineTo(Math.cos(angle) * entity.radius, Math.sin(angle) * entity.radius);
      ctx.stroke();
    }
    ctx.fillStyle = '#2c1b4d';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b79cff';
    ctx.beginPath();
    ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawJelly(entity) {
    const pulse = 1 + Math.sin(entity.phase * 1.8) * 0.14;
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.scale(pulse, 1 / pulse);
    const dome = ctx.createRadialGradient(0, -6, 2, 0, -4, entity.radius * 1.4);
    dome.addColorStop(0, 'rgba(255, 170, 220, 0.85)');
    dome.addColorStop(1, 'rgba(255, 110, 190, 0.25)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.arc(0, 0, entity.radius, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 190, 230, 0.7)';
    ctx.lineWidth = 2;
    for (let index = -2; index <= 2; index += 1) {
      const wave = Math.sin(entity.phase * 2 + index) * 6;
      ctx.beginPath();
      ctx.moveTo(index * 6, 2);
      ctx.quadraticCurveTo(index * 6 + wave, 16, index * 6 - wave, 30 + Math.abs(index) * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStar(entity) {
    const glow = ctx.createRadialGradient(entity.x, entity.y, 1, entity.x, entity.y, entity.radius * 3);
    glow.addColorStop(0, 'rgba(255, 233, 163, 0.8)');
    glow.addColorStop(1, 'rgba(255, 233, 163, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(entity.x, entity.y, entity.radius * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9a3';
    starPath(ctx, entity.x, entity.y, entity.radius);
    ctx.fill();
    ctx.fillStyle = '#fff8dd';
    starPath(ctx, entity.x, entity.y, entity.radius * 0.5);
    ctx.fill();
  }

  function drawHeart(entity) {
    const beat = 1 + Math.sin(entity.phase * 3) * 0.12;
    ctx.save();
    ctx.translate(entity.x, entity.y);
    ctx.scale(beat, beat);
    ctx.fillStyle = '#ff7d9c';
    heartPath(ctx, 0, 0, 11);
    ctx.fill();
    ctx.fillStyle = '#ffb3c6';
    heartPath(ctx, -2, -3, 5);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    const wave = Math.sin(state.elapsed * 9);
    ctx.save();
    ctx.translate(player.x, player.y);
    if (state.starTime > 0) {
      const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, 54);
      aura.addColorStop(0, 'rgba(255, 233, 163, 0.55)');
      aura.addColorStop(1, 'rgba(255, 233, 163, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 54, 0, Math.PI * 2);
      ctx.fill();
    }
    if (player.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.rotate(player.angle);
    // Tail, waving with the swim.
    ctx.fillStyle = '#2fa8c9';
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-30, -11 + wave * 4);
    ctx.lineTo(-30, 11 + wave * 4);
    ctx.closePath();
    ctx.fill();
    // Body.
    const body = ctx.createLinearGradient(-20, -14, 20, 14);
    body.addColorStop(0, '#8ff0ff');
    body.addColorStop(0.5, '#37b6d9');
    body.addColorStop(1, '#1b7fa8');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly and fin.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 6, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2fa8c9';
    ctx.beginPath();
    ctx.moveTo(-2, -11);
    ctx.lineTo(6, -19);
    ctx.lineTo(10, -10);
    ctx.closePath();
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(11, -4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06222e';
    ctx.beginPath();
    ctx.arc(12.5, -4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Lantern stalk and orb.
    ctx.strokeStyle = '#1b7fa8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(8, -11);
    ctx.quadraticCurveTo(16, -24, 26, -22);
    ctx.stroke();
    const orb = ctx.createRadialGradient(27, -22, 1, 27, -22, 12);
    orb.addColorStop(0, '#fff8c9');
    orb.addColorStop(0.5, '#ffd76a');
    orb.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = orb;
    ctx.beginPath();
    ctx.arc(27, -22, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(27, -22, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawLight(state) {
    const player = state.player;
    const colors = zoneColors(state);
    // Warm lantern glow around the fish.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 260);
    glow.addColorStop(0, 'rgba(255, 220, 130, 0.20)');
    glow.addColorStop(0.4, 'rgba(120, 200, 255, 0.10)');
    glow.addColorStop(1, 'rgba(120, 200, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(player.x - 260, player.y - 260, 520, 520);
    // Zone-tinted shimmer.
    const shimmer = ctx.createRadialGradient(player.x, player.y, 60, player.x, player.y, 420);
    shimmer.addColorStop(0, 'rgba(255, 255, 255, 0)');
    shimmer.addColorStop(1, colors.glow + '00');
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    // Vignette: the deep sea is dark at the edges.
    const vignette = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95,
    );
    vignette.addColorStop(0, 'rgba(2, 6, 14, 0)');
    vignette.addColorStop(1, 'rgba(2, 6, 14, 0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawHud(state, best, muted) {
    const player = state.player;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, 24, 44);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 16px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, 24, 68);
    if (state.combo >= 2) {
      const pulse = 1 + Math.sin(state.elapsed * 8) * 0.06;
      ctx.save();
      ctx.translate(24, 96);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText(`COMBO ×${Math.min(state.combo, 8)}`, 0, 0);
      ctx.restore();
    }
    // Depth and zone, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 34px ${FONT}`;
    ctx.fillText(`${Math.floor(state.depth)} m`, FIELD.width / 2, 46);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(ZONES[state.zone].name.toUpperCase(), FIELD.width / 2, 70);
    // Lives, top right.
    for (let index = 0; index < LIVES_MAX; index += 1) {
      const x = FIELD.width - 34 - index * 34;
      const y = 36;
      ctx.fillStyle = index < state.lives ? PALETTE.heart : 'rgba(255, 125, 156, 0.18)';
      heartPath(ctx, x, y, 11);
      ctx.fill();
    }
    // Oxygen bar, bottom centre.
    const barWidth = 340;
    const barX = (FIELD.width - barWidth) / 2;
    const barY = FIELD.height - 40;
    const low = state.oxygen <= OXYGEN.lowWarn;
    ctx.textAlign = 'right';
    ctx.fillStyle = low && Math.floor(state.elapsed * 4) % 2 === 0 ? PALETTE.danger : PALETTE.muted;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText('OXYGEN', barX - 12, barY + 13);
    ctx.fillStyle = 'rgba(4, 12, 24, 0.7)';
    roundRect(ctx, barX, barY, barWidth, 16, 8);
    ctx.fill();
    const oxygenFraction = Math.max(0, state.oxygen / OXYGEN.max);
    const oxygenFill = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
    oxygenFill.addColorStop(0, low ? '#ff8a7a' : '#5fd4ff');
    oxygenFill.addColorStop(1, low ? '#ff5a5a' : '#2f7fe0');
    ctx.fillStyle = oxygenFill;
    if (oxygenFraction > 0) {
      roundRect(ctx, barX, barY, barWidth * oxygenFraction, 16, 8);
      ctx.fill();
    }
    // Dash readiness, under the oxygen bar.
    const dashReady = player.dashCooldown === 0;
    ctx.textAlign = 'left';
    ctx.fillStyle = dashReady ? '#9fe8ff' : PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(dashReady ? 'DASH READY  [SPACE]' : 'DASH …', barX, barY + 36);
    if (!dashReady) {
      ctx.fillStyle = 'rgba(159, 232, 255, 0.35)';
      ctx.fillRect(barX + 92, barY + 26, 90 * (1 - player.dashCooldown / 1.1), 5);
    }
    if (state.starTime > 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffe9a3';
      ctx.font = `800 16px ${FONT}`;
      ctx.fillText(`SHINE ${Math.ceil(state.starTime)}s`, FIELD.width - 24, FIELD.height - 52);
    }
    if (muted) {
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText('MUTED (M)', FIELD.width - 24, FIELD.height - 28);
    }
    ctx.restore();
  }

  function drawBanner(state) {
    if (state.banner.timer <= 0) return;
    const alpha = Math.min(1, state.banner.timer, (2.8 - state.banner.timer) * 2 + 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText(state.banner.text, FIELD.width / 2, 210);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText(state.banner.sub, FIELD.width / 2, 244);
    ctx.restore();
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(2, 8, 18, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    dim(0.55);
    ctx.save();
    ctx.textAlign = 'center';
    const glow = ctx.createRadialGradient(FIELD.width / 2, 190, 10, FIELD.width / 2, 190, 340);
    glow.addColorStop(0, 'rgba(127, 231, 255, 0.22)');
    glow.addColorStop(1, 'rgba(127, 231, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(FIELD.width / 2 - 340, 0, 680, 380);
    ctx.fillStyle = '#aee9ff';
    ctx.font = `800 86px ${FONT}`;
    ctx.fillText('ABYSSAL', FIELD.width / 2, 190);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('LANTERN', FIELD.width / 2, 272);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `500 22px ${FONT}`;
    ctx.fillText('Dive deep. Gather light. Mind your air.', FIELD.width / 2, 322);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText('WASD / Arrows — swim      Hold mouse — steer      SPACE — dash', FIELD.width / 2, 396);
    ctx.fillText('Pearls score · Bubbles refill oxygen · Anglerfish, urchins and jellies bite', FIELD.width / 2, 426);
    ctx.fillText('Reach the Trench at 800 m to become Trench Master', FIELD.width / 2, 456);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(`BEST ${best.toLocaleString('en-US')}`, FIELD.width / 2, 506);
    }
    const blink = 0.55 + 0.45 * Math.sin(state.elapsed * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('CLICK OR PRESS ENTER TO DIVE', FIELD.width / 2, 576);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 15px ${FONT}`;
    ctx.fillText('P pause · M mute · R restart', FIELD.width / 2, 622);
    ctx.restore();
  }

  function drawPaused() {
    dim(0.6);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 54px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, 350);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText('Press P or click to keep diving', FIELD.width / 2, 392);
    ctx.restore();
  }

  function drawOver(state, best) {
    dim(0.62);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cfe9ff';
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText('THE LIGHT FADES', FIELD.width / 2, 200);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`SCORE  ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 276);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 21px ${FONT}`;
    ctx.fillText(`Depth reached  ${Math.floor(state.depth)} m  ·  ${ZONES[state.zone].name}`, FIELD.width / 2, 318);
    ctx.fillText(`Trench reached:  ${state.trenchReached ? 'YES — Trench Master' : 'not yet'}`, FIELD.width / 2, 350);
    const isBest = state.score >= best && state.score > 0;
    ctx.fillStyle = isBest ? PALETTE.gold : PALETTE.muted;
    ctx.font = `700 21px ${FONT}`;
    ctx.fillText(isBest ? `NEW BEST!  ${best.toLocaleString('en-US')}` : `BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 392);
    const blink = 0.55 + 0.45 * Math.sin(state.elapsed * 4);
    ctx.globalAlpha = blink;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('PRESS R OR CLICK TO DIVE AGAIN', FIELD.width / 2, 480);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw(state, screen, best, muted) {
    resize();
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const offsetX = (canvas.width - FIELD.width * scale) / 2;
    const offsetY = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#02060e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.save();
    if (shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.86;
    } else {
      shake = 0;
    }
    drawBackdrop(state);
    for (const entity of state.entities) {
      if (!entity.active) continue;
      if (entity.kind === KIND_PEARL) drawPearl(entity);
      else if (entity.kind === KIND_BUBBLE) drawBubble(entity);
      else if (entity.kind === KIND_ANGLER) drawAngler(entity, state.player);
      else if (entity.kind === KIND_URCHIN) drawUrchin(entity);
      else if (entity.kind === KIND_JELLY) drawJelly(entity);
      else if (entity.kind === KIND_STAR) drawStar(entity);
      else if (entity.kind === KIND_HEART) drawHeart(entity);
    }
    drawPlayer(state);
    // Particles.
    for (const particle of state.particles) {
      if (!particle.active) continue;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating score texts.
    ctx.textAlign = 'center';
    ctx.font = `800 19px ${FONT}`;
    for (const text of state.texts) {
      if (!text.active) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, text.life));
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
    drawLight(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, muted);
    drawBanner(state);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return {
    draw,
    shake(amount) {
      shake = Math.max(shake, amount);
    },
  };
}
