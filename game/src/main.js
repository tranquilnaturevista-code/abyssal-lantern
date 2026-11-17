// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the dive. ?shot=start|play|deep|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUBBLE, EVENT_COLLECT, EVENT_DASH, EVENT_HEART, EVENT_HIT, EVENT_OVER, EVENT_STAR, EVENT_TRENCH, EVENT_ZONE } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** A small handle for automated play-testing: the live screen, score, lives and depth. */
function expose(screen, best) {
  window.__abyssal = {
    screen, score: world.state.score, lives: world.state.lives,
    depth: Math.floor(world.state.depth), zone: world.state.zone,
    oxygen: Math.round(world.state.oxygen), combo: world.state.combo,
    trench: world.state.trenchReached, best,
    x: Math.round(world.state.player.x), y: Math.round(world.state.player.y),
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    expose(scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.start();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Diving. ${LIVES} lives. Collect pearls, watch your oxygen.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.over();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Depth ${Math.floor(world.state.depth)} metres. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      return;
    }
    if (actions & ACTION_RESTART && screen === SCREEN_OVER) {
      startGame();
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Diving.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    const dash = Boolean(actions & ACTION_DASH);
    const events = world.step(STEP, input.moveVector(world.state.player.x, world.state.player.y), dash, false);
    if (events & EVENT_COLLECT) audio.collect(world.state.combo);
    if (events & EVENT_BUBBLE) audio.bubble();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_STAR) audio.star();
    if (events & EVENT_HEART) audio.heart();
    if (events & EVENT_ZONE) audio.zone();
    if (events & EVENT_TRENCH) audio.zone();
    if (events & EVENT_HIT) {
      audio.hit();
      renderer.shake(14);
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
    expose(screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the air run out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Abyssal Lantern. Press Space or click to dive.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
