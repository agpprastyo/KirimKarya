<div align="center">
  <h1>KirimKarya 📸</h1>
  <p><strong>A Modern, High-Performance Photo Delivery & Client Proofing Platform for Professional Photographers</strong></p>

  [![Tech Stack](https://skillicons.dev/icons?i=bun,ts,svelte,tailwind,postgres,redis)](https://skillicons.dev)
</div>

---

## 📖 Overview

**KirimKarya** is an advanced gallery delivery and client proofing system built as a robust, production-ready monorepo. It enables professional photography studios to securely share high-resolution photo galleries, manage client selections in real-time, and automate tedious post-production tasks like watermarking and notifications.

Designed with scalability, performance, and developer experience (DX) in mind, KirimKarya leverages the cutting-edge **Bun runtime** to deliver blazing-fast API responses and background job processing.

---

## ✨ Key Features

- **Painless Client Proofing:** Clients receive a clean, responsive gallery interface where they can view watermarked photos and submit their final selections seamlessly.
- **Asynchronous Processing Pipeline:** Heavy lifting tasks like image resizing, thumbnail generation, dynamic watermarking (via `sharp`), and S3 uploads are offloaded to **BullMQ** running on dedicated background workers.
- **Lightning-Fast Native S3 Integration:** Bypasses heavy AWS SDK dependencies by utilizing Bun's ultra-fast native `S3Client` for object storage interactions (uploads, secure retrievals, cleanups).
- **Automated Lifecycle Hooks:** Time-based jobs automatically purge expired galleries and source files from object storage and the PostgreSQL database, ensuring optimal resource utilization.
- **Role-Based Access Control (RBAC):** Secure authentication and session management powered by **Better Auth**, ensuring clients only see their own secure galleries.
- **Modular Monorepo Architecture:** Cleanly separated concerns between `apps` (API, Web, Worker) and standard shared `packages` (Database, Mail, Queue, Redis, Storage) managed seamlessly via Bun workspaces.
- **Type-Safe Full-Stack:** End-to-end type safety from the database schema (via `drizzle-orm`) up to the SvelteKit frontend (auto-generated API types, ParaglideJS for i18n).

---

## 🛠️ Tech Stack & Architecture

KirimKarya is built upon a bleeding-edge, highly optimized stack tailored for extreme performance and maintainability:

### **Backend & APIs (`apps/api`)**
- 🚀 **Bun Runtime:** The unified JavaScript engine orchestrating execution, testing, and package management.
- 🔥 **Hono (Edge-ready API):** Lightweight web framework with robust OpenAPI schema generation and validation using `zod`.
- 🗄️ **PostgreSQL + Drizzle ORM:** Rock-solid relational database coupled with a modern, type-safe ORM.
- 🔐 **Better Auth:** Next-generation, adapter-driven authentication library.

### **Background Workers (`apps/worker`)**
- ⚙️ **BullMQ + Redis:** High-performance, reliable background job queues for image rendering and asynchronous processing.
- 🖼️ **Sharp:** Node.js-based high-performance image processing for dynamic resizing and client-specific watermarking on-the-fly.
- 🗑️ **Native Bun S3:** Lightning fast interaction with S3-compatible endpoints for asset persistence and cleanup.

### **Frontend App (`apps/web`)**
- 🌀 **SvelteKit 5 (Runes):** Modern, reactive framework for building the premium, interactive photographer dashboards and responsive client galleries.
- 🎨 **Tailwind CSS:** Utility-first CSS framework coupled with customized themes and fluid animations for an exceptional UI/UX.
- 🌍 **ParaglideJS:** Frictionless internationalization (i18n) for global reach.

### **Shared Packages (`packages/*`)**
- Modules designed for high reusability: `@kirimkarya/db`, `@kirimkarya/redis` (using native Bun Redis bindings), `@kirimkarya/queue`, `@kirimkarya/mail` (with compiled responsive HTML templates), and `@kirimkarya/storage`.

---

## 🚀 The Architecture

KirimKarya solves the heavy-computation roadblock inherent in photo processing applications:

1. **Upload:** Studio uploads raw/high-res JPG/WEBP images via the Dashboard.
2. **Ingestion:** API triggers direct-to-S3 secure uploads and quickly acknowledges the user.
3. **Queueing:** `apps/api` publishes a job payload to Redis via BullMQ.
4. **Processing (`apps/worker`):** The isolated Worker pulls from the `photo-processing` queue, downloads the raw asset, dynamically generates thumbnails and heavily watermarked client-viewable images, and updates S3 and the Database.
5. **Notification:** Once an entire gallery is fully processed, the Worker automatically queues an email notification (using structured, responsive HTML templates) to inform the studio and clients.
6. **Selection Phase:** Client browses the optimized images, "hearts" their choices, and submits. Studio tracks real-time progress.

---

## 💻 Getting Started (Development Journey)

### Prerequisites
- **Bun** (v1.3+)
- **PostgreSQL** instance
- **Redis** server (v7.2+)
- **S3 Compatible Object Storage** (AWS, Cloudflare R2, MinIO, Supabase Storage, etc.)
- **SMTP Credentials** (for automated emails)

### 1. Installation

Clone the repository and install all workspace packages utilizing bun's ultra fast tooling:

```bash
git clone https://github.com/agpprastyo/kirim-karya.git
cd KirimKarya
bun install
```

### 2. Environment Setup

Copy `.env.example` to `.env` (located at the root) and specify all necessary connection strings for the Database, Redis cluster, S3 Bucket configuration, and SMTP settings.

```bash
cp .env.example .env
```
*(All `apps` and `packages` automatically resolve this root `.env` through type-safe `env.ts` configuration files using Zod).*

### 3. Database Migration & Seeding

Sync the Drizzle-defined schema to your database.

```bash
cd packages/db
bun run db:push
```

### 4. Running the Project

Start the entire monorepo stack with a single command (API, Frontend, and Workers will start concurrently in watch mode).

```bash
make dev
```
- API will be available at `http://localhost:3000`
- Web Dashboard will be available at `http://localhost:5173`
- Worker metrics and queue runners act autonomously in the background.

---

## 🛡️ Security Measures

- **Zero-Trust Access:** S3 objects are completely isolated. The public cannot access files directly. Client views route securely through the `apps/api` Image Controller which validates gallery status.
- **Data Protection:** Passwords securely hashed via built-in `Bun.password`, and dynamic watermarking prevents theft of raw image assets during proofing.
- **Strict Parameter Validation:** Zod schemas validate every single API endpoint boundary against Injection attacks and IDOR vulnerabilities.

<br />
