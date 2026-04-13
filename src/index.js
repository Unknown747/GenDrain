'use strict';

const cfg     = require('./utils/config');
const tg      = require('./utils/telegram');
const drainer = require('./drain');

process.stdout.write('\x1b[2J\x1b[H');
console.log('\x1b[36m╔══════════════════════════════════╗');
console.log('║           D R A I N O           ║');
console.log('╚══════════════════════════════════╝\x1b[0m');
console.log(`  Network    : \x1b[33mSepolia Testnet\x1b[0m`);
console.log(`  Workers    : \x1b[33m${cfg.concurrency}\x1b[0m`);
console.log(`  Dest       : \x1b[33m${cfg.destinationAddress}\x1b[0m`);
console.log(`  MaxAttempt : \x1b[33m${cfg.maxAttempts > 0 ? cfg.maxAttempts : 'Tanpa batas'}\x1b[0m`);
console.log(`  Telegram   : \x1b[33m${tg.enabled ? 'Aktif' : 'Nonaktif'}\x1b[0m`);
console.log(`  Logs       : \x1b[33m./logs/\x1b[0m`);
console.log('\x1b[36m══════════════════════════════════\x1b[0m\n');

process.on('SIGINT', () => {
  process.stdout.write('\n\n\x1b[31m[Draino] Dihentikan. Menyimpan sesi...\x1b[0m\n');
  drainer.stop();
  process.exit(0);
});

drainer.run().catch((err) => {
  console.error('\x1b[31m[Fatal]\x1b[0m', err.message);
  process.exit(1);
});
