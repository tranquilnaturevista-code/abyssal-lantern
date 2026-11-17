// Keyboard and pointer input. Held keys give a swim direction; the pointer steers the fish
// while its button is held; one-shot presses (start, restart, pause, dash, mute) are queued
// as bit flags and taken once by the loop, so a press between two frames is never lost and
// never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_DASH = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let pointer = { x: 0, y: 0, active: false, down: false };

  function press(event, code) {
    if (UP.has(code)) keys.up = true;
    else if (DOWN.has(code)) keys.down = true;
    else if (LEFT.has(code)) keys.left = true;
    else if (RIGHT.has(code)) keys.right = true;
    else if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (DASH.has(code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  }

  window.addEventListener('keydown', (event) => press(event, event.code));
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    pointer.down = false;
  });

  function track(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 1280;
    pointer.y = ((event.clientY - rect.top) / rect.height) * 720;
    pointer.active = true;
  }
  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerdown', (event) => {
    track(event);
    pointer.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });

  return {
    /** A unit swim vector from the keys, or toward the pointer while its button is held. */
    moveVector(playerX, playerY) {
      let x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      let y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0 && pointer.down) {
        const dx = pointer.x - playerX;
        const dy = pointer.y - playerY;
        const length = Math.hypot(dx, dy);
        if (length > 12) {
          x = dx / length;
          y = dy / length;
        }
      } else if (x !== 0 || y !== 0) {
        const length = Math.hypot(x, y);
        x /= length;
        y /= length;
      }
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
