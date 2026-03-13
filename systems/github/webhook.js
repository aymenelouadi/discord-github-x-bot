// systems/github/webhook.js
// Express server that receives GitHub webhook events
// Supports multiple repos, optional HMAC signature verification
// MIT License

'use strict';

require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const crypto     = require('crypto');
const config     = require('../../config.json');
const logger     = require('../../utils/logger');

const app        = express();
const PORT       = process.env.WEBHOOK_PORT       || config.webhook_server.port       || 3000;
const PATH       = config.webhook_server.path     || '/github/webhook';
const SECRET     = process.env.WEBHOOK_SECRET     || '';
const PUBLIC_URL = (process.env.WEBHOOK_PUBLIC_URL || config.webhook_server.public_url || '').replace(/\/$/, '');

// Store event handlers registered by other systems
const _handlers = new Map();  // eventName → Set<fn>

// ─────────────────────────────────────────────────────────────
//  HMAC signature validation
// ─────────────────────────────────────────────────────────────
function verifySignature(rawBody, signature) {
  if (!SECRET) return true;  // no secret configured → skip
  if (!signature) {
    logger.warn('Webhook: no X-Hub-Signature-256 header — skipping request');
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', SECRET)
    .update(rawBody)
    .digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ─────────────────────────────────────────────────────────────
//  Find which repo config matches the payload
// ─────────────────────────────────────────────────────────────
function findRepoConfig(fullName) {
  return config.repositories.find(
    r => r.enabled !== false &&
         r.repo.toLowerCase() === fullName?.toLowerCase()
  ) || null;
}

// ─────────────────────────────────────────────────────────────
//  Middleware — raw body for HMAC
// ─────────────────────────────────────────────────────────────
app.use(bodyParser.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// ─────────────────────────────────────────────────────────────
//  Main webhook endpoint
// ─────────────────────────────────────────────────────────────
app.post(PATH, async (req, res) => {
  const event = req.headers['x-github-event'];
  const sig   = req.headers['x-hub-signature-256'];

  // Validate HMAC
  if (!verifySignature(req.rawBody, sig)) {
    logger.warn('Webhook: invalid signature — rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload  = req.body;
  const fullName = payload?.repository?.full_name;

  logger.github(`Event received: [${event}] from ${fullName || 'unknown'}`);

  const repoConfig = findRepoConfig(fullName);

  if (!repoConfig) {
    logger.github(`No config found for "${fullName}" — ignoring event`);
    return res.status(200).json({ ok: true, message: 'repo not configured' });
  }

  // Dispatch to registered handlers asynchronously
  const handlers = _handlers.get(event) || new Set();
  for (const fn of handlers) {
    fn({ event, payload, repoConfig }).catch(err =>
      logger.error(`Handler error for ${event}:`, err.message)
    );
  }

  // Always acknowledge immediately
  res.status(200).json({ ok: true });
});

// Health-check endpoint
app.get('/health', (_req, res) => {
  res.json({
    ok:              true,
    uptime:          process.uptime(),
    webhook_url:     PUBLIC_URL ? `${PUBLIC_URL}${PATH}` : `http://localhost:${PORT}${PATH}`,
    repositories:    config.repositories.filter(r => r.enabled !== false).map(r => r.repo),
    timestamp:       new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────

/** Register a handler: on('release', async ({ event, payload, repoConfig }) => {}) */
function on(eventName, fn) {
  if (!_handlers.has(eventName)) _handlers.set(eventName, new Set());
  _handlers.get(eventName).add(fn);
}

/** Start the Express server */
function start() {
  return new Promise((resolve) => {
    const server = app.listen(PORT, () => {
      const publicEndpoint = PUBLIC_URL
        ? `${PUBLIC_URL}${PATH}`
        : `http://localhost:${PORT}${PATH}`;
      const publicHealth = PUBLIC_URL
        ? `${PUBLIC_URL}/health`
        : `http://localhost:${PORT}/health`;

      logger.github(`Webhook server listening on port ${PORT}`);
      logger.github(`Endpoint: POST ${publicEndpoint}`);
      logger.github(`Health:   GET  ${publicHealth}`);
      if (PUBLIC_URL) logger.github(`Public URL: ${PUBLIC_URL}`);
      if (!SECRET) logger.warn('WEBHOOK_SECRET not set — all requests accepted');
      resolve(server);
    });
  });
}

module.exports = { start, on };
