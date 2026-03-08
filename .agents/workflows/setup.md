---
description: Kirim Karya Development Agent Rules
---

# Kirim Karya AI Development Rules

Aturan ini harus diikuti oleh setiap *AI Assistant* yang membantu me-maintain, merefactor, atau menulis kode baru untuk platform Kirim Karya (Gallery Management & Client Proofing SaaS). Panduan ini diturunkan langsung dari dokumen `design/high-level.md` dan `design/low-level.md`.

## 🏗️ 1. CORE ARCHITECTURE & TECH STACK
Gunakan stack ini dengan ketat. Jangan menawarkan *framework* atau bahasa alternatif:

- **Frontend:** SvelteKit (SSR & CSR).
- **Styling UI:** Tailwind CSS v4 beserta plugin komponen **daisyUI 5**.
  - Wajib mematuhi kelas komponen standar daisyUI terlebih dahulu (contoh: `btn px-10` diperbolehkan untuk kustomisasi, *fallback* dengan `!` sebagai upaya terakhir). Gunakan utilitas bawaan Tailwind v4 bila komponen daisyUI tidak tersedia.
- **Backend Server API:** Hono.js berjalan di Bun Runtime.
- **Background Worker:** Bun. Eksekusi tugas berat (*image processing*) di *background process* terpisah agar API Hono tidak terblokir.
- **Relational Database:** PostgreSQL.
- **Database ORM:** Drizzle ORM.
- **Authentication Framework:** Better Auth (Gunakan plugin *Drizzle Adapter*).
- **Caching & Message Queue:** Redis.
- **Storage:** S3 Compatible Object Storage (Cloudflare R2 atau AWS S3).
- **Image Processing Library:** `sharp` (dijalankan oleh Bun Worker).

## 🗄️ 2. DATABASE (Drizzle ORM & Postgres) GUIDELINES
Saat menulis skema database atau menyusun query `drizzle`:

- **Drizzle Wajib:** Dilarang me-return raw SQL text format, harus membungkus logic dengan instance `db.select()` dsb. 
- **Setup Better Auth:** Tabel `user`, `session`, `account`, dan `verification` DILARANG dibuat secara sepihak. Harus di-generate via Drizzle Adapter bawaan Better Auth. Jika ada *extension* skema seperti field `subscription_tier`, konfigurasikan via options Better Auth.
- **UUID v7 Pimary Keys:** Default seluruh tabel aplikasi (seperti `galleries`, `photos`, `feedbacks`) MUST diatur ke **UUID v7** (agar ID tersortir berdasarkan waktu dan collision resistant).
- **Multitenancy Isolation:** Pastikan seluruh end-point GET atau query (termasuk galeri dan foto) memiliki filter klausa `WHERE user_id = current_session.user_id` untuk mencegah *data leak* antar Studio.

## 🔒 3. AUTHENTICATION & SECURITY
Saat mengatur route keamanan dan otentikasi:

- **Metode Login Utama:** Harus difokuskan pada penggunaan plugin `socialProviders` untuk **Google Login / Register**. Dukungan login email/pass, `passkey()`, `twoFactor()` tetap diaktifkan.
- **SvelteKit Auth Link:** Gunakan `$session` hook dari Better Auth SvelteKit client untuk me-*manage* session global.
- **The "Share Link" Pattern:** Hindari mekanisme session Better Auth yang 'rumit' untuk klien publik (Customer galeri). Implementasikan public access route `GET /api/public/galleries/:id` via S3 *Pre-signed URLs* yang aman sebagai bentuk *Share Link* seperti Google Drive.
- **No Direct Storage Exposture:** Dilarang menyimpan file mentah di storage lokal VPS dan sangat dilarang mengekspose Object Key S3 langsung ke web. File dilayani hanya via *Presigned URLs* dengan TTL pendek (contoh 1 Jam).

## ⚡ 4. PERFORMANCE (Stream & Queue)
Saat menulis API penerima file upload atau *job processing*:

- **Upload Streaming Pipa:** Server API (Hono) tidak boleh menumpuk `ArrayBuffer` Blob gambar di RAM. Gunakan Node stream atau Bun File Stream (Web Standard) `Request.body.pipeTo()` atau dipecah di API untuk langsung meneruskan *file chunk* ke S3 Client / R2 bucket target.
- **Redis Background Queue:** Image manipulation (resize thumbnail, compose logo watermark) MUST dilimpahkan informasinya lewat daftar antrean Redis (`queue:image_processing`). Server Hono merespon *API request* langsung setelah upload ke S3 "selesai", pekerja (`Bun worker`) di *background* lah yang mengunduhnya (dari S3), memproses (`sharp`), kemudian upload ulang `thumbnail` & `watermarked` ke S3.
- **Redis Caching:** API yang melayani halaman publik Klien (Customer) wajib men-cache informasi JSON galeri untuk waktu yang sejalan dengan umur TTL Presigned URL (1 Jam) via *key* `cache:gallery:{id}:metadata`. Jika ada perombakan (penambahan foto dsb) oleh Studio, Hono harus mentrigger `DEL cache:gallery:{id}:metadata` (Invalidation).

## 🛠️ 5. DIRECTORIES AND CONVENTIONS
Apabila file yang dikerjakan berupa monorepo, pisahkan sebagai berikut:

- `apps/web` (SvelteKit Frontend App)
- `apps/api` (Hono Backend Server)
- `apps/worker` (Bun Background Worker Process)
- `packages/db` (Drizzle Database Schema)

**Struktur Path Storage S3:**
Setiap peng-upload-an ke S3 harus mereferensikan path format ini:
`/{user_id}/{gallery_id}/original/{photo_id}.{extension}`
`/{user_id}/{gallery_id}/thumbnail/{photo_id}.webp`
`/{user_id}/{gallery_id}/watermark/{photo_id}.webp`

**(Tambahan Referensi Drizzle UUIDv7):**
Jika framework belum natively support `uuidv7()`, sediakan function fallback JS/Postgres Extension pada skema tabel secara *safe* (sesuai best practice Bun backend).

---
Panduan ini dirancang untuk memastikan skalabilitas, keamanan, serta mencegah kesalahan *blocking architecture* dalam I/O proses yang berat sepanjang siklus hidup pengerjaan *project* Kirim Karya.
