<script lang="ts">
    import { page } from "$app/state";
    import { api as apiClient } from "$lib/api";
    import { onMount } from "svelte";
    import { Motion, AnimatePresence } from "svelte-motion";
    import Alert from "$lib/components/Alert.svelte";
    import UploadStatus from "$lib/components/UploadStatus.svelte";

    let galleryId = page.params.id;
    let gallery = $state<any>(null);
    let isLoading = $state(true);
    let isUploading = $state(false);
    let uploadStats = $state({ total: 0, completed: 0, failed: 0 });
    let files = $state<FileList | null>(null);

    let photoList = $state<any[]>([]);
    let isPhotosLoading = $state(true);

    let isSettingsOpen = $state(false);
    let settingsError = $state("");
    let isSaving = $state(false);
    let isDelivering = $state(false);
    let alertRef = $state<any>(null);

    let editForm = $state({
        title: "",
        clientEmail: "",
        status: "DRAFT",
        isPrivate: false,
        accessMode: "OTP",
        allowedEmails: "",
        password: "",
        expiresAt: "",
    });

    async function fetchPhotos() {
        try {
            const res = await (apiClient as any).api.photos.galleries[
                ":id"
            ].photos.$get({
                param: { id: galleryId },
            });
            if (res.ok) {
                const data = await res.json();
                photoList = data.data;
            }
        } finally {
            isPhotosLoading = false;
        }
    }

    function openSettings() {
        editForm = {
            title: gallery.title,
            clientEmail: gallery.clientEmail || "",
            status: gallery.status || "DRAFT",
            isPrivate: gallery.isPrivate || false,
            accessMode: gallery.accessMode || "OTP",
            allowedEmails: (gallery.allowedEmails || []).join(", "),
            password: "", // Don't show existing password
            expiresAt: gallery.expiresAt
                ? new Date(gallery.expiresAt).toISOString().split("T")[0]
                : "",
        };
        isSettingsOpen = true;
    }

    async function saveSettings(notify: boolean = false) {
        isSaving = true;
        settingsError = "";
        try {
            const payload: any = {
                title: editForm.title,
                clientEmail: editForm.clientEmail || null,
                status: editForm.status,
                isPrivate: editForm.isPrivate,
                accessMode: editForm.accessMode,
                allowedEmails: editForm.allowedEmails
                    ? editForm.allowedEmails
                          .split(/[,\s]+/)
                          .filter((e) => e.includes("@"))
                    : [],
                expiresAt: editForm.expiresAt
                    ? new Date(editForm.expiresAt).toISOString()
                    : null,
                notify: notify,
            };

            if (editForm.password && editForm.password.length >= 4) {
                payload.password = editForm.password;
            }

            const res = await (apiClient as any).api.galleries[":id"].$put({
                //@ts-ignore
                param: { id: galleryId },
                json: payload,
            });

            if (res.ok) {
                const data = await res.json();
                gallery = data.data;
                isSettingsOpen = false;
                alertRef.show(
                    notify
                        ? "Settings saved and clients notified!"
                        : "Settings updated successfully!",
                    "success",
                );
            } else {
                const err = await res.json();
                settingsError = err.error || "Failed to update settings";
            }
        } catch (e: any) {
            settingsError = e.message;
        } finally {
            isSaving = false;
        }
    }

    onMount(async () => {
        await refreshGallery();
    });

    async function refreshGallery() {
        try {
            const res = await (apiClient as any).api.galleries[":id"].$get({
                param: { id: galleryId },
            });
            if (res.ok) {
                const data = await res.json();
                gallery = data.data;
            }
            await fetchPhotos();
        } finally {
            isLoading = false;
        }
    }

    // Polling for delivery status
    $effect(() => {
        if (
            gallery?.deliveryStatus === "QUEUED" ||
            gallery?.deliveryStatus === "PROCESSING"
        ) {
            const interval = setInterval(async () => {
                const res = await (apiClient as any).api.galleries[":id"].$get({
                    param: { id: galleryId },
                });
                if (res.ok) {
                    const data = await res.json();
                    gallery = data.data;
                    if (
                        gallery.deliveryStatus === "COMPLETED" ||
                        gallery.deliveryStatus === "FAILED"
                    ) {
                        clearInterval(interval);
                    }
                }
            }, 3000);
            return () => clearInterval(interval);
        }
    });

    // Refresh photo status every 5 seconds if there are processing photos
    $effect(() => {
        const hasProcessing = photoList.some(
            (p) => p.status === "PENDING" || p.status === "PROCESSING",
        );
        if (hasProcessing) {
            const interval = setInterval(fetchPhotos, 5000);
            return () => clearInterval(interval);
        }
    });

    async function handleUpload() {
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        isUploading = true;
        uploadStats = { total: fileArray.length, completed: 0, failed: 0 };
        files = null; // Clear input

        const CONCURRENCY = 4;
        const queue = [...fileArray];
        const activeUploads: Promise<void>[] = [];

        const uploadFile = async (file: File) => {
            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch(
                    `${(apiClient as any).api.photos.galleries[
                        ":id"
                    ].photos.$url({
                        param: { id: galleryId },
                    })}`,
                    {
                        method: "POST",
                        body: formData,
                        credentials: "include",
                    },
                );

                if (res.ok) {
                    uploadStats.completed++;
                    // Non-blocking refresh to show thumbnails as they appear
                    fetchPhotos();
                } else {
                    uploadStats.failed++;
                }
            } catch (e) {
                console.error("Upload failed for file:", file.name, e);
                uploadStats.failed++;
            }
        };

        while (queue.length > 0 || activeUploads.length > 0) {
            while (activeUploads.length < CONCURRENCY && queue.length > 0) {
                const file = queue.shift()!;
                const promise = uploadFile(file).then(() => {
                    activeUploads.splice(activeUploads.indexOf(promise), 1);
                });
                activeUploads.push(promise);
            }
            await Promise.race(activeUploads);
        }

        // Wait a bit then hide overlay or keep it as "Finished"
        setTimeout(() => {
            if (
                uploadStats.completed + uploadStats.failed ===
                uploadStats.total
            ) {
                // Keep it for 3 seconds if finished
                setTimeout(() => {
                    if (!isUploading)
                        uploadStats = { total: 0, completed: 0, failed: 0 };
                }, 3000);
            }
            isUploading = false;
        }, 500);

        await fetchPhotos();
    }

    function copyShareLink() {
        const url = `${window.location.origin}/g/${galleryId}`;
        navigator.clipboard.writeText(url);
        alertRef.show("Public link copied to clipboard!", "success");
    }

    async function startDelivery() {
        if (isDelivering) return;
        isDelivering = true;
        try {
            const res = await (apiClient as any).api.galleries[
                ":id"
            ].deliver.$post({
                param: { id: galleryId },
            });
            if (res.ok) {
                alertRef.show(
                    "Delivery process started! We will notify clients once ZIP is ready.",
                    "success",
                );
                await refreshGallery();
            } else {
                const err = await res.json();
                alertRef.show(err.error || "Failed to start delivery", "error");
            }
        } catch (e: any) {
            alertRef.show(e.message, "error");
        } finally {
            isDelivering = false;
        }
    }
</script>

<Alert bind:this={alertRef} />

<div class="space-y-12 pb-20">
    {#if isLoading}
        <div class="animate-pulse space-y-8">
            <div class="h-10 bg-base-200 rounded w-1/3"></div>
            <div class="h-64 bg-base-100 rounded-3xl"></div>
        </div>
    {:else if !gallery}
        <div class="text-center py-20">
            <h1 class="text-2xl font-bold italic opacity-30">
                Gallery not found
            </h1>
        </div>
    {:else}
        <!-- Header -->
        <Motion
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            <div class="flex items-end justify-between">
                <div>
                    <div class="flex items-center gap-3 mb-4">
                        <a
                            href="/dashboard/galleries"
                            class="btn btn-ghost btn-sm rounded-xl px-2 opacity-50 hover:opacity-100"
                            aria-label="Back to Galleries"
                        >
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </a>
                        <span
                            class="badge badge-primary font-black text-[10px] tracking-widest uppercase px-2 py-0"
                            >{gallery.status}</span
                        >
                        {#if gallery.isPrivate}
                            <span
                                class="badge badge-secondary font-black text-[10px] tracking-widest uppercase px-2 py-0"
                                >Private</span
                            >
                        {/if}
                        <button
                            onclick={copyShareLink}
                            class="badge badge-outline font-black text-[10px] tracking-widest uppercase px-2 py-0 cursor-pointer hover:bg-base-content hover:text-base-100 transition-colors"
                        >
                            Copy Share Link
                        </button>
                    </div>
                    <h1
                        class="text-5xl font-black tracking-tight leading-tight"
                    >
                        {gallery.title}
                    </h1>
                    <p class="text-xl text-base-content/50 mt-2 font-medium">
                        {gallery.clientEmail || "No client assigned"}
                    </p>
                </div>

                <div class="flex gap-4">
                    <button
                        onclick={openSettings}
                        class="btn btn-ghost rounded-2xl font-black px-6 border border-base-content/10"
                        >Settings</button
                    >
                    <button
                        class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20"
                        >Publish Gallery</button
                    >
                </div>
            </div>
        </Motion>

        <!-- Dashboard Grid -->
        <div class="grid lg:grid-cols-3 gap-8">
            <!-- Left: Photos -->
            <div class="lg:col-span-2 space-y-8">
                <!-- Upload Area -->
                <div
                    class="card bg-base-100 border border-base-content/5 shadow-sm overflow-hidden rounded-[2.5rem]"
                >
                    <div
                        class="p-12 text-center border-b border-base-content/5 bg-primary/5"
                    >
                        <h2 class="text-2xl font-black mb-2">Upload Photos</h2>
                        <div class="max-w-xl mx-auto">
                            <input
                                type="file"
                                id="photo-upload"
                                multiple
                                accept="image/*"
                                bind:files
                                class="hidden"
                            />
                            <label
                                for="photo-upload"
                                class="flex flex-col items-center justify-center border-2 border-dashed border-primary/20 bg-base-100 rounded-4xl p-8 cursor-pointer hover:border-primary/50 transition-all group"
                            >
                                <p class="text-lg font-black">
                                    {files
                                        ? `${files.length} files selected`
                                        : "Click or drop photos here"}
                                </p>
                            </label>

                            {#if files}
                                <div
                                    class="mt-8 flex items-center justify-center gap-4"
                                >
                                    <button
                                        onclick={handleUpload}
                                        disabled={isUploading}
                                        class="btn btn-primary rounded-2xl font-black px-12 h-14"
                                    >
                                        {#if isUploading}
                                            <span
                                                class="loading loading-spinner"
                                            ></span>
                                            Uploading...
                                        {:else}
                                            Start Upload
                                        {/if}
                                    </button>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Photo Management -->
                    <div class="p-8">
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="text-xl font-black">Managed Photos</h3>
                            <button
                                onclick={fetchPhotos}
                                class="btn btn-ghost btn-xs font-black"
                                >Refresh Status</button
                            >
                        </div>

                        {#if isPhotosLoading}
                            <div class="grid grid-cols-4 gap-4">
                                {#each Array(4) as _}
                                    <div
                                        class="aspect-square bg-base-200 rounded-2xl animate-pulse"
                                    ></div>
                                {/each}
                            </div>
                        {:else if photoList.length === 0}
                            <div
                                class="aspect-video bg-base-200 rounded-2xl flex items-center justify-center border-2 border-dashed border-base-content/5 opacity-30 italic font-bold"
                            >
                                No photos uploaded yet
                            </div>
                        {:else}
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {#each photoList as photo}
                                    <Motion
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            delay:
                                                0.05 *
                                                (photo.id.charCodeAt(0) % 10),
                                        }}
                                        whileHover={{ y: -5, scale: 1.02 }}
                                    >
                                        <div
                                            class="group relative aspect-square bg-base-200 rounded-2xl overflow-hidden border border-base-content/5 shadow-sm hover:shadow-xl transition-shadow"
                                        >
                                            {#if photo.thumbnailUrl}
                                                <img
                                                    src={photo.thumbnailUrl}
                                                    alt={photo.filename}
                                                    crossorigin="use-credentials"
                                                    class="w-full h-full object-cover"
                                                />
                                            {:else}
                                                <div
                                                    class="w-full h-full flex items-center justify-center"
                                                >
                                                    <span
                                                        class="loading loading-spinner loading-md opacity-20"
                                                    ></span>
                                                </div>
                                            {/if}

                                            <!-- Info Overlay -->
                                            <div
                                                class="absolute inset-x-0 bottom-0 p-3 bg-linear-to-t from-black/80 to-transparent text-white translate-y-full group-hover:translate-y-0 transition-transform"
                                            >
                                                <p
                                                    class="text-[10px] font-black truncate"
                                                >
                                                    {photo.filename}
                                                </p>
                                                <div
                                                    class="flex items-center justify-between mt-1"
                                                >
                                                    <span
                                                        class="text-[9px] font-bold uppercase tracking-widest px-1 bg-white/20 rounded"
                                                        >{photo.status}</span
                                                    >
                                                    {#if photo.selectionCount > 0}
                                                        <span
                                                            class="text-[9px] font-black text-primary flex items-center gap-1"
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                viewBox="0 0 24 24"
                                                                fill="currentColor"
                                                                class="size-2"
                                                            >
                                                                <path
                                                                    d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z"
                                                                />
                                                            </svg>
                                                            {photo.selectionCount}
                                                        </span>
                                                    {/if}
                                                </div>
                                            </div>
                                        </div>
                                    </Motion>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Right: Insights & Deliver -->
            <div class="space-y-8">
                <div
                    class="card bg-base-100 border border-base-content/5 p-8 rounded-4xl space-y-6"
                >
                    <h3 class="text-xl font-black">Gallery Insights</h3>
                    <div class="grid grid-cols-2 gap-4">
                        <div class="bg-base-200/50 p-6 rounded-3xl">
                            <p class="text-xs font-bold opacity-40 mb-1">
                                TOTAL PHOTOS
                            </p>
                            <p class="text-3xl font-black">
                                {photoList.length}
                            </p>
                        </div>
                        <div class="bg-primary/5 p-6 rounded-3xl text-primary">
                            <p class="text-xs font-bold opacity-60 mb-1">
                                SELECTED
                            </p>
                            <p class="text-3xl font-black">
                                {photoList.filter((p) => p.selectionCount > 0)
                                    .length}
                            </p>
                        </div>
                    </div>

                    <div class="pt-4">
                        <p class="text-sm font-medium text-base-content/60">
                            The client can view this gallery at:
                        </p>
                        <div
                            class="mt-2 p-4 bg-base-200 rounded-2xl flex items-center justify-between gap-4 overflow-hidden"
                        >
                            <code class="text-xs font-bold truncate opacity-50">
                                /g/{galleryId}
                            </code>
                            <button
                                onclick={copyShareLink}
                                class="btn btn-ghost btn-xs font-black shrink-0"
                                >Copy</button
                            >
                        </div>
                    </div>
                </div>

                <div
                    class="card bg-primary text-primary-content p-8 rounded-4xl shadow-2xl shadow-primary/30"
                >
                    <h3 class="text-xl font-black mb-2">Ready to Deliver?</h3>
                    <p class="text-sm font-medium opacity-80 mb-6">
                        Once the client has finished selecting ({gallery.selectionCount}
                        photos), you can generate high-res downloads.
                    </p>

                    {#if gallery.deliveryStatus === "COMPLETED"}
                        <div class="space-y-3">
                            <div
                                class="bg-white/10 p-4 rounded-2xl flex items-center justify-between"
                            >
                                <span
                                    class="font-bold text-xs uppercase opacity-70"
                                    >Status</span
                                >
                                <span
                                    class="badge badge-success font-black text-[10px] uppercase"
                                    >Ready</span
                                >
                            </div>
                            <button
                                onclick={startDelivery}
                                class="btn btn-white w-full rounded-2xl font-black h-14"
                                disabled={isDelivering}
                            >
                                {#if isDelivering}
                                    <span
                                        class="loading loading-spinner loading-xs"
                                    ></span>
                                {:else}
                                    Regenerate ZIP
                                {/if}
                            </button>
                            <p
                                class="text-[10px] text-center opacity-70 font-bold uppercase italic"
                            >
                                * Regeneration will overwrite the previous ZIP.
                            </p>
                        </div>
                    {:else if gallery.deliveryStatus === "QUEUED" || gallery.deliveryStatus === "PROCESSING"}
                        <div
                            class="bg-white/10 p-6 rounded-3xl text-center space-y-4"
                        >
                            <span class="loading loading-spinner loading-lg"
                            ></span>
                            <p
                                class="font-black text-sm uppercase tracking-widest"
                            >
                                {gallery.deliveryStatus === "QUEUED"
                                    ? "Waiting in Queue..."
                                    : "Creating ZIP..."}
                            </p>
                            <p class="text-[10px] opacity-70">
                                Please stay on this page or wait for the email
                                notification.
                            </p>
                        </div>
                    {:else}
                        <button
                            onclick={startDelivery}
                            class="btn btn-white w-full rounded-2xl font-black h-14"
                            disabled={isDelivering ||
                                gallery.selectionCount === 0}
                        >
                            {#if isDelivering}
                                <span class="loading loading-spinner loading-xs"
                                ></span>
                            {:else}
                                Start Delivery ({gallery.selectionCount} Selected)
                            {/if}
                        </button>
                        {#if gallery.deliveryStatus === "FAILED"}
                            <p
                                class="text-xs text-error-content font-bold mt-2 text-center bg-error/20 py-2 rounded-lg"
                            >
                                Last attempt failed. Please try again.
                            </p>
                        {/if}
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    <UploadStatus
        {isUploading}
        total={uploadStats.total}
        completed={uploadStats.completed}
        failed={uploadStats.failed}
    />
</div>

<!-- Settings Modal -->
{#if isSettingsOpen}
    <div class="modal modal-open">
        <div
            class="modal-box max-w-2xl rounded-4xl p-8 border border-base-content/5"
        >
            <h3 class="text-2xl font-black mb-6">Gallery Settings</h3>

            {#if settingsError}
                <div
                    class="alert alert-error mb-6 rounded-2xl text-xs font-bold"
                >
                    {settingsError}
                </div>
            {/if}

            <div class="space-y-6">
                <!-- Basic Info -->
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="form-control w-full">
                        <label class="label" for="gallery-title"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Gallery Title</span
                            ></label
                        >
                        <input
                            id="gallery-title"
                            type="text"
                            bind:value={editForm.title}
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="client-email"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Client Emails (Comma separated)</span
                            ></label
                        >
                        <input
                            id="client-email"
                            type="text"
                            bind:value={editForm.clientEmail}
                            placeholder="client1@mail.com, client2@mail.com"
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                </div>

                <!-- Gallery Status -->
                <div class="bg-base-200/50 p-6 rounded-3xl space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-black text-sm">
                                Gallery Visibility
                            </div>
                            <div
                                class="text-[10px] opacity-40 font-bold uppercase"
                            >
                                {editForm.status === "PUBLISHED"
                                    ? "Visible to clients"
                                    : "Only you can see this"}
                            </div>
                        </div>
                        <div
                            class="join bg-base-100 p-1 rounded-2xl border border-base-content/5"
                        >
                            <button
                                class="join-item btn btn-sm rounded-xl font-black {editForm.status ===
                                'DRAFT'
                                    ? 'btn-primary'
                                    : 'btn-ghost'}"
                                onclick={() => (editForm.status = "DRAFT")}
                                >Draft</button
                            >
                            <button
                                class="join-item btn btn-sm rounded-xl font-black {editForm.status ===
                                'PUBLISHED'
                                    ? 'btn-primary'
                                    : 'btn-ghost'}"
                                onclick={() => (editForm.status = "PUBLISHED")}
                                >Publish</button
                            >
                        </div>
                    </div>
                </div>

                <div class="bg-base-200/50 p-6 rounded-3xl space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-black text-sm">
                                Private Access Protection
                            </div>
                            <div
                                class="text-[10px] opacity-40 font-bold uppercase"
                            >
                                Require identification to view gallery
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            bind:checked={editForm.isPrivate}
                            class="toggle toggle-primary"
                        />
                    </div>

                    {#if editForm.isPrivate}
                        <div
                            class="space-y-4 animate-in fade-in slide-in-from-top-2"
                        >
                            <div class="form-control w-full">
                                <div class="px-1 py-2">
                                    <span
                                        class="label-text font-black uppercase text-[10px] opacity-40"
                                        >Access Mode</span
                                    >
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <button
                                        class="btn btn-outline rounded-2xl font-black {editForm.accessMode ===
                                        'OTP'
                                            ? 'btn-primary'
                                            : 'opacity-50'}"
                                        onclick={() =>
                                            (editForm.accessMode = "OTP")}
                                    >
                                        OTP Code
                                        <div class="text-[8px] opacity-60">
                                            Secure via Email
                                        </div>
                                    </button>
                                    <button
                                        class="btn btn-outline rounded-2xl font-black {editForm.accessMode ===
                                        'PASSWORD'
                                            ? 'btn-primary'
                                            : 'opacity-50'}"
                                        onclick={() =>
                                            (editForm.accessMode = "PASSWORD")}
                                    >
                                        Static Password
                                        <div class="text-[8px] opacity-60">
                                            One key for all
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div class="form-control w-full">
                                <label class="label" for="allowed-emails"
                                    ><span
                                        class="label-text font-black uppercase text-[10px] opacity-40"
                                        >Authorized Access Emails (Whitelist)</span
                                    ></label
                                >
                                <textarea
                                    id="allowed-emails"
                                    bind:value={editForm.allowedEmails}
                                    placeholder="client@gmail.com, assistant@gmail.com"
                                    class="textarea textarea-bordered rounded-2xl font-bold h-24"
                                ></textarea>
                                <p
                                    class="text-[9px] mt-2 opacity-50 font-bold uppercase italic"
                                >
                                    * These emails will be allowed to request
                                    OTP or enter password.
                                </p>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Security & Exp -->
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="form-control w-full">
                        <label class="label" for="gallery-password"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Protection Password (Optional)</span
                            ></label
                        >
                        <input
                            id="gallery-password"
                            type="password"
                            bind:value={editForm.password}
                            placeholder="••••••••"
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="gallery-expires"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Expiration Date</span
                            ></label
                        >
                        <input
                            id="gallery-expires"
                            type="date"
                            bind:value={editForm.expiresAt}
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                </div>
            </div>

            <div class="modal-action mt-8 flex flex-wrap gap-2 justify-end">
                <button
                    class="btn btn-ghost rounded-2xl font-black px-6"
                    onclick={() => (isSettingsOpen = false)}>Cancel</button
                >
                <button
                    class="btn btn-primary btn-outline rounded-2xl font-black px-8 h-14"
                    onclick={() => saveSettings(true)}
                    disabled={isSaving}
                >
                    Save & Notify Clients
                </button>
                <button
                    class="btn btn-primary rounded-2xl font-black px-12 h-14 shadow-xl shadow-primary/20"
                    onclick={() => saveSettings(false)}
                    disabled={isSaving}
                >
                    {#if isSaving}
                        <span class="loading loading-spinner"></span>
                    {:else}
                        Save Settings
                    {/if}
                </button>
            </div>
        </div>
        <button
            class="modal-backdrop bg-black/40 backdrop-blur-sm focus:outline-none"
            onclick={() => (isSettingsOpen = false)}
            aria-label="Close Settings Modal"
        ></button>
    </div>
{/if}
