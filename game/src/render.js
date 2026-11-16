// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Neon glow (shadowBlur) for the ship,
// bullets and enemies; a drifting starfield and two soft nebulae behind
// everything; canvas text for the HUD and the panels. Text that holds a
// number is rebuilt only when the number changes, so a frame allocates nothing.

import {
  EBULLET,
  ENEMY,
  FIELD,
  FONT,
  KIND_CHASER,
  KIND_MINI,
  KIND_SHOOTER,
  KIND_SPLITTER,
  KIND_WEAVER,
  LIVES,
  PALETTE,
  PLAYER,
  POW_LIFE,
  POW_RAPID,
  POW_SHIELD,
  POW_SPREAD,
  POWERUP,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 138, line: 32, bottom: 72 };
const TAU = Math.PI * 2;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function powColor(kind) {
  if (kind === POW_SPREAD) return PALETTE.spread;
  if (kind === POW_RAPID) return PALETTE.rapid;
  if (kind === POW_SHIELD) return PALETTE.shield;
  return PALETTE.life;
}

function powLetter(kind) {
  if (kind === POW_SPREAD) return 'S';
  if (kind === POW_RAPID) return 'R';
  if (kind === POW_SHIELD) return 'H';
  return '+';
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const killsLabel = cachedLabel('KILLS ');

  // Two nebulae, painted once to offscreen canvases and blitted each frame.
  const nebulae = [];
  for (let i = 0; i < 2; i += 1) {
    const off = document.createElement('canvas');
    off.width = 640;
    off.height = 360;
    const octx = off.getContext('2d');
    const grad = octx.createRadialGradient(320, 180, 10, 320, 180, 320);
    const color = i === 0 ? PALETTE.nebulaA : PALETTE.nebulaB;
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, 640, 360);
    nebulae.push({ canvas: off, x: i === 0 ? 60 : 620, y: i === 0 ? 40 : 330 });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function glow(color, blur) {
    context.shadowColor = color;
    context.shadowBlur = blur;
  }

  function noGlow() {
    context.shadowBlur = 0;
  }

  function drawBackground(state) {
    context.fillStyle = PALETTE.space;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const n of nebulae) context.drawImage(n.canvas, n.x, n.y);
    for (const s of state.stars) {
      const alpha = s.layer === 1 ? 0.4 : s.layer === 2 ? 0.7 : 1;
      context.globalAlpha = alpha;
      context.fillStyle = '#cfe4ff';
      context.fillRect(s.x, s.y, s.size, s.size);
    }
    context.globalAlpha = 1;
  }

  function drawShip(player, aimX, aimY) {
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    context.save();
    context.translate(player.x, player.y);
    context.rotate(player.angle);
    if (player.thrust > 0) {
      const flick = 10 + Math.random() * 8;
      context.fillStyle = '#ff9f2e';
      context.beginPath();
      context.moveTo(-PLAYER.radius - 2, -5);
      context.lineTo(-PLAYER.radius - flick, 0);
      context.lineTo(-PLAYER.radius - 2, 5);
      context.closePath();
      context.fill();
    }
    glow(PALETTE.player, 18);
    context.fillStyle = blink ? '#3a6b80' : PALETTE.player;
    context.beginPath();
    context.moveTo(PLAYER.radius + 4, 0);
    context.lineTo(-PLAYER.radius, -PLAYER.radius * 0.8);
    context.lineTo(-PLAYER.radius * 0.45, 0);
    context.lineTo(-PLAYER.radius, PLAYER.radius * 0.8);
    context.closePath();
    context.fill();
    noGlow();
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(2, 0, 4, 0, TAU);
    context.fill();
    context.restore();
    if (player.shield > 0) {
      context.save();
      context.globalAlpha = 0.5 + 0.3 * Math.sin(performance.now() / 120);
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radiusShield, 0, TAU);
      context.stroke();
      context.restore();
    }
    // Aim reticle at the mouse.
    if (aimX !== null && aimY !== null) {
      context.save();
      context.strokeStyle = 'rgba(238,244,255,0.7)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(aimX, aimY, 10, 0, TAU);
      context.stroke();
      context.beginPath();
      context.moveTo(aimX - 14, aimY);
      context.lineTo(aimX - 6, aimY);
      context.moveTo(aimX + 6, aimY);
      context.lineTo(aimX + 14, aimY);
      context.moveTo(aimX, aimY - 14);
      context.lineTo(aimX, aimY - 6);
      context.moveTo(aimX, aimY + 6);
      context.lineTo(aimX, aimY + 14);
      context.stroke();
      context.restore();
    }
  }

  function drawEnemy(e) {
    const def = ENEMY[e.kind];
    context.save();
    context.translate(e.x, e.y);
    if (e.flash > 0) {
      context.fillStyle = '#ffffff';
    } else {
      context.fillStyle = def.color;
    }
    glow(def.color, 16);
    if (e.kind === KIND_CHASER || e.kind === KIND_MINI) {
      context.rotate(e.angle);
      context.beginPath();
      context.moveTo(e.radius, 0);
      context.lineTo(-e.radius * 0.7, -e.radius * 0.7);
      context.lineTo(-e.radius * 0.7, e.radius * 0.7);
      context.closePath();
      context.fill();
    } else if (e.kind === KIND_SHOOTER) {
      context.rotate(e.angle);
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        const x = Math.cos(a) * e.radius;
        const y = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#1a0d00';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.35, 0, TAU);
      context.fill();
    } else if (e.kind === KIND_SPLITTER) {
      context.rotate(e.angle);
      context.fillRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
      context.fillStyle = 'rgba(5,6,15,0.55)';
      context.fillRect(-e.radius * 0.45, -e.radius * 0.45, e.radius * 0.9, e.radius * 0.9);
    } else if (e.kind === KIND_WEAVER) {
      context.beginPath();
      context.arc(0, 0, e.radius, 0, TAU);
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, e.radius * 0.5, 0, TAU);
      context.stroke();
    }
    noGlow();
    context.restore();
    // Shooter health pips.
    if (e.kind === KIND_SHOOTER && e.hp === 1) {
      context.fillStyle = '#ffffff';
      context.fillRect(e.x - 8, e.y - e.radius - 8, 16, 3);
    }
  }

  function drawField(state, aim) {
    drawBackground(state);
    for (const b of state.bullets) {
      if (!b.active) continue;
      glow(PALETTE.bullet, 12);
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, PLAYER.bulletRadius, 0, TAU);
      context.fill();
    }
    for (const b of state.ebullets) {
      if (!b.active) continue;
      glow(PALETTE.ebullet, 12);
      context.fillStyle = PALETTE.ebullet;
      context.beginPath();
      context.arc(b.x, b.y, EBULLET.radius, 0, TAU);
      context.fill();
    }
    noGlow();
    for (const p of state.powerups) {
      if (!p.active) continue;
      const color = powColor(p.kind);
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 150);
      context.save();
      context.globalAlpha = Math.min(1, p.life < 2 ? p.life / 2 : 1) * pulse;
      glow(color, 14);
      context.fillStyle = color;
      context.beginPath();
      context.arc(p.x, p.y, POWERUP.radius, 0, TAU);
      context.fill();
      noGlow();
      context.fillStyle = '#05060f';
      context.font = `bold 16px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(powLetter(p.kind), p.x, p.y + 1);
      context.restore();
    }
    for (const e of state.enemies) {
      if (e.active) drawEnemy(e);
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    drawShip(state.player, aim === null ? null : aim.x, aim === null ? null : aim.y);
  }

  function drawHud(state, muted) {
    text(scoreLabel(state.score), 24, 34, 28, PALETTE.text, 'left', 'top');
    text(waveLabel(state.wave), FIELD.width / 2, 34, 28, PALETTE.text, 'center', 'top');
    const firstLife = FIELD.width - 24 - LIVES * 28;
    text('LIVES', firstLife - 14, 34, 20, PALETTE.muted, 'right', 'top');
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.life : '#2a3040';
      context.save();
      context.translate(firstLife + life * 28 + 7, 40);
      context.beginPath();
      context.moveTo(7, -7);
      context.lineTo(-7, 0);
      context.lineTo(7, 7);
      context.closePath();
      context.fill();
      context.restore();
    }
    // Active effect timers.
    let y = 66;
    if (state.player.spread > 0) {
      text(`SPREAD ${Math.ceil(state.player.spread)}s`, 24, y, 18, PALETTE.spread, 'left', 'top');
      y += 22;
    }
    if (state.player.rapid > 0) {
      text(`RAPID ${Math.ceil(state.player.rapid)}s`, 24, y, 18, PALETTE.rapid, 'left', 'top');
      y += 22;
    }
    if (state.player.shield > 0) {
      text(`SHIELD ${Math.ceil(state.player.shield)}s`, 24, y, 18, PALETTE.shield, 'left', 'top');
      y += 22;
    }
    if (muted) text('MUTED (M)', FIELD.width - 24, FIELD.height - 20, 16, PALETTE.muted, 'right', 'bottom');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5,6,15,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 74, 52, accent, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.bullet, 'center');
  }

  const TITLE_LINES = [
    'Survive the waves. Destroy everything. Beat your best.',
    'Move — W A S D or arrow keys',
    'Aim — mouse      Fire — click or Space',
    'Power-ups: S spread · R rapid fire · H shield · + extra life',
    'Pause — P      Mute — M',
    '',
  ];
  const PAUSED_LINES = ['The void will wait for you.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, muted, aim) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state, screen === SCREEN_PLAY ? aim : null);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('VOIDLIGHT', TITLE_LINES, 'Click or press Enter to launch', PALETTE.player);
      return;
    }
    drawHud(state, muted);
    if (screen === SCREEN_PAUSED) drawPanel('PAUSED', PAUSED_LINES, 'Press P to resume', PALETTE.text);
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = killsLabel(state.kills);
      OVER_LINES[2] = bestLabel(best);
      drawPanel('GAME OVER', OVER_LINES, 'Press Enter or click to fly again', PALETTE.ebullet);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
