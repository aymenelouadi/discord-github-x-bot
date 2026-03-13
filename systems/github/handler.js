// systems/github/handler.js
// Orchestrates the full pipeline when a GitHub event is received:
//   1. Fetch Discord guild logo
//   2. Generate Canvas image
//   3. Post Discord embed
//   4. Post tweet on X
// MIT License

'use strict';

require('dotenv').config();

const logger          = require('../../utils/logger');
const Database        = require('../../database/db');
const config          = require('../../config.json');
const { fetchGuildIcon, postReleaseEmbed } = require('../discord/client');
const { generateAndSave }                  = require('../discord/canvas');
const { poster: twitterPoster }             = require('../twitter/poster');
const { formatReleaseTweet, formatPushTweet } = require('../twitter/formatter');

const db = new Database(config.database.path);

// ─────────────────────────────────────────────────────────────
//  Release event handler  (GitHub event: "release", action: "published")
// ─────────────────────────────────────────────────────────────
async function handleRelease({ payload, repoConfig }) {
  if (payload.action !== 'published') return;

  const release = payload.release;
  const tag     = release.tag_name;
  const repo    = repoConfig.repo;

  logger.github(`Release detected: ${repo} @ ${tag}`);

  // ── Deduplication ─────────────────────────────────────────
  if (db.hasRelease(repo, tag)) {
    logger.github(`Already posted release ${tag} for ${repo} — skipping`);
    return;
  }

  // ────────────────────────────────────────────────────────
  //  STEP 1 — Fetch Discord guild logo
  // ────────────────────────────────────────────────────────
  let logoBuffer = null;

  if (repoConfig.project.logo_source === 'discord_guild') {
    logger.discord(`Fetching guild icon for ${repoConfig.discord.guild_id}...`);
    logoBuffer = await fetchGuildIcon(repoConfig.discord.guild_id).catch(err => {
      logger.warn('Could not fetch guild icon:', err.message);
      return null;
    });
  }

  // ────────────────────────────────────────────────────────
  //  STEP 2 — Generate Canvas card
  // ────────────────────────────────────────────────────────
  let imageBuffer = null;
  let imagePath   = null;

  try {
    const result = await generateAndSave({
      logoBuffer,
      projectName: repoConfig.project.name,
      version:     tag,
      description: repoConfig.project.short_description,
      changelog:   release.body || '',
      repoUrl:     `github.com/${repo}`,
      language:    repoConfig.project.language,
    });
    imageBuffer = result.buffer;
    imagePath   = result.filePath;
    logger.canvas(`Image ready: ${result.fileName}`);
  } catch (err) {
    logger.error('Canvas generation failed:', err.message);
  }

  // ────────────────────────────────────────────────────────
  //  STEP 3 — Post Discord embed
  // ────────────────────────────────────────────────────────
  if (repoConfig.discord?.notify_on_release !== false) {
    await postReleaseEmbed(repoConfig.discord.channel_id, {
      repoConfig,
      releaseData: release,
      imageBuffer,
    }).catch(err => logger.error('Discord post failed:', err.message));
  }

  // ────────────────────────────────────────────────────────
  //  STEP 4 — Post tweet on X
  // ────────────────────────────────────────────────────────
  let tweetId = null;

  if (repoConfig.twitter?.enabled && repoConfig.twitter?.post_on_release !== false) {
    const tweetText = formatReleaseTweet(repoConfig, release);
    logger.twitter(`Tweet text:\n${'─'.repeat(40)}\n${tweetText}\n${'─'.repeat(40)}`);

    const result = await twitterPoster.post(tweetText, imageBuffer);

    if (result.success) {
      tweetId = result.tweetId;
      logger.twitter(`Tweet URL: ${result.url}`);
    } else {
      logger.warn(`Tweet skipped: ${result.reason}`);
    }
  }

  // ────────────────────────────────────────────────────────
  //  STEP 5 — Save to DB (dedup)
  // ────────────────────────────────────────────────────────
  db.saveRelease(repo, tag, tweetId);
  logger.success(`Pipeline complete for ${repo} @ ${tag}`);
}

// ─────────────────────────────────────────────────────────────
//  Push event handler
// ─────────────────────────────────────────────────────────────
async function handlePush({ payload, repoConfig }) {
  const sha    = payload.after;
  const branch = payload.ref?.replace('refs/heads/', '');
  const repo   = repoConfig.repo;

  // Filter by branch
  if (repoConfig.branch_filter && branch !== repoConfig.branch_filter) {
    logger.github(`Push to non-target branch "${branch}" — skipping`);
    return;
  }

  logger.github(`Push detected: ${repo} → ${branch} (${sha?.slice(0, 7)})`);

  if (db.hasPush(repo, sha)) {
    logger.github(`Already posted push ${sha?.slice(0, 7)} — skipping`);
    return;
  }

  let tweetId = null;

  if (repoConfig.twitter?.enabled && repoConfig.twitter?.post_on_push) {
    const tweetText = formatPushTweet(repoConfig, payload);
    const result    = await twitterPoster.post(tweetText, null);
    if (result.success) tweetId = result.tweetId;
  }

  if (repoConfig.discord?.notify_on_push && repoConfig.discord?.channel_id) {
    // Lightweight Discord notification for pushes
    try {
      const { client } = require('../discord/client');
      const { EmbedBuilder } = require('discord.js');
      const channel = await client.channels.fetch(repoConfig.discord.channel_id);

      const commits = (payload.commits || []).slice(0, 5);
      const desc    = commits.map(c => `• \`${c.id?.slice(0,7)}\` ${c.message.split('\n')[0]}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#7c3aed')
        .setTitle(`⚡ Push to \`${branch}\` — ${repoConfig.project.name}`)
        .setDescription(desc || 'No commits in payload')
        .setURL(`https://github.com/${repo}/commits/${branch}`)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('Discord push notification failed:', err.message);
    }
  }

  db.savePush(repo, sha, tweetId);
  logger.success(`Push pipeline complete for ${repo}`);
}

// ─────────────────────────────────────────────────────────────
//  Register handlers with the webhook server
// ─────────────────────────────────────────────────────────────
function register(webhookServer) {
  webhookServer.on('release', handleRelease);
  webhookServer.on('push',    handlePush);
  logger.github('Event handlers registered: release, push');
}

module.exports = { register, handleRelease, handlePush };
