'use strict';

const fs = require('fs');
const path = require('path');

const logsDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const date = new Date().toISOString().replace(/[:.]/g, '-');
const historyFile  = path.join(logsDir, `${date}-history.txt`);
const successFile  = path.join(logsDir, `${date}-successes.txt`);
const walletFile   = path.join(logsDir, `${date}-wallets-found.json`);

function append(file, text) {
  try {
    fs.appendFileSync(file, text + '\n');
  } catch (err) {
    console.error('[Logger Error]', err.message);
  }
}

function logHistory(text) {
  append(historyFile, text);
}

function logSuccess(text) {
  console.log('[SUCCESS]', text);
  append(successFile, text);
}

function saveWallet(data) {
  append(walletFile, JSON.stringify(data));
  console.log('[WALLET SAVED]', data.address, '|', data.balance, 'ETH');
}

module.exports = { logHistory, logSuccess, saveWallet };
