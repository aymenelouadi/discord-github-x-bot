// commands/status.js
// Discord command: !status  — shows bot health, configured repos, recent activity
// MIT License

'use strict';

const { EmbedBuilder } = require('discord.js');
const Database         = require('../database/db');
const config           = require('../config.json');

const db = new Database(config.database.path);

module.exports = {
  name: 'status',

  async execute(message) {
    const stats   = db.getStats();
    const repos   = config.repositories.filter(r => r.enabled !== false);
    const recent  = db.getRecentReleases(5);

    const repoList = repos.length > 0
      ? repos.map(r => `• [\`${r.repo}\`](https://github.com/${r.repo}) — ${r.project?.name || 'unnamed'}`).join('\n')
      : '_No repositories configured_';

    const recentList = recent.length > 0
      ? recent.map(r =>
          `• **${r.repo}** \`${r.tag}\` — <t:${Math.floor(new Date(r.posted_at).getTime() / 1000)}:R>`
        ).join('\n')
      : '_No releases posted yet_';

    const embed = new EmbedBuilder()
      .setColor('#58b9ff')
      .setTitle('📊 Bot Status — Discord × GitHub × X Publisher')
      .setDescription('Real-time status of the auto-publisher pipeline')
      .addFields(
        {
          name:   '🌐 Monitored Repositories',
          value:  repoList,
          inline: false,
        },
        {
          name:   '📦 Total Releases Posted',
          value:  `\`${stats.total_releases_posted}\``,
          inline: true,
        },
        {
          name:   '⚡ Total Pushes Posted',
          value:  `\`${stats.total_pushes_posted}\``,
          inline: true,
        },
        {
          name:   '⏱ Bot Running Since',
          value:  `<t:${Math.floor(new Date(stats.started_at).getTime() / 1000)}:R>`,
          inline: true,
        },
        {
          name:   '🕒 Recent Releases',
          value:  recentList,
          inline: false,
        },
      )
      .setFooter({ text: 'MIT License • Open Source • Discord×GitHub×X Publisher' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  },
};
