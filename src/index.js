'use strict';

const drainer = require('./drain');

console.log('=== Draino ===');
console.log('Network : Sepolia Testnet');
console.log('Log     : ./logs/');
console.log('Config  : config.json');
console.log('==============');

drainer.run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
