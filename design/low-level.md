# **Kirim Karya | Low-Level Design (LLD): Platform Manajemen Galeri & Client Proofing**

Dokumen ini merupakan turunan dari High-Level Design (HLD) dan memberikan rincian teknis untuk implementasi sistem Kirim Karya.

---

## **1. Skema Database (Drizzle ORM & PostgreSQL)**

Database menggunakan skema relasional yang didefinisikan melalui **Drizzle ORM**. Untuk autentikasi, sistem akan mengotomatiskan pembuatan tabel `user`, `session`, `account`, dan `verification` yang di-*manage* oleh **Better Auth** via adapter Drizzle. Berikut ini adalah representasi skema tabel utama untuk domain aplikasi.

### **1.1. users (Dikelola oleh Better Auth & Diperluas)**
Menyimpan informasi studio atau fotografer (Tenant).

| Column | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `id` | VARCHAR | Primary Key (dari Better Auth) |
| `email` | VARCHAR | Unique, Not Null |
| `name` | VARCHAR | Not Null (Nama Studio/Pemilik) |
| `subscription_tier` | VARCHAR | Default: 'FREE' (FREE, PRO, ENTERPRISE) |
| `created_at` | TIMESTAMP | Default: NOW() |
| `updated_at` | TIMESTAMP | Default: NOW() |

### **1.2. galleries**
Menyimpan data galeri proyek foto yang dibuat oleh Studio untuk Klien.

| Column | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key, Default UUID v7 |
| `user_id` | VARCHAR | Foreign Key -> users(id), Index |
| `title` | VARCHAR | Not Null |
| `client_email` | VARCHAR | Nullable (Untuk notifikasi email klien) |
| `password_hash` | VARCHAR | Nullable (Password proteksi galeri) |
| `status` | VARCHAR | Default: 'DRAFT' (DRAFT, PUBLISHED, ARCHIVED) |
| `expires_at` | TIMESTAMP | Nullable (Tanggal kedaluwarsa galeri) |
| `created_at` | TIMESTAMP | Default: NOW() |
| `updated_at` | TIMESTAMP | Default: NOW() |

*Indeks Tambahan:* `Index(user_id, status)`

### **1.3. photos**
Menyimpan data individual foto dalam suatu galeri.

| Column | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key, Default UUID v7 |
| `gallery_id` | UUID | Foreign Key -> galleries(id), Index |
| `filename` | VARCHAR | Not Null (Nama file asli) |
| `original_s3_key`| VARCHAR | Not Null (Path file asli di S3) |
| `thumbnail_s3_key`| VARCHAR | Nullable (Path thumbnail di S3) |
| `watermark_s3_key`| VARCHAR | Nullable (Path versi watermark di S3) |
| `status` | VARCHAR | Default: 'PENDING' (PENDING, PROCESSING, READY, ERROR) |
| `uploaded_at` | TIMESTAMP | Default: NOW() |

*Indeks Tambahan:* `Index(gallery_id, status)`

### **1.4. feedbacks**
Fitur *Client Proofing* yang menyimpan *feedback* atau pilihan foto dari klien.

| Column | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key, Default UUID v7 |
| `photo_id` | UUID | Foreign Key -> photos(id), Index |
| `is_selected` | BOOLEAN | Default: false |
| `comment` | TEXT | Nullable |
| `client_identifier`| VARCHAR | Nullable (Email atau ID Sesi Klien) |
| `created_at` | TIMESTAMP | Default: NOW() |
| `updated_at` | TIMESTAMP | Default: NOW() |

---

## **2. Struktur Penyimpanan Object (S3 / Cloudflare R2)**

Struktur *bucket* dirancang agar aman dan mudah dibersihkan saat galeri *expired*.
Setiap objek akan disimpan dengan *prefix* `userId/galleryId/`.

* **Bucket Name:** `kirimkarya-storage` (Atau disesuaikan environment)
* **Path Convention:**
    * Original: `/{user_id}/{gallery_id}/original/{photo_id}.{ext}`
    * Thumbnail: `/{user_id}/{gallery_id}/thumbnail/{photo_id}.webp`
    * Watermarked: `/{user_id}/{gallery_id}/watermark/{photo_id}.webp`

*Akses:* Bucket dikonfigurasi sebagai **Private**. Akses file oleh klien klien via antarmuka web menggunakan *Presigned URLs* yang berumur pendek karena alasan keamanan dan mencegah *hotlinking*.

---

## **3. API Design (Hono + Bun)**

Gunakan pola RESTful yang berbasis JSON (Kecuali proses upload). Route API dilindungi lewat Better Auth untuk akses Studio.

### **3.1. Authentication (via Better Auth)**
* `POST /api/auth/*` -> Handled by Better Auth untuk Login, Register, Session.
* Mendukung **Google Login / Register** via plugin `socialProviders` Better Auth.

### **3.2. Galleries API (Studio)**
* `GET /api/galleries` -> Mendapatkan daftar galeri studio.
* `POST /api/galleries` -> Membuat galeri baru.
* `GET /api/galleries/:id` -> Detail galeri lengkap dengan foto-foto yang berstatus READY.
* `PUT /api/galleries/:id` -> Mengubah title, password, status, waktu expired.
* `POST /api/galleries/:id/share` -> Meng-*generate* Share Link unik untuk klien (mirip fitur invite Google Drive).
* `DELETE /api/galleries/:id` -> Menghapus galeri dan mentrigger job penghapusan file di S3.

### **3.3. Photos API (Upload & Streaming)**
* `POST /api/galleries/:galleryId/photos`
    * Content-Type: `multipart/form-data`
    * **Action:**
        1. API menerima *stream*.
        2. Menyimpan data awal ke DB (`photos` -> status = PENDING).
        3. Langsung upload (Pipe Stream) file asli ke S3 (`original_s3_key`).
        4. Masukkan struktur *job* ke antrean Redis (`queue:image_processing`).
    * **Response:** 202 Accepted. Mengembalikan daftar ID Foto.

### **3.4. Client Facing API (Public / Protected with Gallery Password)**
* `POST /api/public/galleries/:id/verify` -> Validasi input password galeri, return Session token khusus (JWT).
* `GET /api/public/galleries/:id` -> Mendapatkan detail galeri & list foto. (Menggunakan *Redis Caching*).
* `POST /api/public/photos/:photo_id/feedback` -> Klien memberikan *like* (`is_selected`) atau komentar.

---

## **4. Worker & Queue Design (Redis + Bun Worker)**

Proses pembuatan thumbnail dan *watermarking* merupakan CPU-Bound sehingga diproses di luar siklus API (*Background Processing*).

### **4.1. Queue Payload Detail**
Setiap *upload* file ke-n akan di-push ke List Redis (List: `queue:image_processing`).

```json
{
  "jobId": "uuid-xxx",
  "photoId": "uuid-yyy",
  "galleryId": "uuid-zzz",
  "userId": "uuid-user",
  "originalKey": "{user_id}/{gallery_id}/original/{photo_id}.jpg"
}
```

### **4.2. Worker Lifecycle**
1. **Pull:** `BRPOP queue:image_processing 0` dari Redis.
2. **Download:** Menggunakan S3 Client untuk melakukan *fetch/download* file asli dari `originalKey` ke memory berupa Buffer.
3. **Process (sharp):**
    * Thumbnail = di-*resize* lebar max `800px`, kualitas `70`, fomat WebP.
    * Watermarked = di-*resize* lebar `1920px`, fomat WebP, composite / tumpukan gambar logo *watermark* studio dengan *opacity* tertentu.
4. **Upload:** *Streaming* buffer hasil `sharp` ke object storage S3.
5. **Finalize:**
    * Update DB tabel `photos` mengubah `thumbnail_s3_key`, `watermark_s3_key`, status menjadi `READY`.
    * Melakukan penghapusan cache (*Invalidation*): `DEL cache:gallery:{galleryId}:metadata`.

---

## **5. Caching Strategy (Redis)**

Digunakan terutama untuk mempercepat pengalaman loading klien pada sisi public gallery.
* **Key:** `cache:gallery:{galleryId}:metadata`
* **Value (JSON):** Konfigurasi nama galeri, status, list foto lengkap beserta Presigned URLs berdurasi pendek (misal: S3 Presigned URL berlaku 1 Jam).
* **TTL:** `3600` detik (1 Jam). Sesuai dengan panjang umur Presigned URL.
* **Invalidation:** Otomatis di-hapus dari Redis (DEL) apabila:
    * Studio menambahkan foto baru.
    * Studio mengubah status galeri atau info galeri terkait.
    * *Background Worker* menyelesaikan *image_processing*.

---

## **6. Frontend Architecture (SvelteKit)**

SvelteKit bertugas penuh memisahkan urusan UI untuk Studio (Admin) dan Klien (*Public*). Menggunakan konsep *SSR (Server-Side Rendering)* untuk mempercepat TTI (Time to Interactive).

### **6.1. Routing SvelteKit**
* `/(marketing)/*` -> Landing page SaaS, pricing.
* `/(auth)/*` -> Halaman Login & Sign Up (`/login`, `/register`).
* `/dashboard` -> Halaman utama Studio / Tenant.
    * `/dashboard/galleries` -> Daftar proyek foto.
    * `/dashboard/galleries/[id]` -> Detail galeri, uploader komponen.
    * `/dashboard/galleries/[id]/proofing` -> Review *feedback* / foto yang dipilih klien.
* `/g/[id]` -> Halaman Publik Galeri Klien.
    * Menampilkan Masonry layout untuk *thumbnail*.
    * Klik foto memunculkan Lightbox (*Watermarked Image*).
    * Opsi ceklis (Pilih Foto) untuk *Proofing*.

### **6.2. UI State & Pustaka Pendukung**
* **Styling:** TailwindCSS
* **Better Auth Client:** Mengakses object `$session` yang di-export dari file BetterAuth SvelteKit Client (mengelola State Autentikasi global).
* **Uploader:** Komponen *progress bar* custom untuk pelaporan upload foto menggunakan native `XMLHttpRequest` atau `fetch` API dengan ReadableStream untuk mentracking *progress bytes*.
* **Gallery Viewer:** PhotoSwipe (atau serupa) untuk modal *lightbox*. Fetch Data pada sisi klien lewat *Svelte Stores* (untuk state foto mana yang sudah *di-like*/*comment*).
