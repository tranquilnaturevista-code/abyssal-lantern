// The screenshot scenes behind ?shot=start|play|deep|end. Each one plays the real rules
// forward from a fresh world for a fixed stretch, steered by a simple autopilot (chase the
// nearest pearl, or a bubble when the air runs low; shy away from predators when it is
// careful), so the frame is what a short game really looks like and the same seed always
// gives the same frame.

import { FIELD, STEP } from './config.js';
import {
  EVENT_OVER, KIND_ANGLER, KIND_BUBBLE, KIND_JELLY, KIND_PEARL, KIND_URCHIN,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const DEEP_SECONDS = 300;
const END_LIMIT_SECONDS = 600;
const TRENCH_DEPTH = 810;

function isPredator(kind) {
  return kind === KIND_ANGLER || kind === KIND_URCHIN || kind === KIND_JELLY;
}

/**
 * A unit swim vector for this frame. `careful` flees predators and dashes out of trouble;
 * a careless pilot only chases pearls, as a hurried player does.
 */
function autopilot(state, careful) {
  const player = state.player;
  let fleeX = 0;
  let fleeY = 0;
  let nearestPredator = null;
  let nearestPredatorDistance = Infinity;
  let nearestPearl = null;
  let nearestPearlDistance = Infinity;
  let nearestBubble = null;
  let nearestBubbleDistance = Infinity;
  for (let index = 0; index < state.entities.length; index += 1) {
    const entity = state.entities[index];
    if (!entity.active) continue;
    const dx = entity.x - player.x;
    const dy = entity.y - player.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (isPredator(entity.kind)) {
      if (distance < nearestPredatorDistance) {
        nearestPredator = entity;
        nearestPredatorDistance = distance;
      }
      if (careful && distance < 220) {
        const weight = (220 - distance) / 220;
        fleeX -= (dx / distance) * weight;
        fleeY -= (dy / distance) * weight;
      }
    } else if (entity.kind === KIND_PEARL && distance < nearestPearlDistance) {
      nearestPearl = entity;
      nearestPearlDistance = distance;
    } else if (entity.kind === KIND_BUBBLE && distance < nearestBubbleDistance) {
      nearestBubble = entity;
      nearestBubbleDistance = distance;
    }
  }
  const target = state.oxygen < 45 && nearestBubble !== null ? nearestBubble : nearestPearl;
  let moveX = 0;
  let moveY = 0;
  if (target !== null) {
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    moveX = dx / length;
    moveY = dy / length;
  } else {
    moveX = (FIELD.width / 2 - player.x) / FIELD.width;
    moveY = 0.2;
  }
  if (careful) {
    // A hunter right on top of it outranks every pearl: run straight away from the
    // nearest one, never trusting a summed flee vector that two hunters can cancel.
    if (nearestPredator !== null && nearestPredatorDistance < 110) {
      const dx = player.x - nearestPredator.x;
      const dy = player.y - nearestPredator.y;
      const length = Math.hypot(dx, dy) || 1;
      return { move: { x: dx / length, y: dy / length }, dash: player.dashCooldown === 0 };
    }
    moveX += fleeX * 2.2;
    moveY += fleeY * 2.2;
    // Never get cornered: push away from the edges of the water.
    if (player.x < 110) moveX += (110 - player.x) / 110;
    if (player.x > FIELD.width - 110) moveX -= (player.x - (FIELD.width - 110)) / 110;
    if (player.y < 90) moveY += (90 - player.y) / 90;
    if (player.y > FIELD.height - 90) moveY -= (player.y - (FIELD.height - 90)) / 90;
  }
  const length = Math.hypot(moveX, moveY);
  if (length > 0.001) {
    moveX /= length;
    moveY /= length;
  }
  const dash = careful && nearestPredatorDistance < 105 && player.dashCooldown === 0;
  return { move: { x: moveX, y: moveY }, dash };
}

/** Run the world forward for `seconds` at the fixed step, steering with the autopilot. */
function playForward(world, seconds, careful, until) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const pilot = autopilot(world.state, careful);
    const events = world.step(STEP, pilot.move, pilot.dash, false);
    if (events & EVENT_OVER) return true;
    if (until !== undefined && until(world.state)) return false;
  }
  return false;
}

/**
 * Set `world` to the named scene (start, play, deep or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    playForward(world, PLAY_SECONDS, true);
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'deep') {
    playForward(world, DEEP_SECONDS, true, (state) => state.depth >= TRENCH_DEPTH);
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    playForward(world, END_LIMIT_SECONDS, false);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
