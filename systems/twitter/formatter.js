// systems/twitter/formatter.js
// Builds beautiful, engaging tweet text from release data
// MIT License

'use strict';

const config = require('../../config.json');

// ─────────────────────────────────────────────────────────────
//  Strip markdown from changelog body
// ─────────────────────────────────────────────────────────────
function stripMarkdown(text = '') {
  return text
    .replace(/#{1,6}\s*/g, '')        // headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g,     '$1') // italic
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1') // code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/^>\s*/gm, '')           // blockquotes
    .trim();
}

// ─────────────────────────────────────────────────────────────
//  Extract bullet points from changelog body
// ─────────────────────────────────────────────────────────────
function extractBullets(body = '', max = 5) {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = [];

  for (const line of lines) {
    if (bullets.length >= max) break;
    if (/^[-*•+]\s+/.test(line)) {
      const clean = stripMarkdown(line.replace(/^[-*•+]\s+/, ''));
      if (clean.length > 2) bullets.push(clean);
    }
  }

  // Fallback: non-heading lines
  if (bullets.length === 0) {
    for (const line of lines) {
      if (bullets.length >= max) break;
      if (!line.startsWith('#') && line.length > 10) {
        bullets.push(stripMarkdown(line));
      }
    }
  }

  return bullets;
}

// ─────────────────────────────────────────────────────────────
//  Format release tweet
// ─────────────────────────────────────────────────────────────
function formatReleaseTweet(repoConfig, releaseData) {
  const { project } = repoConfig;
  const tplCfg      = config.twitter.tweet_templates.release;

  const name    = project.name        || repoConfig.repo.split('/').pop();
  const version = releaseData.tag_name || '';
  const desc    = project.short_description || '';
  const url     = releaseData.html_url || `https://github.com/${repoConfig.repo}/releases`;
  const bullets = extractBullets(releaseData.body || '', tplCfg.max_changelog_lines || 5);
  const tags    = (repoConfig.twitter.hashtags || []).map(t => `#${t}`).join(' ');

  const changelogSection = bullets.length > 0
    ? bullets.map(b => `  ▸ ${b}`).join('\n')
    : '  ▸ See release notes for details';

  const tweet = [
    `${tplCfg.header}`,
    ``,
    `📦 ${name}  ${version}`,
    desc ? `💬 ${desc}` : '',
    ``,
    `✨ What's New:`,
    changelogSection,
    ``,
    `🔗 ${url}`,
    ``,
    tags,
    ``,
    tplCfg.footer,
  ]
    .filter(l => l !== undefined && l !== null)
    .join('\n');

  // Twitter limit: 280 chars (without media) / keep headroom for image
  return tweet.length > 270
    ? tweet.slice(0, 267) + '…'
    : tweet;
}

// ─────────────────────────────────────────────────────────────
//  Format push tweet
// ─────────────────────────────────────────────────────────────
function formatPushTweet(repoConfig, pushData) {
  const { project } = repoConfig;
  const tplCfg      = config.twitter.tweet_templates.push;

  const name    = project.name || repoConfig.repo.split('/').pop();
  const branch  = pushData.ref?.replace('refs/heads/', '') || 'main';
  const commits = (pushData.commits || []).slice(0, tplCfg.max_changelog_lines || 3);
  const url     = `https://github.com/${repoConfig.repo}/commits/${branch}`;
  const tags    = (repoConfig.twitter.hashtags || []).map(t => `#${t}`).join(' ');

  const commitLines = commits.length > 0
    ? commits.map(c => `  ▸ ${c.message.split('\n')[0].slice(0, 60)}`).join('\n')
    : '  ▸ New commits landed';

  const tweet = [
    `${tplCfg.header}`,
    ``,
    `📦 ${name}  •  branch: ${branch}`,
    ``,
    `📝 Recent Commits:`,
    commitLines,
    ``,
    `🔗 ${url}`,
    ``,
    tags,
    ``,
    tplCfg.footer,
  ]
    .filter(l => l !== undefined && l !== null)
    .join('\n');

  return tweet.length > 270 ? tweet.slice(0, 267) + '…' : tweet;
}

module.exports = { formatReleaseTweet, formatPushTweet, extractBullets, stripMarkdown };
