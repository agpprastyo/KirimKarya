<script lang="ts">
    import { page } from "$app/state";
    import { api as apiClient, handleResponse } from "$lib/api";
    import { createQuery, createMutation, useQueryClient } from "@tanstack/svelte-query";
    import { Motion, AnimatePresence } from "svelte-motion";
    import Alert from "$lib/components/Alert.svelte";
    import UploadStatus from "$lib/components/UploadStatus.svelte";

    const galleryId = page.params.id;
    const queryClient = useQueryClient();
    let alertRef = $state<{
        show: (message: string, type: "success" | "error") => void;
    } | null>(null);

    // -- QUERIES --

    const galleryQuery = createQuery(() => ({
        queryKey: ["galleries", galleryId],
        queryFn: () => handleResponse(apiClient.api.galleries[":id"].$get({
            param: { id: galleryId },
        })).then(res => res.data)
    }));

    const photosQuery = createQuery(() => ({
        queryKey: ["galleries", galleryId, "photos"],
        queryFn: () => handleResponse(apiClient.api.photos.galleries[":id"].photos.$get({
            param: { id: galleryId },
        })).then(res => res.data)
    }));

    // -- MUTATIONS --

    const updateGalleryMutation = createMutation(() => ({
        mutationFn: (payload: any) => handleResponse(apiClient.api.galleries[":id"].$put({
            param: { id: galleryId },
            json: payload,
        })).then(res => res.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] });
        }
    }));

    const deliverMutation = createMutation(() => ({
        mutationFn: () => handleResponse(apiClient.api.galleries[":id"].deliver.$post({
            param: { id: galleryId },
        })),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] });
            alertRef?.show("Delivery process started! We will notify clients once ZIP is ready.", "success");
        },
        onError: (error: Error) => {
            alertRef?.show(error.message, "error");
        }
    }));

    // -- UI STATE --

    let isUploading = $state(false);
    let uploadStats = $state({ total: 0, completed: 0, failed: 0 });
    let files = $state<FileList | null>(null);

    let isSettingsOpen = $state(false);
    let settingsError = $state("");

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

    function openSettings() {
        const gallery = galleryQuery.data;
        if (!gallery) return;
        editForm = {
            title: gallery.title,
            clientEmail: gallery.clientEmail || "",
            status: (gallery.status as any) || "DRAFT",
            isPrivate: gallery.isPrivate || false,
            accessMode: (gallery.accessMode as any) || "OTP",
            allowedEmails: (gallery.allowedEmails || []).join(", "),
            password: "",
            expiresAt: gallery.expiresAt
                ? new Date(gallery.expiresAt).toISOString().split("T")[0]
                : "",
        };
        isSettingsOpen = true;
    }

    async function handleSaveSettings(notify: boolean = false) {
        settingsError = "";
        try {
            const payload = {
                title: editForm.title,
                clientEmail: editForm.clientEmail || null,
                status: editForm.status as any,
                isPrivate: editForm.isPrivate,
                accessMode: editForm.accessMode as any,
                allowedEmails: editForm.allowedEmails
                    ? editForm.allowedEmails
                          .split(/[,\s]+/)
                          .filter((e) => e.includes("@"))
                    : [],
                expiresAt: editForm.expiresAt
                    ? new Date(editForm.expiresAt).toISOString()
                    : null,
                notify: notify,
                password:
                    editForm.password && editForm.password.length >= 4
                        ? editForm.password
                        : undefined,
            };

            await updateGalleryMutation.mutateAsync(payload);
            isSettingsOpen = false;
            alertRef?.show(
                notify
                    ? "Settings saved and clients notified!"
                    : "Settings updated successfully!",
                "success",
            );
        } catch (e: any) {
            settingsError = e.message;
        }
    }

    // Polling for delivery status
    $effect(() => {
        const gallery = galleryQuery.data;
        if (
            gallery?.deliveryStatus === "QUEUED" ||
            gallery?.deliveryStatus === "PROCESSING"
        ) {
            const interval = setInterval(() => {
                queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] });
            }, 3000);
            return () => clearInterval(interval);
        }
    });

    // Refresh photo status every 5 seconds if there are processing photos
    $effect(() => {
        const photoList = photosQuery.data || [];
        const hasProcessing = photoList.some(
            (p) => p.status === "PENDING" || p.status === "PROCESSING",
        );
        if (hasProcessing) {
            const interval = setInterval(() => {
                queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
            }, 5000);
            return () => clearInterval(interval);
        }
    });

    async function handleUpload() {
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        isUploading = true;
        uploadStats = { total: fileArray.length, completed: 0, failed: 0 };
        files = null;

        const CONCURRENCY = 4;
        const queue = [...fileArray];
        const activeUploads: Promise<void>[] = [];

        const uploadFile = async (file: File) => {
            try {
                const formData = new FormData();
                formData.append("file", file);

                const url = apiClient.api.photos.galleries[":id"].photos.$url({
                    param: { id: galleryId },
                });

                const res = await fetch(url.toString(), {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                });

                if (res.ok) {
                    uploadStats.completed++;
                    queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
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

        setTimeout(() => {
            if (uploadStats.completed + uploadStats.failed === uploadStats.total) {
                setTimeout(() => {
                    if (!isUploading)
                        uploadStats = { total: 0, completed: 0, failed: 0 };
                }, 3000);
            }
            isUploading = false;
        }, 500);

        queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
    }

    function copyShareLink() {
        const url = `${window.location.origin}/g/${galleryId}`;
        navigator.clipboard.writeText(url);
        alertRef?.show("Public link copied to clipboard!", "success");
    }
</script>

<Alert bind:this={alertRef} />

<div class="space-y-12 pb-20">
    {#if galleryQuery.isLoading}
        <div class="animate-pulse space-y-8">
            <div class="h-10 bg-base-200 rounded w-1/3"></div>
            <div class="h-64 bg-base-100 rounded-3xl"></div>
        </div>
    {:else if galleryQuery.error}
        <div class="alert alert-error">
            <span>Error loading gallery: {galleryQuery.error.message}</span>
        </div>
    {:else if !galleryQuery.data}
        <div class="text-center py-20">
            <h1 class="text-2xl font-bold italic opacity-30">
                Gallery not found
            </h1>
        </div>
    {:else}
        {@const gallery = galleryQuery.data}
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
                                onclick={() => queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] })}
                                class="btn btn-ghost btn-xs font-black"
                                >Refresh Status</button
                            >
                        </div>

                        {#if photosQuery.isLoading}
                            <div class="grid grid-cols-4 gap-4">
                                {#each Array(4) as _}
                                    <div
                                        class="aspect-square bg-base-200 rounded-2xl animate-pulse"
                                    ></div>
                                {/each}
                            </div>
                        {:else if !photosQuery.data || photosQuery.data.length === 0}
                            <div
                                class="aspect-video bg-base-200 rounded-2xl flex items-center justify-center border-2 border-dashed border-base-content/5 opacity-30 italic font-bold"
                            >
                                No photos uploaded yet
                            </div>
                        {:else}
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {#each photosQuery.data as photo}
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
                                {photosQuery.data?.length || 0}
                            </p>
                        </div>
                        <div class="bg-primary/5 p-6 rounded-3xl text-primary">
                            <p class="text-xs font-bold opacity-60 mb-1">
                                SELECTED
                            </p>
                            <p class="text-3xl font-black">
                                {(photosQuery.data || []).filter((p) => p.selectionCount > 0).length}
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
                                onclick={() => deliverMutation.mutate()}
                                class="btn btn-white w-full rounded-2xl font-black h-14"
                                disabled={deliverMutation.isPending}
                            >
                                {#if deliverMutation.isPending}
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
                            onclick={() => deliverMutation.mutate()}
                            class="btn btn-white w-full rounded-2xl font-black h-14"
                            disabled={deliverMutation.isPending || gallery.selectionCount === 0}
                        >
                            {#if deliverMutation.isPending}
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
                                        One-Time Password (Email)
                                    </button>
                                    <button
                                        class="btn btn-outline rounded-2xl font-black {editForm.accessMode ===
                                        'PASSWORD'
                                            ? 'btn-primary'
                                            : 'opacity-50'}"
                                        onclick={() =>
                                            (editForm.accessMode = "PASSWORD")}
                                    >
                                        Shared Password
                                    </button>
                                </div>
                            </div>

                            {#if editForm.accessMode === "OTP"}
                                <div class="form-control w-full">
                                    <label class="label" for="allowed-emails"
                                        ><span
                                            class="label-text font-black uppercase text-[10px] opacity-40"
                                            >Allowed Guest Emails (Comma
                                            separated)</span
                                        ></label
                                    >
                                    <textarea
                                        id="allowed-emails"
                                        bind:value={editForm.allowedEmails}
                                        class="textarea textarea-bordered rounded-2xl font-bold h-24"
                                        placeholder="friend@mail.com, mom@mail.com"
                                    ></textarea>
                                </div>
                            {:else}
                                <div class="form-control w-full">
                                    <label class="label" for="access-password"
                                        ><span
                                            class="label-text font-black uppercase text-[10px] opacity-40"
                                            >Guest Password (Min 4 chars)</span
                                        ></label
                                    >
                                    <input
                                        id="access-password"
                                        type="password"
                                        bind:value={editForm.password}
                                        placeholder="Keep empty to leave unchanged"
                                        class="input input-bordered rounded-2xl font-bold"
                                    />
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div class="form-control w-full">
                        <label class="label" for="expiry-date"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Expiry Date (Optional)</span
                            ></label
                        >
                        <input
                            id="expiry-date"
                            type="date"
                            bind:value={editForm.expiresAt}
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                </div>
            </div>

            <div class="modal-action flex justify-between mt-10">
                <button
                    class="btn btn-ghost rounded-2xl font-black hover:bg-error/10 hover:text-error"
                    onclick={() => (isSettingsOpen = false)}>Cancel</button
                >
                <div class="flex gap-3">
                    <button
                        onclick={() => handleSaveSettings(false)}
                        disabled={updateGalleryMutation.isPending}
                        class="btn btn-ghost border border-base-content/10 rounded-2xl font-black px-6"
                    >
                        {#if updateGalleryMutation.isPending}
                            <span class="loading loading-spinner loading-xs"
                            ></span>
                        {:else}
                            Save Only
                        {/if}
                    </button>
                    <button
                        onclick={() => handleSaveSettings(true)}
                        disabled={updateGalleryMutation.isPending}
                        class="btn btn-primary rounded-2xl font-black px-10 shadow-xl shadow-primary/20"
                    >
                        {#if updateGalleryMutation.isPending}
                            <span class="loading loading-spinner loading-xs"
                            ></span>
                        {:else}
                            Save & Notify Clients
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    :global(body) {
        background-color: #fafafa;
    }
</style>
