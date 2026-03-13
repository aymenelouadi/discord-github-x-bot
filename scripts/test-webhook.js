// scripts/test-webhook.js
// Sends a simulated GitHub release webhook to test the full pipeline
// Usage: node scripts/test-webhook.js

'use strict';

require('dotenv').config();

const crypto  = require('crypto');
const http    = require('http');
const https   = require('https');
const config  = require('../config.json');

const SECRET     = process.env.WEBHOOK_SECRET || '';
const PUBLIC_URL = (process.env.WEBHOOK_PUBLIC_URL || '').replace(/\/$/, '');
const PORT       = process.env.WEBHOOK_PORT || config.webhook_server.port || 3000;
const PATH       = config.webhook_server.path || '/github/webhook';

// Use first enabled repo in config
const repo = config.repositories.find(r => r.enabled !== false);
if (!repo) { console.error('No enabled repo in config.json'); process.exit(1); }

const payload = JSON.stringify({
  action: 'published',
  release: {
    tag_name:  'v1.0.0-test',
    name:      'Test Release v1.0.0',
    html_url:  `https://github.com/${repo.repo}/releases/tag/v1.0.0-test`,
    body: [
      '- First public release 🚀',
      '- Discord × GitHub × X integration',
      '- Canvas 1200×630 announcement card',
      '- Multi-repo webhook support',
      '- MIT License — Open Source',
    ].join('\n'),
    author: { login: repo.repo.split('/')[0] },
  },
  repository: {
    full_name: repo.repo,
    name:      repo.repo.split('/')[1],
    html_url:  `https://github.com/${repo.repo}`,
  },
});

const sig = SECRET
  ? `sha256=${crypto.createHmac('sha256', SECRET).update(payload).digest('hex')}`
  : 'sha256=no-secret';

const TARGET = PUBLIC_URL || `http://localhost:${PORT}`;
const url    = new URL(PATH, TARGET);

console.log('\n🧪 Sending test webhook...');
console.log(`   Repo    : ${repo.repo}`);
console.log(`   Event   : release (published)`);
console.log(`   Tag     : v1.0.0-test`);
console.log(`   Target  : ${url.href}`);
console.log(`   Secret  : ${SECRET ? '✓ signed' : '✗ no secret'}\n`);

const body = Buffer.from(payload);
const opts = {
  hostname: url.hostname,
  port:     url.port || (url.protocol === 'https:' ? 443 : 80),
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':           'application/json',
    'Content-Length':         body.length,
    'X-GitHub-Event':         'release',
    'X-Hub-Signature-256':    sig,
    'X-GitHub-Delivery':      `test-${Date.now()}`,
    'User-Agent':             'GitHub-Hookshot/test',
  },
};

const transport = url.protocol === 'https:' ? https : http;
const req = transport.request(opts, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`✅ Webhook accepted! Status: ${res.statusCode}`);
      console.log(`   Response: ${data}`);
      console.log('\n👀 Watch the bot console for the full pipeline output.');
    } else {
      console.log(`❌ Unexpected status: ${res.statusCode}`);
      console.log(`   Response: ${data}`);
    }
  });
});

req.on('error', (err) => {
  console.error(`❌ Request failed: ${err.message}`);
  console.error('   Is the bot running? Check npm start');
});

req.write(body);
req.end();
