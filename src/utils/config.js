'use strict';

const fs         = require('fs');
const path       = require('path');
const { ethers } = require('ethers');

// ── Baca config.json ─────────────────────────────────────────────────────────
const configPath = path.resolve(__dirname, '../../config.json');
let raw;
try {
  raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  throw new Error(`Gagal membaca config.json: ${err.message}`);
}

function fail(field, pesan) {
  throw new Error(`\n[config.json] "${field}": ${pesan}\n`);
}

// ── Default untuk semua field opsional ───────────────────────────────────────
const DEFAULTS = {
  concurrency:   20,
  gasLimit:      21000,
  retryLimit:    3,
  retryDelay:    500,
  statsInterval: 2000,
  maxAttempts:   0,
};

// ── Validasi: destinationAddress (WAJIB) ─────────────────────────────────────
const dest = raw.destinationAddress;
if (!dest || dest.trim() === '' || dest.startsWith('ISI_')) {
  fail('destinationAddress', 'Belum diisi. Masukkan alamat ETH tujuan kamu.');
}
if (!ethers.utils.isAddress(dest)) {
  fail('destinationAddress', `Bukan alamat Ethereum yang valid → "${dest}"`);
}

// ── Validasi: providerURL (WAJIB) ────────────────────────────────────────────
const rawUrl = raw.providerURL;
if (!rawUrl || (typeof rawUrl === 'string' && rawUrl.trim() === '') || rawUrl.startsWith('ISI_')) {
  fail('providerURL', 'Belum diisi. Masukkan URL RPC Sepolia kamu.');
}
if (Array.isArray(rawUrl) && rawUrl.length === 0) {
  fail('providerURL', 'Tidak boleh array kosong.');
}
const urls = Array.isArray(rawUrl) ? rawUrl : [rawUrl];
urls.forEach((url, i) => {
  const label = urls.length > 1 ? `providerURL[${i}]` : 'providerURL';
  if (typeof url !== 'string' || !url.startsWith('http')) {
    fail(label, `Bukan URL yang valid → "${url}"`);
  }
});

// ── Validasi & terapkan default untuk field angka ────────────────────────────
function resolveInt(key) {
  const val = raw[key];
  if (val === undefined || val === null) return DEFAULTS[key];
  if (!Number.isInteger(val) || val < 0) {
    fail(key, `Harus bilangan bulat >= 0, diterima: ${val}`);
  }
  return val;
}

const concurrency   = resolveInt('concurrency');
const gasLimit      = resolveInt('gasLimit');
const retryLimit    = resolveInt('retryLimit');
const retryDelay    = resolveInt('retryDelay');
const statsInterval = resolveInt('statsInterval');
const maxAttempts   = resolveInt('maxAttempts');

if (concurrency === 0) fail('concurrency', 'Tidak boleh 0.');
if (gasLimit    === 0) fail('gasLimit',    'Tidak boleh 0.');

// ── Validasi: telegram (opsional, tapi harus sepasang) ───────────────────────
const tg = raw.telegram || {};
const tgToken  = tg.token  || '';
const tgChatId = tg.chatId || '';
if (tgToken && !tgChatId) fail('telegram.chatId', 'Wajib diisi jika "telegram.token" sudah diset.');
if (tgChatId && !tgToken) fail('telegram.token',  'Wajib diisi jika "telegram.chatId" sudah diset.');

// ── Export config final yang sudah bersih ────────────────────────────────────
module.exports = {
  destinationAddress: dest,
  providerURL:        urls.length === 1 ? urls[0] : urls,
  concurrency,
  gasLimit,
  retryLimit,
  retryDelay,
  statsInterval,
  maxAttempts,
  telegram: { token: tgToken, chatId: tgChatId },
};
