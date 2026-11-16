// The screenshot scenes behind ?shot=start|play|action|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
//
// The autopilot: fire at the nearest enemy, steer away from the nearest
// enemy when it is close, drift toward a nearby power-up otherwise, and stay
// near the centre. The end scene's pilot does nothing, so the ship is caught
// out quickly, as a careless player is.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 30;
const ACTION_SECONDS = 48;
const END_LIMIT_SECONDS = 600;

/** The autopilot's aim and steering for one step, from the live state. */
function autopilot(state, random) {
  const player = state.player;
  let target = null;
  let targetD = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < targetD) {
      targetD = d;
      target = e;
    }
  }
  let aim = null;
  if (target !== null) {
    // Imperfect aim: the pilot misses often, so enemies survive long enough
    // to fill the frame instead of being picked off the moment they spawn.
    aim = { x: target.x + (random() - 0.5) * 140, y: target.y + (random() - 0.5) * 140 };
  }
  let sx = 0;
  let sy = 0;
  if (target !== null && targetD < 170) {
    // Flee from the closest threat.
    sx = (player.x - target.x) / targetD;
    sy = (player.y - target.y) / targetD;
  } else {
    // Chase a nearby power-up, else drift back toward the centre.
    let pow = null;
    let powD = 130;
    for (const p of state.powerups) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < powD) {
        powD = d;
        pow = p;
      }
    }
    const tx = pow !== null ? pow.x : FIELD.width / 2;
    const ty = pow !== null ? pow.y : FIELD.height / 2;
    const dx = tx - player.x;
    const dy = ty - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 40) {
      sx = dx / d;
      sy = dy / d;
    }
  }
  return { steer: { x: sx, y: sy }, aim, firing: target !== null };
}

/** Run the world forward for `seconds`, steering with the autopilot (or not at all). */
function playForward(world, seconds, pilot, random) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const control = pilot ? autopilot(world.state, random) : { steer: { x: 0, y: 0 }, aim: null, firing: false };
    const events = world.step(STEP, control.steer, control.aim, control.firing, false);
    if (events & EVENT_OVER) return true;
  }
  return false;
}

/**
 * Stage a screenshot scene: returns { screen, best } for the renderer, after
 * playing the world into that scene. `world` is a fresh world; the caller
 * passes the best score to show.
 */
export function stageShot(name, world, random) {
  if (name === 'start') {
    // A few drifters behind the title panel: the harmless backdrop.
    for (let i = 0; i < 4; i += 1) world.step(STEP, { x: 0, y: 0 }, null, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    playForward(world, PLAY_SECONDS, true, random);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'action') {
    // A later wave: fast-forward through wave 1 by clearing it, then fight wave 2.
    playForward(world, ACTION_SECONDS, true, random);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // end: the pilot stands still and never fires.
  playForward(world, END_LIMIT_SECONDS, false, random);
  return { screen: SCREEN_OVER, best: 0 };
}
