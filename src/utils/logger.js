'use strict';

const fs   = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const sessionDate = new Date().toISOString().replace(/[:.]/g, '-');
const historyFile = path.join(logsDir, `${sessionDate}-history.txt`);
const successFile = path.join(logsDir, `${sessionDate}-successes.txt`);
const walletFile  = path.join(logsDir, `${sessionDate}-wallets-found.json`);

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
  append(walletFile, JSON.stringify(data, null, 2) + ',');
  process.stdout.write(`\r\x1b[K\x1b[33m[WALLET FOUND] ${data.address} | ${data.balance} ETH\x1b[0m\n`);
}

function printStats(total, found, ratePerSec) {
  const bar   = '█'.repeat(Math.min(20, Math.floor(ratePerSec)));
  const line  = `\r\x1b[K[Draino] Attempt: \x1b[36m${total}\x1b[0m | Found: \x1b[33m${found}\x1b[0m | Speed: \x1b[32m${ratePerSec}/s\x1b[0m ${bar}`;
  process.stdout.write(line);
}

module.exports = { logHistory, logSuccess, saveWallet, printStats };
