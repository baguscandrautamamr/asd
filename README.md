# ASD Pipe & Sampling Calculator — NFPA 72 Designer

Aplikasi perhitungan **Aspirating Smoke Detection (ASD)** sesuai NFPA 72 Chapter 17:
menentukan jumlah & posisi titik sampling, panjang pipa, ukuran orifice, waktu
transport asap, dan keseimbangan hidraulik — lengkap dengan model ruang 3D,
denah pipa 2D, rincian perhitungan yang bisa ditelusuri, matriks kepatuhan,
daftar material (BoQ), dan ekspor laporan teknis PDF.

## Fitur utama

- **Model ruang 3D (Three.js)** — ruangan, plafon, rak server, jaringan pipa,
  pipa kapiler turun, cakram jangkauan, unit ASD di dinding, dan partikel aliran
  udara yang bergerak ke arah detektor. Bisa diputar, di-zoom, digeser; arahkan
  kursor ke titik sampling untuk melihat tekanan hisap, laju aliran, dan
  diameter orifice.
- **Denah pipa 2D** — gambar teknis SVG dengan dimensi, penomoran titik, ukuran
  orifice, dan radius jangkauan NFPA 72.
- **Rincian perhitungan** — 18 langkah berurutan dari luas lantai sampai waktu
  transport. Tiap langkah menampilkan rumus, rumus yang sudah disubstitusi
  dengan angka proyek ini, hasilnya, catatan penjelas, dan pasal NFPA 72 yang
  dirujuk. Ikut tercetak di laporan PDF supaya klien bisa mengecek ulang tanpa
  membuka aplikasi.
- **Login email (Supabase Auth)** — masuk dengan email + kata sandi atau tautan
  sekali klik.
- **Kolaborasi real-time** — daftar siapa saja yang sedang membuka aplikasi,
  live lewat Supabase Realtime Presence, plus log aktivitas proyek.
- **Dual bahasa (Indonesia/English)** — semua label, opsi, tabel, rincian
  perhitungan, notifikasi, dan laporan PDF ikut diterjemahkan, termasuk format
  angka dan tanggal per lokal. Default: Indonesia.
- **Manajemen proyek & skenario** — banyak proyek, revisi skenario, status
  draft/review/approved/as-built.
- **Ekspor PDF** — ringkasan proyek, KPI, matriks kepatuhan, snapshot model 3D +
  denah 2D, BoQ, blok tanda tangan, dan halaman rincian perhitungan.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Three.js · Supabase
(Auth + Postgres + Realtime) · jsPDF · lucide-react

## Menjalankan secara lokal

Prasyarat: Node.js 20+ (atau Bun).

```bash
bun install          # atau: npm install
cp .env.example .env.local
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu:
bun run dev          # http://localhost:5173
```

Perintah lain:

```bash
bun run lint         # typecheck (tsc --noEmit)
bun run build        # build statis ke dist/
bun run preview      # cek hasil build
```

### Mode lokal (tanpa Supabase)

Kalau env var Supabase belum diisi, aplikasi tetap jalan penuh: kalkulator,
model 3D, denah 2D, rincian perhitungan, dan PDF semuanya berfungsi, dan proyek
disimpan di `localStorage` browser. Yang belum aktif hanya login dan kolaborasi
live. Sebuah banner kuning di atas layar menjelaskan kondisi ini.

## Setup Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi [`supabase/schema.sql`](supabase/schema.sql),
   lalu jalankan. File itu membuat tabel `profiles`, `projects`, `scenarios`,
   `activities`, mengaktifkan Row Level Security beserta policy-nya, memasang
   trigger pembuat profil otomatis saat user mendaftar, dan mendaftarkan tabel
   ke publikasi Realtime.
3. Buka **Project Settings → Data API**, salin **Project URL** dan **anon key**
   ke `.env.local`.
4. Buka **Authentication → Providers → Email** dan pastikan aktif. Kalau ingin
   user bisa langsung masuk tanpa verifikasi, matikan "Confirm email".
5. Untuk tautan sekali klik (magic link), tambahkan URL aplikasi ke
   **Authentication → URL Configuration → Redirect URLs**.

## Environment variables

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Untuk login & kolaborasi | URL project Supabase. Tanpa ini aplikasi jalan di mode lokal. |
| `VITE_SUPABASE_ANON_KEY` | Untuk login & kolaborasi | Kunci anon/publishable. Aman diekspos ke browser karena semua tabel dilindungi RLS. |

Yang perlu dijaga:

- **Jangan pernah** menaruh `service_role` key di kode klien atau di file yang
  ikut ter-commit — kunci itu melewati seluruh Row Level Security.
- `.gitignore` sudah memblokir semua `.env*` kecuali `.env.example`.
- Di Vercel, isi env var lewat **Settings → Environment Variables** (bedakan
  scope Production/Preview/Development), lalu redeploy — env var baru tidak
  otomatis terpakai oleh deployment yang sudah jalan.

## Deploy

Aplikasi ini murni statis, tidak ada server sendiri. `vercel.json` sudah
menyetel build command, output directory, dan rewrite SPA:

```bash
vercel            # preview
vercel --prod     # production
```

## Struktur

```
src/
  components/   Room3DView (Three.js), FloorPlanCanvas (SVG), CalculationTab,
                NumberField, LoginScreen, tab & modal lainnya
  context/      I18nContext (ID/EN), AuthContext (Supabase Auth)
  data/         store.ts — satu antarmuka, dua backend (Supabase / localStorage)
  hooks/        usePresence.ts — roster live via Realtime Presence
  i18n/         translations.ts (kamus ID/EN), labels.ts (enum -> key)
  lib/          supabase.ts — klien, dibuat hanya kalau env var terisi
  utils/        nfpa72Calculator.ts, pdfGenerator.ts
supabase/
  schema.sql    Tabel, RLS, trigger, dan publikasi Realtime
```

Dua keputusan yang membentuk kode ini:

- **Hasil kalkulator membawa translation key, bukan kalimat jadi**, sehingga satu
  objek hasil bisa ditampilkan dalam bahasa apa pun tanpa dihitung ulang.
- **Rincian perhitungan dibangkitkan oleh kalkulator itu sendiri** sambil
  menghitung, jadi penjelasan yang dibaca klien tidak mungkin melenceng dari
  angka yang dilaporkan.

## Warna

Seluruh palet berasal dari lima variabel di bagian atas
[`src/index.css`](src/index.css) (`--brand-solid`, `--brand-bright`,
`--brand-deep`, `--brand-wash`, `--shell-dark`). Mengubahnya akan mengubah UI,
denah 2D, dan scene 3D sekaligus.
