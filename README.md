# ASD Pipe & Sampling Calculator — NFPA 72 Designer

Aplikasi perhitungan **Aspirating Smoke Detection (ASD)** sesuai NFPA 72 Chapter 17:
menentukan jumlah & posisi lubang sampling, panjang pipa, ukuran orifice, waktu
transport asap, dan keseimbangan hidraulik — lengkap dengan visualisasi ruangan
3D, denah pipa 2D, matriks kepatuhan, daftar material (BoQ), dan ekspor laporan
teknis PDF.

## Fitur utama

- **Model ruang 3D (Three.js)** — ruangan, plafon, rak server, jaringan pipa,
  pipa kapiler turun, cakram jangkauan, unit ASD di dinding, dan partikel aliran
  udara yang bergerak ke arah detektor. Bisa diputar, di-zoom, digeser; arahkan
  kursor ke titik sampling untuk melihat tekanan hisap, laju aliran, dan
  diameter orifice. Preset kamera Isometrik / Atas / Depan / Samping dan toggle
  per layer.
- **Denah pipa 2D** — gambar teknis SVG dengan dimensi, penomoran lubang, ukuran
  orifice, dan radius jangkauan NFPA 72.
- **Dual mode (gelap/terang)** — seluruh UI, denah 2D, dan scene 3D memakai satu
  set design token, jadi keduanya ganti serempak. Preferensi disimpan di
  `localStorage`. Default: gelap.
- **Dual bahasa (Indonesia/English)** — semua label, opsi, tabel, notifikasi,
  hasil kalkulator, dan laporan PDF ikut diterjemahkan, termasuk format angka
  dan tanggal per lokal. Default: Indonesia.
- **Manajemen proyek & skenario** — banyak proyek, revisi skenario, status
  draft/review/approved/as-built, log aktivitas, dan sinkronisasi real-time
  antar klien lewat WebSocket.
- **Ekspor PDF 2 halaman** — ringkasan proyek, KPI, matriks kepatuhan NFPA 72,
  snapshot model 3D + denah 2D, BoQ, dan blok tanda tangan.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Three.js · Express + `ws` ·
jsPDF · lucide-react

## Menjalankan secara lokal

Prasyarat: Node.js 20+ (atau Bun).

```bash
bun install          # atau: npm install
bun run dev          # server + Vite di http://localhost:3000
```

Perintah lain:

```bash
bun run lint         # typecheck (tsc --noEmit)
bun run build        # build client (dist/) + server (dist/server.cjs)
NODE_ENV=production bun run start   # jalankan hasil build
```

## Environment variables

Salin `.env.example` menjadi `.env.local` lalu isi nilainya. Jangan pernah
menaruh nilai asli di file yang ikut ter-commit — `.gitignore` sudah memblokir
semua `.env*` kecuali `.env.example`.

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `GEMINI_API_KEY` | Tidak | Key Gemini API. Hanya dipakai kalau fitur AI diaktifkan; aplikasi berjalan penuh tanpa key ini. |
| `APP_URL` | Tidak | URL publik tempat aplikasi di-host, untuk link self-referential. Di AI Studio / Cloud Run diisi otomatis. |

Untuk deployment, masukkan variable lewat dashboard hosting (mis. Vercel →
Settings → Environment Variables), bukan lewat file di repo, dan redeploy
setelah mengubahnya.

## Penyimpanan data

Data proyek, skenario, dan log aktivitas disimpan server di
`data/asd_database.json`. File ini **tidak ikut di-commit** — `server.ts` akan
membuat dan mengisinya dengan data contoh saat pertama kali dijalankan. Karena
persistensinya berbasis file, deployment butuh runtime Node yang punya disk
tulis (bukan static hosting murni).

## Struktur

```
src/
  components/      Room3DView (Three.js), FloorPlanCanvas (SVG), tab & modal
  context/         ThemeContext (gelap/terang), I18nContext (ID/EN)
  i18n/            translations.ts (kamus ID/EN), labels.ts (enum → key)
  utils/           nfpa72Calculator.ts, pdfGenerator.ts
  types.ts         Tipe domain ASD
server.ts          Express REST API + WebSocket + Vite middleware
```

Hasil kalkulator membawa *translation key*, bukan kalimat jadi, sehingga satu
objek hasil bisa ditampilkan dalam bahasa apa pun tanpa dihitung ulang.
