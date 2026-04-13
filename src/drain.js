'use strict';

const { ethers }  = require('ethers');
const cfg         = require('./utils/config');
const tg          = require('./utils/telegram');
const {
  logHistory, logSuccess, saveWallet,
  saveStats, saveSession, loadSession,
  printStats,
} = require('./utils/logger');

const ZERO      = ethers.constants.Zero;
const GAS_LIMIT = cfg.gasLimit;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildProvider() {
  const urls = Array.isArray(cfg.providerURL) ? cfg.providerURL : [cfg.providerURL];
  if (urls.length === 1) {
    return new ethers.providers.JsonRpcProvider(urls[0]);
  }
  return new ethers.providers.FallbackProvider(
    urls.map((url, i) => ({
      provider: new ethers.providers.JsonRpcProvider(url),
      priority: i + 1,
      weight:   1,
    })),
    1
  );
}

class Drainer {
  constructor() {
    this.dest        = cfg.destinationAddress;
    this.provider    = buildProvider();
    this.concurrency = cfg.concurrency;
    this.maxAttempts = cfg.maxAttempts;
    this._stopped    = false;
    this._startTime  = Date.now();

    const session     = loadSession();
    this.totalCount   = session ? session.totalCount   : 0;
    this.successCount = session ? session.successCount : 0;

    if (session) {
      process.stdout.write(`\x1b[33m[Resume] Melanjutkan dari attempt #${this.totalCount}\x1b[0m\n`);
    }
  }

  _elapsed() {
    return Date.now() - this._startTime;
  }

  _rate() {
    const secs = this._elapsed() / 1000 || 1;
    return (this.totalCount / secs).toFixed(1);
  }

  _snapshot() {
    return {
      totalCount:   this.totalCount,
      successCount: this.successCount,
      ratePerSec:   this._rate(),
      uptimeMs:     this._elapsed(),
      timestamp:    new Date().toISOString(),
    };
  }

  stop() {
    this._stopped = true;
    const snap = this._snapshot();
    saveSession({ totalCount: this.totalCount, successCount: this.successCount });
    saveStats(snap);
    tg.notifyStopped(this.totalCount, this.successCount);
  }

  async _getBalanceWithRetry(wallet) {
    for (let i = 0; i < cfg.retryLimit; i++) {
      try {
        return await wallet.getBalance();
      } catch {
        if (i < cfg.retryLimit - 1) await sleep(cfg.retryDelay * (i + 1));
      }
    }
    return null;
  }

  async attemptToDrain() {
    if (this._stopped) return;
    if (this.maxAttempts > 0 && this.totalCount >= this.maxAttempts) {
      this._stopped = true;
      process.stdout.write(`\n\x1b[33m[Draino] maxAttempts (${this.maxAttempts}) tercapai. Berhenti.\x1b[0m\n`);
      this.stop();
      process.exit(0);
    }

    const wallet     = ethers.Wallet.createRandom().connect(this.provider);
    const address    = wallet.address;
    const privateKey = wallet.privateKey;

    const balance = await this._getBalanceWithRetry(wallet);
    if (balance === null) return;

    const balanceEth = ethers.utils.formatEther(balance);
    this.totalCount++;

    logHistory(`${this.totalCount} | ${address} | ${balanceEth} ETH`);

    if (balance.gt(ZERO)) {
      this.successCount++;

      const walletData = {
        attempt:    this.totalCount,
        address,
        privateKey,
        balance:    balanceEth,
        network:    'sepolia',
        timestamp:  new Date().toISOString(),
      };

      saveWallet(walletData);
      tg.notifyWalletFound(walletData);
      logSuccess(`Wallet #${this.successCount} | ${address} | ${balanceEth} ETH`);

      try {
        const gasPrice = await this.provider.getGasPrice();
        const gasCost  = gasPrice.mul(GAS_LIMIT);
        const netValue = balance.sub(gasCost);

        if (netValue.gt(ZERO)) {
          const tx = await wallet.sendTransaction({
            to:       this.dest,
            value:    netValue,
            gasLimit: GAS_LIMIT,
            gasPrice,
          });
          logSuccess(`TX Hash: ${tx.hash}`);
          tg.notifyTxSent(tx.hash);
          await tx.wait(1);
          logSuccess(`TX Confirmed: ${tx.hash}`);
        } else {
          logSuccess(`Saldo tidak cukup untuk gas — wallet disimpan, TX dilewati.`);
        }
      } catch (err) {
        logSuccess(`TX gagal: ${err.message}`);
      }
    }
  }

  async _worker() {
    while (!this._stopped) {
      await this.attemptToDrain();
    }
  }

  _startStatsLoop() {
    setInterval(() => {
      if (this._stopped) return;
      const snap = this._snapshot();
      printStats(snap.totalCount, snap.successCount, snap.ratePerSec, snap.uptimeMs);
      saveStats(snap);
      saveSession({ totalCount: this.totalCount, successCount: this.successCount });
    }, cfg.statsInterval);
  }

  async run() {
    tg.notifyStarted(this.concurrency);
    this._startStatsLoop();
    const workers = Array.from({ length: this.concurrency }, () => this._worker());
    await Promise.all(workers);
  }
}

module.exports = new Drainer();
