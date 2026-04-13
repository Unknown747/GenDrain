'use strict';

const fs   = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const sessionDate = new Date().toISOString().replace(/[:.]/g, '-');
const historyFile = path.join(logsDir, `${sessionDate}-history.txt`);
const successFile = path.join(logsDir, `${sessionDate}-successes.txt`);
const walletFile  = path.join(logsDir, `${sessionDate}-wallets-found.json`);
const statsFile   = path.join(logsDir, 'stats.json');
const sessionFile = path.join(logsDir, 'session.json');

function append(file, text) {
  try {
    fs.appendFileSync(file, text + '\n');
  } catch (err) {
    process.stderr.write(`[Logger Error] ${err.message}\n`);
  }
}

function logHistory(text) {
  append(historyFile, text);
}

function logSuccess(text) {
  process.stdout.write(`\r\x1b[K\x1b[32m[SUCCESS] ${text}\x1b[0m\n`);
  append(successFile, `[${new Date().toISOString()}] ${text}`);
}

function saveWallet(data) {
  append(walletFile, JSON.stringify(data) + ',');
  process.stdout.write(`\r\x1b[K\x1b[33m[WALLET FOUND] ${data.address} | ${data.balance} ETH\x1b[0m\n`);
}

function saveStats(stats) {
  try {
    fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
  } catch {}
}

function saveSession(data) {
  try {
    fs.writeFileSync(sessionFile, JSON.stringify(data));
  } catch {}
}

function loadSession() {
  try {
    if (fs.existsSync(sessionFile)) {
      return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    }
  } catch {}
  return null;
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function printStats(total, found, ratePerSec, elapsedMs) {
  const bar     = '█'.repeat(Math.min(15, Math.floor(Number(ratePerSec))));
  const elapsed = formatElapsed(elapsedMs);
  const line    =
    `\r\x1b[K` +
    `[Draino] ` +
    `Attempt: \x1b[36m${total}\x1b[0m | ` +
    `Found: \x1b[33m${found}\x1b[0m | ` +
    `Speed: \x1b[32m${ratePerSec}/s\x1b[0m | ` +
    `Uptime: \x1b[35m${elapsed}\x1b[0m ` +
    `\x1b[32m${bar}\x1b[0m`;
  process.stdout.write(line);
}

module.exports = {
  logHistory, logSuccess, saveWallet,
  saveStats, saveSession, loadSession,
  printStats,
};
