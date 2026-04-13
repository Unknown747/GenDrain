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
| `providerURL` | Array Sepolia RPC | String atau array URL (fallback otomatis) |
| `concurrency` | 20 | Jumlah worker paralel |
| `gasLimit` | 21000 | Gas limit per transaksi |
| `retryLimit` | 3 | Retry jika RPC error |
| `retryDelay` | 500 | Delay antar retry (ms) |
| `statsInterval` | 2000 | Interval update stats & auto-save (ms) |
| `maxAttempts` | 0 | Batas attempt (0 = tanpa batas) |
| `telegram.token` | — | Token bot Telegram (opsional) |
| `telegram.chatId` | — | Chat ID Telegram (opsional) |

## Output / Log (`./logs/`)

| File | Isi |
|------|-----|
| `*-history.txt` | Semua percobaan |
| `*-successes.txt` | TX sukses |
| `*-wallets-found.json` | Detail wallet ditemukan |
| `stats.json` | Stats live (auto-update) |
| `session.json` | State sesi (untuk resume) |

## Fitur

- **Multi-worker paralel** — 20 worker jalan bersamaan
- **RPC Fallback** — otomatis ganti RPC jika yang pertama gagal
- **Retry logic** — coba ulang hingga 3x jika RPC error
- **Live stats** — attempt, found, speed, uptime di terminal
- **Auto stats export** — `logs/stats.json` update tiap 2 detik
- **Resume session** — lanjut dari attempt terakhir jika dihentikan (CTRL+C)
- **Telegram notifikasi** — kirim notif saat wallet ditemukan & TX terkirim
- **maxAttempts** — berhenti otomatis setelah X attempt

## Struktur Proyek

```
.
├── index.js                   # Entry point utama
├── config.json                # Konfigurasi
├── package.json
├── src/
│   ├── index.js               # Banner & startup
│   ├── drain.js               # Core Drainer
│   └── utils/
│       ├── config.js          # Baca & validasi config.json
│       ├── logger.js          # Logging + stats + session
│       └── telegram.js        # Notifikasi Telegram
└── logs/                      # Output log (auto-dibuat)
```

## Teknologi

- **Runtime**: Node.js
- **Library**: ethers.js v5
- **Network**: Sepolia Testnet
