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
  throw new Error(
    `\n[Draino] Gagal membaca config.json: ${err.message}\n` +
    `Pastikan file config.json ada di root folder.\n`
  );
}

// ── Helper error ─────────────────────────────────────────────────────────────
function fail(field, pesan) {
  throw new Error(`\n[config.json → "${field}"] ${pesan}\n`);
}

// Cek apakah string masih placeholder / belum diisi
function isPlaceholder(str) {
  if (typeof str !== 'string') return false;
  const v = str.trim();
  return (
    v === '' ||
    v.startsWith('ISI_') ||
    v.startsWith('0xYOUR') ||
    v.startsWith('MASUK') ||
    v.toUpperCase().includes('KAMU') ||
    v.toUpperCase().includes('YOUR')
  );
}

// ── 1. destinationAddress (WAJIB, harus string) ──────────────────────────────
if (!raw.destinationAddress || typeof raw.destinationAddress !== 'string') {
  fail('destinationAddress', 'Belum diisi!\n  Contoh: "destinationAddress": "0xAbCd1234..."');
}
if (isPlaceholder(raw.destinationAddress)) {
  fail('destinationAddress', 'Masih berupa placeholder!\n  Ganti dengan alamat ETH tujuan kamu.\n  Contoh: "destinationAddress": "0xAbCd1234..."');
}
if (!ethers.utils.isAddress(raw.destinationAddress)) {
  fail('destinationAddress', `Bukan alamat Ethereum yang valid.\n  Diterima : "${raw.destinationAddress}"\n  Contoh   : "0xAbCd1234...efGh5678"`);
}

// ── 2. providerURL (WAJIB, bisa string atau array) ───────────────────────────
if (!raw.providerURL) {
  fail('providerURL', 'Belum diisi!\n  Contoh: "providerURL": "https://rpc.sepolia.org"');
}
// Normalkan ke array
const rawUrls = Array.isArray(raw.providerURL) ? raw.providerURL : [raw.providerURL];
if (rawUrls.length === 0) {
  fail('providerURL', 'Tidak boleh array kosong.');
}
rawUrls.forEach((url, i) => {
  const label = rawUrls.length > 1 ? `providerURL[${i}]` : 'providerURL';
  if (typeof url !== 'string' || url.trim() === '') {
    fail(label, 'Belum diisi!');
  }
  if (isPlaceholder(url)) {
    fail(label, `Masih berupa placeholder → "${url}"`);
  }
  if (!url.startsWith('http')) {
    fail(label, `Bukan URL yang valid → "${url}"\n  Harus diawali dengan http:// atau https://`);
  }
});

// ── 3. Field angka — pakai default jika tidak diisi ──────────────────────────
const DEFAULTS = {
  concurrency:   20,
  gasLimit:      21000,
  retryLimit:    3,
  retryDelay:    500,
  statsInterval: 2000,
  maxAttempts:   0,
};

function resolveInt(key) {
  const val = raw[key];
  if (val === undefined || val === null) return DEFAULTS[key];
  if (!Number.isInteger(val) || val < 0) {
    fail(key, `Harus bilangan bulat >= 0. Diterima: ${JSON.stringify(val)}`);
  }
  return val;
}

const concurrency   = resolveInt('concurrency');
const gasLimit      = resolveInt('gasLimit');
const retryLimit    = resolveInt('retryLimit');
const retryDelay    = resolveInt('retryDelay');
const statsInterval = resolveInt('statsInterval');
const maxAttempts   = resolveInt('maxAttempts');

if (concurrency === 0) fail('concurrency', 'Tidak boleh 0. Minimal 1.');
if (gasLimit    === 0) fail('gasLimit',    'Tidak boleh 0. Gunakan minimal 21000.');

// ── 4. Telegram (opsional, harus sepasang) ───────────────────────────────────
const tg       = (typeof raw.telegram === 'object' && raw.telegram) ? raw.telegram : {};
const tgToken  = typeof tg.token  === 'string' ? tg.token.trim()  : '';
const tgChatId = typeof tg.chatId === 'string' ? tg.chatId.trim() : '';

if (tgToken  && !tgChatId) fail('telegram.chatId', 'Wajib diisi jika "token" sudah diset.');
if (tgChatId && !tgToken)  fail('telegram.token',  'Wajib diisi jika "chatId" sudah diset.');

// ── Export final ─────────────────────────────────────────────────────────────
module.exports = {
  destinationAddress: raw.destinationAddress.trim(),
  providerURL:        rawUrls.length === 1 ? rawUrls[0] : rawUrls,
  concurrency,
  gasLimit,
  retryLimit,
  retryDelay,
  statsInterval,
  maxAttempts,
  telegram: { token: tgToken, chatId: tgChatId },
};
