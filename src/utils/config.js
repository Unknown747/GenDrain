'use strict';

const fs         = require('fs');
const path       = require('path');
const { ethers } = require('ethers');

const configPath = path.resolve(__dirname, '../../config.json');

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  throw new Error(`Gagal membaca config.json: ${err.message}`);
}

function fail(msg) {
  throw new Error(`\n[config.json] ${msg}\n`);
}

// ── 1. destinationAddress (WAJIB) ────────────────────────────────────────────
if (!cfg.destinationAddress || cfg.destinationAddress.trim() === '') {
  fail('"destinationAddress" belum diisi.\nContoh: "destinationAddress": "0xAbc123..."');
}
if (!ethers.utils.isAddress(cfg.destinationAddress)) {
  fail(`"destinationAddress" bukan alamat Ethereum yang valid.\nDiterima: "${cfg.destinationAddress}"`);
}

// ── 2. providerURL (WAJIB) ───────────────────────────────────────────────────
if (!cfg.providerURL || (Array.isArray(cfg.providerURL) && cfg.providerURL.length === 0)) {
  fail('"providerURL" belum diisi.\nContoh: "providerURL": "https://rpc.sepolia.org"');
}
const urls = Array.isArray(cfg.providerURL) ? cfg.providerURL : [cfg.providerURL];
urls.forEach((url, i) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    fail(`"providerURL${urls.length > 1 ? `[${i}]` : ''}" bukan URL yang valid.\nDiterima: "${url}"`);
  }
});

// ── Semua setting lain pakai default otomatis ────────────────────────────────
cfg.concurrency   = Number.isInteger(cfg.concurrency)   && cfg.concurrency   > 0 ? cfg.concurrency   : 20;
cfg.gasLimit      = Number.isInteger(cfg.gasLimit)      && cfg.gasLimit      > 0 ? cfg.gasLimit      : 21000;
cfg.retryLimit    = Number.isInteger(cfg.retryLimit)    && cfg.retryLimit    > 0 ? cfg.retryLimit    : 3;
cfg.retryDelay    = Number.isInteger(cfg.retryDelay)    && cfg.retryDelay    >= 0 ? cfg.retryDelay   : 500;
cfg.statsInterval = Number.isInteger(cfg.statsInterval) && cfg.statsInterval > 0 ? cfg.statsInterval : 2000;
cfg.maxAttempts   = Number.isInteger(cfg.maxAttempts)   && cfg.maxAttempts   >= 0 ? cfg.maxAttempts  : 0;
cfg.telegram      = (cfg.telegram && cfg.telegram.token && cfg.telegram.chatId) ? cfg.telegram : { token: '', chatId: '' };

module.exports = cfg;
