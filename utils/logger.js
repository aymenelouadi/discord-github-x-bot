// utils/logger.js
// Colorful timestamped logger
// MIT License

'use strict';

const chalk = require('chalk');

const LEVELS = {
  info:    { label: 'INFO   ', color: chalk.cyan },
  success: { label: 'SUCCESS', color: chalk.green },
  warn:    { label: 'WARN   ', color: chalk.yellow },
  error:   { label: 'ERROR  ', color: chalk.red },
  github:  { label: 'GITHUB ', color: chalk.magenta },
  discord: { label: 'DISCORD', color: chalk.blue },
  twitter: { label: 'TWITTER', color: chalk.hex('#1DA1F2') },
  canvas:  { label: 'CANVAS ', color: chalk.hex('#F97316') },
};

function timestamp() {
  return chalk.gray(new Date().toISOString().replace('T', ' ').split('.')[0]);
}

function log(level, ...args) {
  const { label, color } = LEVELS[level] || LEVELS.info;
  console.log(`${timestamp()}  ${color(`[${label}]`)}`, ...args);
}

const logger = {
  info:    (...a) => log('info',    ...a),
  success: (...a) => log('success', ...a),
  warn:    (...a) => log('warn',    ...a),
  error:   (...a) => log('error',   ...a),
  github:  (...a) => log('github',  ...a),
  discord: (...a) => log('discord', ...a),
  twitter: (...a) => log('twitter', ...a),
  canvas:  (...a) => log('canvas',  ...a),

  divider: () => console.log(chalk.gray('─'.repeat(70))),

  banner: () => {
    console.log();
    console.log(chalk.hex('#58b9ff').bold('  ╔══════════════════════════════════════════════╗'));
    console.log(chalk.hex('#58b9ff').bold('  ║   Discord × GitHub × X Auto-Publisher v1.0  ║'));
    console.log(chalk.hex('#58b9ff').bold('  ║              MIT License  🚀                 ║'));
    console.log(chalk.hex('#58b9ff').bold('  ╚══════════════════════════════════════════════╝'));
    console.log();
  },
};

module.exports = logger;
