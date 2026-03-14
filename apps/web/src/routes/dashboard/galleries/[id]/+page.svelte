<script lang="ts">
    import { page } from "$app/state";
    import { api } from "$lib/api";
    import { onMount } from "svelte";

    let galleryId = page.params.id;
    let gallery = $state<any>(null);
    let isLoading = $state(true);
    let isUploading = $state(false);
    let uploadProgress = $state(0);
    let files = $state<FileList | null>(null);

    let photoList = $state<any[]>([]);
    let isPhotosLoading = $state(true);

    async function fetchPhotos() {
        try {
            const res = await api.api.photos.galleries[":id"].photos.$get({
                //@ts-ignore - param exists in route definition
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

    onMount(async () => {
        try {
            const res = await api.api.galleries[":id"].$get({
                //@ts-ignore - param exists in route definition
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

        isUploading = true;
        let completed = 0;

        for (const file of Array.from(files)) {
            try {
                const formData = new FormData();
                formData.append("file", file);

                const res = await fetch(
                    `${api.api.photos.galleries[":id"].photos.$url({
                        //@ts-ignore - param exists in route definition
                        param: { id: galleryId },
                    })}`,
                    {
                        method: "POST",
                        body: formData,
                        credentials: "include",
                    },
                );

                if (res.ok) {
                    completed++;
                    uploadProgress = Math.round(
                        (completed / files.length) * 100,
                    );
                }
            } catch (e) {
                console.error("Upload failed for file:", file.name, e);
            }
        }

        isUploading = false;
        uploadProgress = 0;
        files = null;
        await fetchPhotos();
    }

    function copyShareLink() {
        const url = `${window.location.origin}/g/${galleryId}`;
        navigator.clipboard.writeText(url);
        alert("Public link copied to clipboard!");
    }
</script>

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
                    <button
                        onclick={copyShareLink}
                        class="badge badge-outline font-black text-[10px] tracking-widest uppercase px-2 py-0 cursor-pointer hover:bg-base-content hover:text-base-100 transition-colors"
                    >
                        Copy Share Link
                    </button>
                </div>
                <h1 class="text-5xl font-black tracking-tight leading-tight">
                    {gallery.title}
                </h1>
                <p class="text-xl text-base-content/50 mt-2 font-medium">
                    {gallery.clientEmail || "No client assigned"}
                </p>
            </div>

            <div class="flex gap-4">
                <button
                    class="btn btn-ghost rounded-2xl font-black px-6 border border-base-content/10"
                    >Settings</button
                >
                <button
                    class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20"
                    >Publish Gallery</button
                >
            </div>
        </div>

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
                                            {uploadProgress}%
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
                                    <div
                                        class="group relative aspect-square bg-base-200 rounded-2xl overflow-hidden border border-base-content/5"
                                    >
                                        {#if photo.thumbnailUrl}
                                            <img
                                                src={photo.thumbnailUrl}
                                                alt={photo.filename}
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
                                            class="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white translate-y-full group-hover:translate-y-0 transition-transform"
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
                        Once the client has finished selecting, you can generate
                        high-res downloads.
                    </p>
                    <button
                        class="btn btn-white w-full rounded-2xl font-black h-14"
                        disabled>Start Delivery</button
                    >
                </div>
            </div>
        </div>
    {/if}
</div>
