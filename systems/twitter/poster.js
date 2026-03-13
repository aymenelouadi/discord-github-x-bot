// systems/twitter/poster.js
// Posts tweets to X (Twitter) using cookie-based auth (auth_token)
// Uses agent-twitter-client — no official API keys required
// MIT License

'use strict';

require('dotenv').config();

const fs     = require('fs');
const path   = require('path');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────
//  Lazy-load agent-twitter-client to avoid top-level crash
// ─────────────────────────────────────────────────────────────
let _Scraper = null;
function getScraper() {
  if (!_Scraper) {
    try {
      _Scraper = require('agent-twitter-client').Scraper;
    } catch {
      throw new Error(
        'agent-twitter-client is not installed. Run: npm install agent-twitter-client'
      );
    }
  }
  return _Scraper;
}

// ─────────────────────────────────────────────────────────────
//  TwitterPoster class
// ─────────────────────────────────────────────────────────────
class TwitterPoster {
  constructor() {
    this.scraper  = null;
    this.ready    = false;
  }

  // ── Initialise scraper and inject auth cookies ────────────
  async init() {
    const authToken = process.env.TWITTER_AUTH_TOKEN;
    const ct0       = process.env.TWITTER_CT0;

    if (!authToken) {
      logger.warn('TWITTER_AUTH_TOKEN is not set — Twitter posting is disabled');
      return false;
    }

    try {
      const Scraper  = getScraper();
      const { Cookie } = require('tough-cookie');
      this.scraper   = new Scraper();

      // All domains the scraper may hit — cookies must be valid for each
      const DOMAINS = ['x.com', 'twitter.com', 'api.x.com', 'api.twitter.com'];

      const makeCookie = (key, value) =>
        DOMAINS.map(domain => new Cookie({
          key,
          value,
          domain,
          path:     '/',
          secure:   true,
          httpOnly: true,
          sameSite: 'None',
        }));

      const cookies = [
        ...makeCookie('auth_token', authToken),
        ...(ct0 ? makeCookie('ct0', ct0) : []),
      ];

      await this.scraper.setCookies(cookies);

      // Verify login status
      const loggedIn = await this.scraper.isLoggedIn();
      if (!loggedIn) {
        logger.warn('Twitter: auth_token appears to be invalid or expired');
        logger.warn('Twitter: tweets will be skipped until valid credentials are provided');
        this.ready = false;
        return false;
      }

      this.ready = true;
      logger.twitter('Authenticated via auth_token cookie ✓');
      return true;
    } catch (err) {
      logger.error('Twitter init failed:', err.message);
      this.ready = false;
      return false;
    }
  }

  // ── Post tweet with optional image ───────────────────────
  /**
   * @param {string}       text         - Tweet text
   * @param {Buffer|null}  imageBuffer  - PNG image buffer (optional)
   * @returns {{ success: boolean, tweetId?: string, url?: string }}
   */
  async post(text, imageBuffer = null) {
    if (!this.ready) {
      logger.warn('Twitter not ready — attempting re-init...');
      const ok = await this.init();
      if (!ok) return { success: false, reason: 'not_authenticated' };
    }

    try {
      logger.twitter('Posting tweet...');
      logger.twitter(`Text preview: ${text.split('\n')[0]}...`);

      let mediaData = undefined;

      if (imageBuffer) {
        mediaData = [{
          data:      imageBuffer,
          mediaType: 'image/png',
        }];
        logger.twitter(`Attaching image (${(imageBuffer.length / 1024).toFixed(1)} KB)`);
      }

      const response = await this.scraper.sendTweet(text, undefined, mediaData);

      // agent-twitter-client returns the raw response or tweet ID
      const tweetId = response?.id_str || response?.data?.create_tweet?.tweet_results?.result?.rest_id;
      const url     = tweetId ? `https://x.com/i/status/${tweetId}` : 'https://x.com';

      logger.twitter(`✓ Tweet posted! ${url}`);
      return { success: true, tweetId, url };
    } catch (err) {
      logger.error('Failed to post tweet:', err.message);

      // Token might have expired — mark as not ready for retry
      if (err.message?.toLowerCase().includes('auth') ||
          err.message?.toLowerCase().includes('401') ||
          err.message?.toLowerCase().includes('forbidden')) {
        this.ready = false;
        logger.warn('Twitter auth may have expired. Update TWITTER_AUTH_TOKEN in .env');
      }

      return { success: false, reason: err.message };
    }
  }

  // ── Post tweet from file path (convenience) ───────────────
  async postWithImageFile(text, imagePath) {
    if (imagePath && fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      return this.post(text, buffer);
    }
    return this.post(text, null);
  }
}

// ─────────────────────────────────────────────────────────────
//  Singleton instance
// ─────────────────────────────────────────────────────────────
const poster = new TwitterPoster();

module.exports = { poster, TwitterPoster };
