'use strict';

const fs = require('fs');
const path = require('path');

const configPath = path.resolve(__dirname, '../../config.json');

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (err) {
  throw new Error(`Gagal membaca config.json: ${err.message}`);
}

const required = ['destinationAddress', 'providerURL'];
for (const key of required) {
  if (!cfg[key] || cfg[key].startsWith('0xYOUR')) {
    throw new Error(`config.json: "${key}" belum diisi dengan benar.`);
  }
}

module.exports = cfg;
