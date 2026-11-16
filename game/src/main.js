// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens:
// title, play, paused and game over. Sound effects fire on the world's
// events; the best score is kept in localStorage.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|action|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_POWERUP, EVENT_SHOOT, EVENT_WAVE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
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

function runShot(name) {
  const shotRandom = createRandom((seed * 31 + 7) | 0);
  const scene = stageShot(name, world, shotRandom);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, 0, false, null);
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
  let accumulator = 0;
  let last = performance.now();
  // The title screen runs the world as a harmless backdrop.
  let backdrop = true;
  // A test handle: window.__voidlight exposes the live state so an automated
  // play-test (or a curious player in devtools) can read the game without
  // touching the loop. It changes nothing about how the game runs.
  window.__voidlight = { state: world.state, world, screen: () => screen, best: () => best };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    screen = SCREEN_PLAY;
    backdrop = false;
    audio.unlock();
    announce('Wave 1. Good hunting.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_KILL) audio.explosion();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_POWERUP) audio.powerup();
    if (events & EVENT_WAVE) {
      audio.waveClear();
      announce(`Wave ${world.state.wave} cleared. Wave ${world.state.wave + 1} incoming.`);
    }
    if (events & EVENT_OVER) {
      audio.gameOver();
      screen = SCREEN_OVER;
      if (world.state.score > best) {
        best = world.state.score;
        saveBest(best);
      }
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Resumed.');
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        startGame();
      }
    }
    const steer = input.steer();
    const aimRaw = input.aim();
    // The aim point is in canvas CSS pixels; convert it to field coordinates.
    let aim = null;
    if (aimRaw !== null) {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
      const ox = (rect.width - FIELD.width * scale) / 2;
      const oy = (rect.height - FIELD.height * scale) / 2;
      aim = { x: (aimRaw.x - ox) / scale, y: (aimRaw.y - oy) / scale };
    }
    while (accumulator >= STEP) {
      accumulator -= STEP;
      if (screen === SCREEN_PLAY) {
        const events = world.step(STEP, steer, aim, input.isFiring(), false);
        handleEvents(events);
      } else if (screen === SCREEN_TITLE && backdrop) {
        world.step(STEP, { x: 0, y: 0 }, null, false, true);
      }
    }
    renderer.draw(world.state, screen, best, audio.muted, screen === SCREEN_PLAY ? aim : null);
  }

  announce('VOIDLIGHT. Click or press Enter to launch.');
  requestAnimationFrame(frame);
}

if (shot === 'start' || shot === 'play' || shot === 'action' || shot === 'end') runShot(shot);
else runGame();
