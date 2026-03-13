// systems/discord/client.js
// Discord.js client — bootstraps the bot and exposes guild logo fetcher
// MIT License

'use strict';

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');

const axios  = require('axios');
const path   = require('path');
const fs     = require('fs');
const logger = require('../../utils/logger');
const config = require('../../config.json');

// ─────────────────────────────────────────────────────────────
//  Singleton Discord client
// ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ─────────────────────────────────────────────────────────────
//  Events
// ─────────────────────────────────────────────────────────────
client.once('ready', () => {
  logger.discord(`Logged in as ${client.user.tag}`);

  client.user.setPresence({
    activities: [{
      name: config.discord.status_message || 'Watching GitHub 🚀',
      type: ActivityType.Watching,
    }],
    status: 'online',
  });

  logger.discord(`Status set: "${config.discord.status_message}"`);
});

client.on('error',    err  => logger.error('Discord client error:', err));
client.on('warn',     warn => logger.warn ('Discord warning:',      warn));

// ─────────────────────────────────────────────────────────────
//  Command handler  (!status)
// ─────────────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.discord.prefix || '!')) return;

  const args    = message.content.slice(1).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  if (command === 'status') {
    const statusCmd = require('../../commands/status');
    await statusCmd.execute(message, args);
  }
});

// ─────────────────────────────────────────────────────────────
//  Utility: fetch guild icon as a Buffer
// ─────────────────────────────────────────────────────────────
async function fetchGuildIcon(guildId) {
  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild.icon) {
      logger.discord(`Guild ${guildId} has no icon — using fallback`);
      return null;
    }

    const url = guild.iconURL({ size: 256, extension: 'png' });
    logger.discord(`Fetching guild icon from: ${url}`);

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    logger.error('Failed to fetch guild icon:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Utility: post a release embed to a Discord channel
// ─────────────────────────────────────────────────────────────
async function postReleaseEmbed(channelId, { repoConfig, releaseData, imageBuffer }) {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    const embed = new EmbedBuilder()
      .setColor(repoConfig.discord.embed_color || '#58b9ff')
      .setTitle(`🚀 ${repoConfig.project.name} — ${releaseData.tag_name}`)
      .setDescription(
        (releaseData.body || 'No changelog provided.')
          .split('\n').slice(0, 10).join('\n')
      )
      .addFields(
        { name: 'Repository', value: `[\`${repoConfig.repo}\`](https://github.com/${repoConfig.repo})`, inline: true },
        { name: 'Version',    value: `\`${releaseData.tag_name}\``, inline: true },
        { name: 'Author',     value: `\`${releaseData.author?.login || 'unknown'}\``, inline: true },
      )
      .setURL(releaseData.html_url)
      .setTimestamp()
      .setFooter({ text: 'MIT License • Open Source', iconURL: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png' });

    const files = [];
    if (imageBuffer) {
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'release-card.png' });
      embed.setImage('attachment://release-card.png');
      files.push(attachment);
    }

    await channel.send({ embeds: [embed], files });
    logger.discord(`Release embed posted to channel ${channelId}`);
  } catch (err) {
    logger.error('Failed to post Discord embed:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
//  Init → returns connected client
// ─────────────────────────────────────────────────────────────
async function init() {
  await client.login(process.env.DISCORD_TOKEN);
  return client;
}

module.exports = { client, init, fetchGuildIcon, postReleaseEmbed };
