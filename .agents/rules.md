# KirimKarya — Engineering Standards & Rules

> **WAJIB DIBACA** setiap kali menulis kode baru, membuat fitur, memperbaiki bug, atau melakukan refactor.
> Dokumen ini diturunkan dari hasil Architecture Review (`/reviews/`) dan design docs (`/design/`).

---

## 1. TYPE SAFETY — Zero `any` Policy

### ❌ DILARANG
```typescript
// JANGAN PERNAH:
async create(userId: string, data: any) { ... }
const api = clientApi as any;
data?: any;
```

### ✅ WAJIB
```typescript
// Gunakan Zod infer untuk tipe dari schema:
import { z } from "@hono/zod-openapi";
import { CreateGallerySchema } from "./galleries.schema";
type CreateGalleryInput = z.infer<typeof CreateGallerySchema>;

async create(userId: string, data: CreateGalleryInput) { ... }

// Untuk queue job data, definisikan interface yang spesifik:
export interface NotificationJobData {
    type: NotificationType;
    galleryId: string;
    userId: string;
    data: GalleryPublishedData | SelectionSubmittedData | ReminderData;
}
```

- Setiap function parameter HARUS memiliki tipe eksplisit.
- Setiap return value HARUS memiliki tipe eksplisit (atau inferred dari Zod).
- Gunakan `InferResponseType` dan `InferRequestType` dari `hono/client` di frontend.
- Jika menemukan `any` yang sudah ada, refactor saat menyentuh file tersebut.

---

## 2. DATABASE — Query & Schema Rules

### 2.1 Transaction Boundaries
Setiap operasi yang menyentuh **lebih dari 1 tabel** WAJIB dibungkus `db.transaction()`:

```typescript
// ✅ BENAR:
await db.transaction(async (tx) => {
    const [gallery] = await tx.insert(galleries).values({...}).returning();
    await tx.insert(galleryAccess).values(
        emails.map(email => ({ galleryId: gallery.id, email }))
    );
    return gallery;
});

// ❌ SALAH — partial insert jika salah satu gagal:
const [gallery] = await db.insert(galleries).values({...}).returning();
await db.insert(galleryAccess).values(...); // TANPA transaction!
```

### 2.2 No N+1 Queries
DILARANG melakukan query di dalam loop `map`/`forEach`:

```typescript
// ❌ SALAH — N+1 query:
const list = await db.select().from(galleries).where(...);
const enhanced = await Promise.all(list.map(async (g) => {
    const count = await this.countSelectedPhotos(g.id); // query per item!
    return { ...g, count };
}));

// ✅ BENAR — single query dengan subquery/JOIN:
const list = await db
    .select({
        ...getTableColumns(galleries),
        selectionCount: db.$count(feedbacks, eq(feedbacks.photoId, photos.id)),
    })
    .from(galleries)
    .leftJoin(photos, eq(galleries.id, photos.galleryId))
    .where(...);
```

### 2.3 Index Awareness
Setiap **foreign key** dan kolom yang sering di-`WHERE`/`ORDER BY` HARUS memiliki index.
Saat menambah tabel/kolom baru, selalu tanyakan: *"Apakah kolom ini akan di-query? Jika ya, tambah index."*

### 2.4 Schema Conventions
- Primary Key: `uuid` dengan `$defaultFn(() => uuidv7())` (kecuali tabel Better Auth).
- Tabel baru WAJIB plural: `galleries`, `photos`, `feedbacks` (bukan `gallery`, `photo`).
- Status fields gunakan `varchar` dengan `.$type<"A" | "B" | "C">()` untuk type safety.
- Setiap tabel WAJIB punya `createdAt` dan `updatedAt`.
- FK ke `galleries.id` dan `photos.id` HARUS punya `onDelete: "cascade"` di schema.
- DILARANG membuat/memodifikasi tabel `user`, `session`, `account`, `verification` secara manual — gunakan Better Auth generator.

### 2.5 Drizzle Usage
- DILARANG menulis raw SQL string. Gunakan Drizzle query builder.
- Import operator (`eq`, `and`, `sql`, dll) dari `@kirimkarya/db`, BUKAN langsung dari `drizzle-orm` di app layer.

---

## 3. API DESIGN — Endpoint & Response Rules

### 3.1 Response Format
SEMUA endpoint WAJIB menggunakan `apiResponse` helper:

```typescript
// Success:
return c.json(apiResponse.success(data, "Message"), 200);

// Error:
return c.json(apiResponse.error("Error message", details), 400);
```

### 3.2 Route Definition
SEMUA route WAJIB didefinisikan dengan `createRoute()` dari `@hono/zod-openapi`:

```typescript
const myRoute = createRoute({
    method: "get",
    path: "/resource/{id}",     // Gunakan {id} bukan :id (OpenAPI standard)
    summary: "Human-readable summary",
    tags: ["ModuleName"],
    request: {
        params: z.object({ id: z.string().uuid() }),
    },
    responses: {
        200: { content: { "application/json": { schema: ... } }, description: "..." },
        404: { content: { "application/json": { schema: ApiErrorSchema("...") } }, description: "..." },
    },
});
```

### 3.3 HTTP Status Codes
| Action | Success | Client Error | Not Found |
|--------|---------|-------------|-----------|
| GET | 200 | 400 | 404 |
| POST (create) | 201 | 400 | — |
| POST (action, async) | 202 | 400 | 404 |
| PUT/PATCH | 200 | 400 | 404 |
| DELETE | 200 | 400 | 404 |
| Auth fail | — | 401 | — |
| Forbidden | — | 403 | — |
| Rate limit | — | 429 | — |

### 3.4 Module Structure
Setiap module API WAJIB mengikuti struktur konsisten:

```
modules/
└── feature-name/
    ├── feature-name.controller.ts   # Route handlers (thin)
    ├── feature-name.service.ts      # Business logic
    └── feature-name.schema.ts       # Zod validation schemas
```

- Naming: gunakan **dot separator** (`galleries.controller.ts`), BUKAN hyphen (`stats-controller.ts`).
- Controller: TIPIS — hanya extract params, call service, return response.
- Service: semua business logic dan DB queries.
- Schema: semua Zod schemas (request + response).

### 3.5 API Client (Frontend)
- Better Auth API → gunakan `authClient` dari `$lib/auth-client.ts`.
- Semua API lain → gunakan Hono RPC client `api` dari `$lib/api/index.ts`.
- **DILARANG** menggunakan `fetch()` langsung untuk API internal.
- **DILARANG** melakukan cast `as any` pada API client.

---

## 4. ERROR HANDLING — Consistency Rules

### 4.1 Service Layer
Throw `HttpError` untuk error yang diketahui:

```typescript
import { HttpError } from "../../core/exceptions/http-error";

if (!gallery) throw new HttpError(404, "Gallery not found");
if (!authorized) throw new HttpError(403, "Forbidden");
```

### 4.2 Worker Layer
- JANGAN gunakan `.catch(() => {})` untuk menelan error secara diam-diam.
- Log setiap error yang di-catch dengan konteks yang jelas:

```typescript
// ❌ SALAH:
await s3.file(key).delete().catch(() => {});

// ✅ BENAR:
await s3.file(key).delete().catch((err) => {
    console.error(`[Cleanup] Failed to delete S3 key ${key}:`, err.message);
});
```

### 4.3 Logging Format
Gunakan prefix yang konsisten untuk log:

```
[ModuleName] Message — untuk info
[ModuleName] ERROR: Message — untuk error
[Job {jobId}] Message — untuk worker jobs
```

Sertakan konteks yang berguna (ID, key, user) tapi JANGAN log data sensitif (password, token, secret).

---

## 5. WORKER & QUEUE — Reliability Rules

### 5.1 Job Idempotency
Worker handler HARUS idempotent — jika dijalankan ulang dengan data yang sama, hasilnya tetap konsisten.
Gunakan S3 key yang deterministik berdasarkan `photoId` (bukan random UUID di worker):

```typescript
// ✅ Key deterministik — aman untuk retry:
const thumbnailKey = `${userId}/${galleryId}/thumbs/${photoId}.webp`;

// ❌ Key random — retry = file duplikat:
const thumbnailKey = `${userId}/${galleryId}/thumbs/${crypto.randomUUID()}.webp`;
```

### 5.2 Queue Job Data
- Setiap queue HARUS memiliki typed interface di `@kirimkarya/queue`.
- DILARANG menggunakan `data?: any` — definisikan union type yang spesifik.
- Job name HARUS deskriptif dan unique: `gallery_delivery_${galleryId}`.

### 5.3 Concurrency & Resources
- Photo processing: max concurrency **4** (CPU-intensive sharp operations).
- Notification: max concurrency **5** (I/O-bound email).
- Delivery: max concurrency **2** (memory-intensive ZIP).
- Cleanup: max concurrency **1** (batch operation).
- JANGAN naikkan concurrency tanpa load testing terlebih dahulu.

### 5.4 Memory Safety
DILARANG memuat seluruh file besar ke memory sekaligus. Untuk operasi batch (ZIP, bulk delete), proses secara streaming atau chunked:

```typescript
// ❌ SALAH — OOM risk pada gallery besar:
for (const photo of allPhotos) {
    const content = await fileRef.bytes(); // semua di RAM
    zip.file(photo.filename, content);
}

// ✅ BENAR — proses secara bertahap dengan limit:
// Atau gunakan streaming archiver
```

---

## 6. STORAGE & UPLOADS

### 6.1 Upload Endpoints
- DILARANG membuat generic upload endpoint. Setiap upload HARUS melalui endpoint fungsional yang spesifik (`/auth/avatar`, `/photos/galleries/:id/photos`, `/watermark/image`).
- Setiap upload endpoint WAJIB validasi: **file size**, **MIME type**, **file existence**.

### 6.2 S3 Path Convention
```
/{user_id}/{gallery_id}/original/{photo_id}.{ext}     # file asli
/{user_id}/{gallery_id}/thumbs/{photo_id}.webp         # thumbnail 400x400
/{user_id}/{gallery_id}/previews/{photo_id}.webp       # watermarked preview 1200x1200
/{user_id}/{gallery_id}/delivery/photos.zip            # delivery ZIP
/avatar/{user_id}/{uuid}.webp                          # user avatar
/{user_id}/watermark/{uuid}.png                        # custom watermark logo
```

### 6.3 Cleanup
- Saat menghapus resource (gallery, photo, avatar), S3 file WAJIB ikut dihapus.
- Saat meng-update file (avatar baru), file lama WAJIB dihapus dari S3.
- Cleanup S3 boleh async (non-blocking) tapi HARUS di-log jika gagal.

---

## 7. SECURITY — Non-Negotiable Rules

### 7.1 Authentication & Authorization
- Semua endpoint kecuali `/public/*` dan `/health` WAJIB dilindungi `authMiddleware`.
- Admin endpoints WAJIB dilindungi `adminMiddleware`.
- JANGAN duplikasi auth check di handler jika middleware sudah memverifikasi — trust middleware.
- Setiap query galeri/foto WAJIB filter `WHERE userId = currentUser.id` (multitenancy isolation).

### 7.2 Input Validation
- SEMUA request body, params, dan query WAJIB divalidasi dengan Zod schema.
- File upload WAJIB dicek: size limit, MIME type, file existence.
- DILARANG mempercayai input dari client tanpa validasi.

### 7.3 Sensitive Data
- DILARANG log password, token, secret, OTP, atau API key.
- DILARANG expose stack trace di production (`env.NODE_ENV === "production"`).
- DILARANG hardcode secret di source code — gunakan environment variables.
- Cookie yang berisi data sensitif HARUS `httpOnly: true`, `secure: true` (production), `sameSite: "Lax"`.

### 7.4 Rate Limiting
- Endpoint yang bisa di-brute-force (login, OTP verify, password verify) WAJIB memiliki rate limiting.
- Rate limit menggunakan Redis key dengan TTL.

---

## 8. FRONTEND (SvelteKit) — Component & Pattern Rules

### 8.1 Component Size
- Sebuah `.svelte` file TIDAK BOLEH melebihi **400 baris**.
- Jika melebihi, pecah menjadi sub-komponen di `$lib/components/`.
- Contoh: `/g/[id]/+page.svelte` (1270 baris) harus dipecah menjadi:
  - `GalleryAccessWall.svelte`
  - `GalleryPhotoGrid.svelte`
  - `GalleryLightbox.svelte`
  - `GalleryNav.svelte`
  - `GalleryExpiredState.svelte`

### 8.2 Data Loading
- Halaman publik (`/g/[id]`) SEBAIKNYA menggunakan SvelteKit `+page.server.ts` load function untuk SSR (SEO-friendly), bukan `onMount()` client-side fetch saja.
- Dashboard pages boleh full client-side dengan `onMount()`.

### 8.3 Navigation
- DILARANG menggunakan `window.location.reload()` — gunakan `goto()` atau `invalidateAll()` dari SvelteKit.
- Gunakan `goto("/path")` untuk navigasi programmatic.

### 8.4 Styling
- Gunakan komponen daisyUI terlebih dahulu (`btn`, `input`, `card`, `modal`, dll).
- Kustomisasi dengan utility Tailwind CSS v4 sebagai tambahan.
- Referensi class daisyUI: lihat `.agents/daisy-ui.txt`.
- DILARANG menggunakan inline style kecuali untuk dynamic values (transform, dll).

### 8.5 State Management
- Gunakan Svelte 5 Runes: `$state()`, `$derived()`, `$effect()`.
- Session global: `authClient.useSession()`.
- DILARANG membuat global store kecuali benar-benar dibutuhkan cross-page.

---

## 9. NAMING CONVENTIONS

### 9.1 Files
| Lokasi | Format | Contoh |
|--------|--------|--------|
| API module files | `{feature}.{type}.ts` (dot separator) | `galleries.controller.ts`, `galleries.service.ts` |
| Svelte components | `PascalCase.svelte` | `GalleryHeader.svelte`, `LightboxModal.svelte` |
| Shared packages | `kebab-case` folder, `index.ts` entry | `packages/db/src/index.ts` |
| Schema/migration | Generated by Drizzle Kit | `0007_name.sql` |

### 9.2 Variables & Functions
| Item | Convention | Contoh |
|------|-----------|--------|
| Variables | camelCase | `galleryId`, `selectionCount` |
| Functions | camelCase | `getById()`, `toggleSelection()` |
| Classes | PascalCase | `GalleryService`, `HttpError` |
| Constants | UPPER_SNAKE_CASE | `PHOTO_PROCESSING_QUEUE`, `MAX_SIZE` |
| Types/Interfaces | PascalCase | `HonoEnv`, `PhotoProcessingJobData` |
| DB tables | plural snake_case | `galleries`, `gallery_access`, `feedbacks` |
| DB columns | snake_case | `user_id`, `created_at`, `original_s3_key` |

---

## 10. MONOREPO & DEPENDENCY Rules

### 10.1 Package Usage
```
apps/api     → imports from: @kirimkarya/db, queue, redis, storage, mail
apps/worker  → imports from: @kirimkarya/db, queue, redis, storage, mail
apps/web     → imports from: hono/client (type-only dari apps/api)
apps/e2e     → imports from: @playwright/test
```

- DILARANG apps/web mengimport langsung dari `@kirimkarya/db` atau packages backend lain.
- DILARANG cross-import antar apps (kecuali type-only import untuk Hono RPC).

### 10.2 Shared Code
Jika logika dipakai oleh >1 app, pindahkan ke package yang sesuai:
- Database schema/queries → `@kirimkarya/db`
- Queue definitions & types → `@kirimkarya/queue`
- Email sending → `@kirimkarya/mail`
- S3 operations → `@kirimkarya/storage`
- Redis client → `@kirimkarya/redis`

### 10.3 Environment
- Satu file `.env` di root project, dibaca semua apps.
- Setiap app/package WAJIB punya `env.ts` yang memvalidasi env vars dengan Zod.
- DILARANG mengakses `process.env` langsung di luar `env.ts`.

---

## 11. PERFORMANCE RULES

### 11.1 Caching
- Public gallery metadata WAJIB di-cache di Redis (`cache:gallery:{id}:metadata`, TTL 1 jam).
- Invalidasi cache saat gallery di-update: `await redis.del(\`cache:gallery:${id}:metadata\`)`.
- User watermark settings boleh di-cache (TTL 24 jam).

### 11.2 Image Serving
- Image proxy melalui `/api/images/*` HARUS set header `Cache-Control: public, max-age=31536000, immutable`.
- DILARANG expose S3 key langsung ke frontend — selalu proxy melalui API.

### 11.3 Query Optimization
- Gunakan `SELECT` spesifik (bukan `SELECT *`) saat hanya butuh beberapa kolom.
- Gunakan `LIMIT` pada semua query yang berpotensi return banyak rows.
- Pagination WAJIB untuk list endpoints: gunakan `limit` + `offset` atau cursor-based.

---

## 12. GIT & CODE REVIEW

### 12.1 Sebelum Commit
- Pastikan tidak ada `any` type baru yang ditambahkan.
- Pastikan tidak ada `console.log` debugging yang tertinggal (kecuali log terstruktur).
- Pastikan file `.env` TIDAK ikut ter-commit (sudah ada di `.gitignore`).
- Pastikan semua import terpakai dan tidak ada dead code.

### 12.2 File yang TIDAK BOLEH Dimodifikasi Manual
- `packages/db/src/auth-schema.ts` → di-generate oleh Better Auth (`make auth-generate`).
- `packages/db/drizzle/` → di-generate oleh Drizzle Kit (`make db-generate`).
- `apps/web/src/paraglide/` → di-generate oleh ParaglideJS.
- `apps/web/src/lib/paraglide/` → di-generate oleh ParaglideJS.

---

> **Referensi tambahan:**
> - Architecture docs: [`/design/high-level.md`](/design/high-level.md), [`/design/low-level.md`](/design/low-level.md)
> - Review lengkap: [`/reviews/`](/reviews/)
> - DaisyUI class reference: [`.agents/daisy-ui.txt`](.agents/daisy-ui.txt)
> - Workflow setup: [`.agents/workflows/setup.md`](.agents/workflows/setup.md)
