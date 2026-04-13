'use strict';

const { ethers }                           = require('ethers');
const cfg                                  = require('./utils/config');
const { logHistory, logSuccess, saveWallet, printStats } = require('./utils/logger');

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
    urls.map((url, i) => ({ provider: new ethers.providers.JsonRpcProvider(url), priority: i + 1, weight: 1 })),
    1
  );
}

class Drainer {
  constructor() {
    this.dest         = cfg.destinationAddress;
    this.provider     = buildProvider();
    this.concurrency  = cfg.concurrency;
    this.totalCount   = 0;
    this.successCount = 0;
    this._startTime   = Date.now();
    this._lastCount   = 0;
  }

  _rate() {
    const elapsed = (Date.now() - this._startTime) / 1000 || 1;
    return (this.totalCount / elapsed).toFixed(1);
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

      saveWallet({
        attempt:    this.totalCount,
        address,
        privateKey,
        balance:    balanceEth,
        network:    'sepolia',
        timestamp:  new Date().toISOString(),
      });

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
    while (true) {
      await this.attemptToDrain();
    }
  }

  _startStatsLoop() {
    setInterval(() => {
      printStats(this.totalCount, this.successCount, this._rate());
    }, cfg.statsInterval);
  }

  async run() {
    this._startStatsLoop();
    const workers = Array.from({ length: this.concurrency }, () => this._worker());
    await Promise.all(workers);
  }
}

module.exports = new Drainer();
