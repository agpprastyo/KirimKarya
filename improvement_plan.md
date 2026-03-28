# Implementation Plan - Secure Share Link & Dashboard Polish

Rencana ini bertujuan untuk meningkatkan keamanan distribusi galeri melalui sistem **Private Access (OTP)** dan meningkatkan kualitas UX Dashboard.

## Phase 1: Security Controls & Database Schema
**Tujuan:** Memberikan Studio kendali penuh atas siapa yang boleh mengakses galeri.

### [NEW] [gallery_access table]
- Membuat tabel `gallery_access` (id, gallery_id, email) untuk menyimpan daftar email yang diizinkan.

### [MODIFY] [galleries table]
- Menambahkan kolom `is_private` (boolean, default false).

### [MODIFY] [Dashboard Gallery Settings]
- Membuat modal pengaturan di `/dashboard/galleries/[id]`.
- Input untuk:
    - Toggle **Public** vs **Private**.
    - Daftar **Allowed Emails** (Client Emails).
    - Custom **Expiration Date**.
    - Update **Password Protection**.

---

## Phase 2: Secure Public Flow (OTP System)
**Tujuan:** Melindungi galeri pribadi dengan verifikasi email dinamis.

### [NEW] API Endpoints
- `POST /api/public/galleries/:id/request-access`: Cek jika email terdaftar.
- `POST /api/public/galleries/:id/verify-otp`: Validasi OTP dari Redis dan set **Access Cookie**.

### [MODIFY] Public Gallery Page (`/g/[id]`)
- Implementasi "Security Wall":
    - **Step 1:** Form input email (jika galeri Private).
    - **Step 2:** Form input OTP 6-digit.
    - **Step 3:** Render Gallery jika token valid.

---

## Phase 3: Premium Dashboard UX (WOW Factor)
**Tujuan:** Membuat antarmuka terasa lebih responsif dan modern.

### Photos Management
- **Parallel Uploads:** Mengganti upload sequensial dengan upload paralel (concurrency: 3).
- **Real-time Status Overlay:** Update status (READY/PROCESSING) tanpa refresh manual (menggunakan SSE atau optimized long-polling).

### Appearance
- **Micro-animations:** Implementasi staggered animation menggunakan `svelte-motion` untuk card galeri dan grid foto.
- **Status Badges:** Desain ulang badge status yang lebih hidup dan informatif.

---

## Phase 4: Advanced Gallery Access & Settings
**Tujuan:** Memberikan kontrol akses yang lebih fleksibel dan profesional.

### [MODIFY] Access Control logic
- **Draft/Publish Status:** Galeri dalam status `DRAFT` tidak dapat diakses oleh publik (hanya fotografer).
- **Dual Access Mode:** Pilihan antara **OTP Mode** (seperti sekarang) atau **Static Password** (satu password untuk semua akses).
- **Identity First:** Pada mode Password, tetap meminta email terlebih dahulu untuk validasi daftar akses (Whitelist).

### [MODIFY] Multi-Email Support
- **Client Emails:** Mendukung banyak email (koma terpisah) yang otomatis sinkron dengan tabel `gallery_access`.
- **Save & Notify:** Tombol khusus untuk menyimpan pengaturan sekaligus mengirim notifikasi ke semua email klien.

---

## Phase 5: Delivery & Lifecycle
**Tujuan:** Menyelesaikan alur kerja ujung-ke-ujung (End-to-End).

### Delivery System
- Logika tombol **"Start Delivery"**: Menyiapkan file ZIP original untuk foto-foto yang dipilih klien (`isSelected`).

### Automated Cleanup
- Implementasi **Cron Job** (Bun Worker):
    - Membersihkan file S3 untuk galeri yang sudah dihapus/kadaluwarsa.
    - Notifikasi email otomatis H-1 sebelum galeri kadaluwarsa.

---

## Verification Plan
- **Keamanan:** Mencoba akses galeri Private dengan email yang tidak terdaftar (harus ditolak).
- **OTP:** Verifikasi bahwa OTP di Redis kadaluwarsa dalam 5 menit.
- **Sesi:** Memastikan Access Cookie hilang setelah durasi yang ditentukan (misal: 24 jam).
