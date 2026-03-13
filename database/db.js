// database/db.js
// Lightweight JSON file database for tracking posted releases
// MIT License

'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULT_DATA = {
  posted_releases: [],   // { repo, tag, event_id, posted_at, tweet_id }
  posted_pushes:   [],   // { repo, sha, posted_at, tweet_id }
  stats: {
    total_releases_posted: 0,
    total_pushes_posted:   0,
    started_at: new Date().toISOString(),
  },
};

class Database {
  constructor(dbPath) {
    this.dbPath = path.resolve(dbPath);
    this._ensureFile();
    this.data = this._read();
  }

  // ── Private ────────────────────────────────────────────────

  _ensureFile() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir))  fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.dbPath))
      fs.writeFileSync(this.dbPath, JSON.stringify(DEFAULT_DATA, null, 2));
  }

  _read() {
    try {
      return JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
    } catch {
      return { ...DEFAULT_DATA };
    }
  }

  _save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  // ── Releases ───────────────────────────────────────────────

  hasRelease(repo, tag) {
    return this.data.posted_releases.some(
      r => r.repo === repo && r.tag === tag
    );
  }

  saveRelease(repo, tag, tweetId = null) {
    if (this.hasRelease(repo, tag)) return;
    this.data.posted_releases.push({
      repo,
      tag,
      tweet_id:  tweetId,
      posted_at: new Date().toISOString(),
    });
    this.data.stats.total_releases_posted++;
    this._save();
  }

  // ── Pushes ─────────────────────────────────────────────────

  hasPush(repo, sha) {
    return this.data.posted_pushes.some(
      p => p.repo === repo && p.sha === sha
    );
  }

  savePush(repo, sha, tweetId = null) {
    if (this.hasPush(repo, sha)) return;
    this.data.posted_pushes.push({
      repo,
      sha,
      tweet_id:  tweetId,
      posted_at: new Date().toISOString(),
    });
    this.data.stats.total_pushes_posted++;
    this._save();
  }

  // ── Stats ─────────────────────────────────────────────────

  getStats() {
    return {
      ...this.data.stats,
      recent_releases: this.data.posted_releases.slice(-5).reverse(),
      recent_pushes:   this.data.posted_pushes.slice(-5).reverse(),
    };
  }

  getRecentReleases(limit = 10) {
    return this.data.posted_releases.slice(-limit).reverse();
  }
}

module.exports = Database;
