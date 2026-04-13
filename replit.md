# Draino

Script Node.js untuk mengecek saldo dompet Ethereum yang digenerate secara acak di **Sepolia Testnet**.

## Konfigurasi

Edit file `config.json` sebelum menjalankan:

```json
{
  "destinationAddress": "0xAlamatTujuanKamu",
  "providerURL": "https://rpc.sepolia.org",
  "concurrency": 10,
  "gasLimit": 21000
}
```

| Key | Keterangan |
|-----|------------|
| `destinationAddress` | Alamat Sepolia tujuan transfer |
| `providerURL` | RPC endpoint Sepolia |
| `concurrency` | Jumlah worker paralel |
| `gasLimit` | Gas limit per transaksi |

## Menjalankan

```bash
npm start
```

## Output / Log

Semua log tersimpan di folder `./logs/`:
- `*-history.txt` — semua percobaan
- `*-successes.txt` — wallet yang berhasil ditemukan
- `*-wallets-found.json` — detail wallet (alamat + private key + saldo)

## Struktur Proyek

```
.
├── config.json          # Konfigurasi utama
├── package.json
├── src/
│   ├── index.js         # Entry point
│   ├── drain.js         # Logika utama Drainer
│   └── utils/
│       ├── config.js    # Baca config.json
│       └── logger.js    # Sistem logging
└── logs/                # Output log (auto-dibuat)
```

## Teknologi

- **Runtime**: Node.js
- **Library**: ethers.js v5
- **Network**: Sepolia Testnet
