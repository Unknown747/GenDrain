# Draino

Script Node.js untuk mengecek saldo dompet Ethereum yang digenerate secara acak di **Sepolia Testnet**.

## Cara Menjalankan

```bash
node index.js
# atau
npm start
```

## Konfigurasi (`config.json`)

| Key | Default | Keterangan |
|-----|---------|------------|
| `destinationAddress` | — | Alamat Sepolia tujuan transfer (**wajib diisi**) |
| `providerURL` | Array Sepolia RPC | Bisa string tunggal atau array (fallback otomatis) |
| `concurrency` | 20 | Jumlah worker paralel |
| `gasLimit` | 21000 | Gas limit per transaksi |
| `retryLimit` | 3 | Retry per wallet jika RPC error |
| `retryDelay` | 500 | Delay antar retry (ms) |
| `statsInterval` | 2000 | Interval update live stats (ms) |

### Contoh config dengan multi-RPC (fallback otomatis):
```json
{
  "destinationAddress": "0xAlamatKamu",
  "providerURL": [
    "https://rpc.sepolia.org",
    "https://ethereum-sepolia-rpc.publicnode.com"
  ],
  "concurrency": 20
}
```

## Output / Log

Semua log tersimpan otomatis di `./logs/`:

| File | Isi |
|------|-----|
| `*-history.txt` | Semua percobaan |
| `*-successes.txt` | Wallet yang berhasil ditemukan |
| `*-wallets-found.json` | Detail wallet (alamat, private key, saldo, timestamp) |

## Struktur Proyek

```
.
├── index.js             # Entry point utama (jalankan ini)
├── config.json          # Konfigurasi utama
├── package.json
├── src/
│   ├── index.js         # Startup & banner
│   ├── drain.js         # Logika Drainer (workers, retry, stats)
│   └── utils/
│       ├── config.js    # Baca & validasi config.json
│       └── logger.js    # Live stats + file logging
└── logs/                # Output log (auto-dibuat)
```

## Teknologi

- **Runtime**: Node.js
- **Library**: ethers.js v5
- **Network**: Sepolia Testnet
- **Pattern**: Multi-worker async paralel + RPC fallback + retry logic
