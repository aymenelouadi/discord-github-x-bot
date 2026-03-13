// systems/discord/canvas.js
// Generates a beautiful 1200×630 release announcement card
// Layout: [LOGO]  PROJECT NAME  v1.0.0
//          Short description
//          ─────────────────────────────
//          changelog preview  +  github URL
// MIT License

'use strict';

const { createCanvas, loadImage } = require('canvas');
const path   = require('path');
const fs     = require('fs');
const logger = require('../../utils/logger');
const config = require('../../config.json');

const T = config.canvas.theme;
const W = config.canvas.width;   // 1200
const H = config.canvas.height;  // 630

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Clip ctx to a circle then draw an image */
function drawCircularImage(ctx, img, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Glow ring around a circle */
function drawGlowRing(ctx, x, y, radius, color, blur = 20) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Wrap long text into multiple lines */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw a rounded rectangle */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────
//  Main generator
// ─────────────────────────────────────────────────────────────
/**
 * @param {object}  opts
 * @param {Buffer|null}  opts.logoBuffer   - Discord guild icon PNG buffer (nullable)
 * @param {string}  opts.projectName
 * @param {string}  opts.version          - e.g. "v1.2.3"
 * @param {string}  opts.description      - short one-liner
 * @param {string}  opts.changelog        - raw release body (markdown stripped)
 * @param {string}  opts.repoUrl          - https://github.com/owner/repo
 * @param {string}  opts.language         - e.g. "JavaScript"
 * @returns {Promise<Buffer>}  PNG buffer
 */
async function generateReleaseCard(opts) {
  const {
    logoBuffer,
    projectName  = 'Project',
    version      = 'v1.0.0',
    description  = 'An awesome open-source project',
    changelog    = '',
    repoUrl      = '',
    language     = '',
  } = opts;

  logger.canvas(`Generating card for ${projectName} ${version}`);

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Background gradient ──────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,    T.bg_gradient_start);
  bg.addColorStop(0.55, T.bg_gradient_end);
  bg.addColorStop(1,    '#0d1117');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Decorative accent line (top) ─────────────────────────
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0,   T.accent_secondary);
  accentGrad.addColorStop(0.5, T.accent);
  accentGrad.addColorStop(1,   T.accent_secondary);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, W, 5);

  // ── Subtle grid noise overlay ────────────────────────────
  ctx.strokeStyle = 'rgba(88,185,255,0.03)';
  ctx.lineWidth   = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // ── Glowing circle background behind logo ────────────────
  const LOGO_X  = 130;
  const LOGO_Y  = 200;
  const LOGO_R  = 80;

  const glowRadial = ctx.createRadialGradient(LOGO_X, LOGO_Y, 0, LOGO_X, LOGO_Y, LOGO_R * 2);
  glowRadial.addColorStop(0,   hexToRgba(T.accent, 0.15));
  glowRadial.addColorStop(1,   'transparent');
  ctx.fillStyle = glowRadial;
  ctx.fillRect(0, 0, 300, 400);

  // ── Logo ─────────────────────────────────────────────────
  if (logoBuffer) {
    try {
      const logoImg = await loadImage(logoBuffer);
      drawGlowRing(ctx, LOGO_X, LOGO_Y, LOGO_R, T.logo_glow, 30);
      drawCircularImage(ctx, logoImg, LOGO_X, LOGO_Y, LOGO_R);
    } catch {
      drawFallbackLogo(ctx, LOGO_X, LOGO_Y, LOGO_R, projectName);
    }
  } else {
    drawFallbackLogo(ctx, LOGO_X, LOGO_Y, LOGO_R, projectName);
  }

  // ── Content area ─────────────────────────────────────────
  const CX = LOGO_X * 2 + LOGO_R + 20;  // content start X
  const CW = W - CX - 60;                // content width

  // ── Version badge ────────────────────────────────────────
  const badgeText = version;
  ctx.font = 'bold 20px Arial';
  const badgeW = ctx.measureText(badgeText).width + 28;
  const badgeH = 36;
  const badgeX = CX;
  const badgeY = 55;

  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 8);
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
  badgeGrad.addColorStop(0, T.accent_secondary);
  badgeGrad.addColorStop(1, T.accent);
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(badgeText, badgeX + 14, badgeY + 24);

  // ── Language badge ───────────────────────────────────────
  if (language) {
    const langX = badgeX + badgeW + 12;
    const langW = ctx.measureText(language).width + 24;
    roundRect(ctx, langX, badgeY, langW, badgeH, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth   = 1;
    ctx.stroke();
    ctx.fillStyle   = T.text_secondary;
    ctx.fillText(language, langX + 12, badgeY + 24);
  }

  // ── Project name ─────────────────────────────────────────
  ctx.fillStyle  = T.text_primary;
  ctx.font       = 'bold 58px Arial';
  ctx.textAlign  = 'left';
  ctx.shadowColor = T.accent;
  ctx.shadowBlur  = 12;
  ctx.fillText(projectName, CX, 180, CW);
  ctx.shadowBlur  = 0;

  // ── Description ──────────────────────────────────────────
  ctx.fillStyle = T.text_secondary;
  ctx.font      = '26px Arial';
  const descLines = wrapText(ctx, description, CW);
  let textY = 225;
  for (const line of descLines.slice(0, 2)) {
    ctx.fillText(line, CX, textY);
    textY += 36;
  }

  // ── Divider ───────────────────────────────────────────────
  const divY = textY + 18;
  const divGrad = ctx.createLinearGradient(CX, divY, CX + CW * 0.7, divY);
  divGrad.addColorStop(0,   T.accent);
  divGrad.addColorStop(0.6, T.accent_secondary);
  divGrad.addColorStop(1,   'transparent');
  ctx.strokeStyle = divGrad;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(CX, divY);
  ctx.lineTo(CX + CW * 0.7, divY);
  ctx.stroke();

  // ── Changelog preview ────────────────────────────────────
  if (changelog) {
    const cleanLines = changelog
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('---'))
      .map(l => l.replace(/^[-*•]\s*/, ''))
      .slice(0, 4);

    ctx.font      = '20px Arial';
    ctx.fillStyle = T.text_secondary;
    let clY = divY + 30;

    for (const line of cleanLines) {
      ctx.fillStyle = T.accent;
      ctx.fillText('▸', CX, clY);
      ctx.fillStyle = T.text_secondary;
      ctx.fillText(line.slice(0, 72) + (line.length > 72 ? '…' : ''), CX + 22, clY);
      clY += 30;
    }
  }

  // ── Bottom bar ────────────────────────────────────────────
  const barY = H - 70;
  roundRect(ctx, 30, barY, W - 60, 48, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1;
  ctx.stroke();

  // GitHub icon (unicode fallback)
  ctx.fillStyle = T.text_secondary;
  ctx.font      = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('⚙', 52, barY + 30);

  ctx.fillStyle = T.accent;
  ctx.font      = 'bold 18px Arial';
  ctx.fillText(repoUrl || `github.com/${projectName.toLowerCase()}`, 80, barY + 30);

  // MIT badge
  const mitText = '📄 MIT License';
  ctx.fillStyle = T.text_secondary;
  ctx.font      = '18px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(mitText, W - 52, barY + 30);

  // ── Bottom accent line ────────────────────────────────────
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, H - 5, W, 5);

  // ── Logo section label ────────────────────────────────────
  ctx.font      = 'bold 20px Arial';
  ctx.fillStyle = T.text_primary;
  ctx.textAlign = 'center';
  ctx.fillText(projectName, LOGO_X, LOGO_Y + LOGO_R + 30);

  ctx.font      = '16px Arial';
  ctx.fillStyle = T.text_secondary;
  ctx.fillText(version, LOGO_X, LOGO_Y + LOGO_R + 52);

  logger.canvas(`Card generated successfully (${W}×${H})`);

  return canvas.toBuffer('image/png');
}

// ─────────────────────────────────────────────────────────────
//  Fallback logo when no guild icon is available
// ─────────────────────────────────────────────────────────────
function drawFallbackLogo(ctx, x, y, r, name) {
  // Gradient filled circle
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  grad.addColorStop(0, '#58b9ff');
  grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // First letter
  ctx.fillStyle = '#ffffff';
  ctx.font      = `bold ${r}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((name || '?')[0].toUpperCase(), x, y);
  ctx.textBaseline = 'alphabetic';

  // Glow ring
  drawGlowRing(ctx, x, y, r, '#58b9ff', 25);
}

// ─────────────────────────────────────────────────────────────
//  Save to media/ and return buffer
// ─────────────────────────────────────────────────────────────
async function generateAndSave(opts) {
  const buffer   = await generateReleaseCard(opts);
  const fileName = `release-${opts.projectName.replace(/\s+/g, '-')}-${opts.version}-${Date.now()}.png`;
  const outPath  = path.resolve(__dirname, '../../media', fileName);

  if (!fs.existsSync(path.dirname(outPath)))
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

  fs.writeFileSync(outPath, buffer);
  logger.canvas(`Saved → ${outPath}`);

  return { buffer, filePath: outPath, fileName };
}

module.exports = { generateReleaseCard, generateAndSave };
