// index.js
// Discord × GitHub × X (Twitter) Auto-Publisher
// Entry point — boots all systems
// MIT License

'use strict';

require('dotenv').config();

const logger      = require('./utils/logger');
const discord     = require('./systems/discord/client');
const webhook     = require('./systems/github/webhook');
const handler     = require('./systems/github/handler');
const { poster }  = require('./systems/twitter/poster');

// ─────────────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
process.on('uncaughtException',  (err) => logger.error('Uncaught exception:',  err));
// ─────────────────────────────────────────────────────────────

async function main() {
  logger.banner();
  logger.divider();

  // ── 1. Start Discord bot ───────────────────────────────
  logger.info('Starting Discord bot...');
  await discord.init();

  // ── 2. Initialise Twitter / X poster ──────────────────
  logger.info('Initialising Twitter (X) poster...');
  await poster.init();

  // ── 3. Register GitHub event handlers ─────────────────
  handler.register(webhook);

  // ── 4. Start webhook HTTP server ──────────────────────
  await webhook.start();

  logger.divider();
  logger.success('All systems online. Listening for GitHub webhooks…');
  logger.divider();
}

main().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
