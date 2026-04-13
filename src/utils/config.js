'use strict';

const fs      = require('fs');
const path    = require('path');
const { ethers } = require('ethers');

const configPath = path.resolve(__dirname, '../../config.json');

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  throw new Error(`Gagal membaca config.json: ${err.message}`);
}

function fail(msg) {
  throw new Error(`[config.json] ${msg}`);
}

// ── destinationAddress ──────────────────────────────────────────────────────
if (!cfg.destinationAddress || typeof cfg.destinationAddress !== 'string') {
  fail('"destinationAddress" wajib diisi (string).');
}
if (cfg.destinationAddress.startsWith('0xYOUR')) {
  fail('"destinationAddress" masih berupa placeholder. Isi dengan alamat Ethereum kamu.');
}
if (!ethers.utils.isAddress(cfg.destinationAddress)) {
  fail(`"destinationAddress" bukan alamat Ethereum yang valid: ${cfg.destinationAddress}`);
}

// ── providerURL ─────────────────────────────────────────────────────────────
if (!cfg.providerURL) {
  fail('"providerURL" wajib diisi (string atau array of string).');
}
const urls = Array.isArray(cfg.providerURL) ? cfg.providerURL : [cfg.providerURL];
if (urls.length === 0) {
  fail('"providerURL" tidak boleh array kosong.');
}
urls.forEach((url, i) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    fail(`"providerURL[${i}]" bukan URL yang valid: ${url}`);
  }
});

// ── angka opsional ───────────────────────────────────────────────────────────
function posInt(key, def) {
  const val = cfg[key];
  if (val === undefined || val === null) return def;
  if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
    fail(`"${key}" harus bilangan bulat positif, diterima: ${val}`);
  }
  return val;
}

cfg.concurrency   = posInt('concurrency',   20);
cfg.gasLimit      = posInt('gasLimit',       21000);
cfg.retryLimit    = posInt('retryLimit',     3);
cfg.retryDelay    = posInt('retryDelay',     500);
cfg.statsInterval = posInt('statsInterval', 2000);
cfg.maxAttempts   = posInt('maxAttempts',   0);

if (cfg.concurrency === 0) fail('"concurrency" tidak boleh 0.');
if (cfg.gasLimit    === 0) fail('"gasLimit" tidak boleh 0.');

// ── telegram (opsional) ──────────────────────────────────────────────────────
cfg.telegram = cfg.telegram || {};
if (cfg.telegram.token && !cfg.telegram.chatId) {
  fail('"telegram.chatId" wajib diisi jika "telegram.token" sudah diset.');
}
if (cfg.telegram.chatId && !cfg.telegram.token) {
  fail('"telegram.token" wajib diisi jika "telegram.chatId" sudah diset.');
}

module.exports = cfg;
