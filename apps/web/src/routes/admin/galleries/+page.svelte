<script lang="ts">
    import { api as apiClient } from "$lib/api";
    import { onMount } from "svelte";

    interface GalleryItem {
        id: string;
        title: string;
        clientEmail: string | null;
        status: string;
        accessMode: string;
        views: number;
        createdAt: string;
        user: {
            id: string;
            name: string;
            email: string;
        };
        photoCount: number;
    }

    let galleries = $state<GalleryItem[]>([]);
    let totalGalleries = $state(0);
    let loading = $state(true);
    let searchValue = $state("");
    let limit = $state(10);
    let offset = $state(0);

    // Toast alerts
    let toastMessage = $state("");
    let toastType = $state<"success" | "error" | "info">("info");
    let showToast = $state(false);

    function triggerToast(message: string, type: "success" | "error" | "info" = "success") {
        toastMessage = message;
        toastType = type;
        showToast = true;
        setTimeout(() => {
            showToast = false;
        }, 3000);
    }

    // Modal state for deletions
    let isDeleteModalOpen = $state(false);
    let galleryToDelete = $state<GalleryItem | null>(null);
    let isDeleting = $state(false);

    async function fetchGalleries() {
        loading = true;
        try {
            const res = await apiClient.api.admin.galleries.$get({
                query: {
                    limit: limit.toString(),
                    offset: offset.toString(),
                    search: searchValue || undefined,
                },
            });

            if (res.ok) {
                const responseData = await res.json();
                if (responseData.data) {
                    galleries = responseData.data.galleries;
                    totalGalleries = responseData.data.total;
                }
            } else {
                triggerToast("Failed to fetch galleries from the backend.", "error");
            }
        } catch (error) {
            console.error("Error fetching galleries:", error);
            triggerToast("Network error fetching galleries list.", "error");
        } finally {
            loading = false;
        }
    }

    async function updateStatus(galleryId: string, newStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
        try {
            const res = await apiClient.api.admin.galleries[":id"].status.$put({
                param: { id: galleryId },
                json: { status: newStatus },
            });

            if (res.ok) {
                triggerToast("Gallery status overridden successfully!", "success");
                await fetchGalleries();
            } else {
                const errData = await res.json() as any;
                triggerToast(errData?.error?.message || "Failed to override status.", "error");
            }
        } catch (error) {
            console.error("Failed override status:", error);
            triggerToast("Error updating status configuration.", "error");
        }
    }

    function confirmDelete(gallery: GalleryItem) {
        galleryToDelete = gallery;
        isDeleteModalOpen = true;
    }

    async function executeDelete() {
        if (!galleryToDelete) return;
        isDeleting = true;
        try {
            const res = await apiClient.api.admin.galleries[":id"].$delete({
                param: { id: galleryToDelete.id },
            });

            if (res.ok) {
                triggerToast(`Gallery "${galleryToDelete.title}" and its storage successfully purged!`, "success");
                isDeleteModalOpen = false;
                galleryToDelete = null;
                offset = 0; // reset
                await fetchGalleries();
            } else {
                triggerToast("Failed to perform cascade deletion.", "error");
            }
        } catch (error) {
            console.error("Deletion failed:", error);
            triggerToast("Error during cascade storage deletion.", "error");
        } finally {
            isDeleting = false;
        }
    }

    onMount(fetchGalleries);

    function handleSearch() {
        offset = 0;
        fetchGalleries();
    }

    function formatDate(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
</script>

<div class="space-y-6 pb-12">
    <!-- Header Hero -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-content/5 pb-6">
        <div class="space-y-1">
            <h1 class="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Gallery Moderation
            </h1>
            <p class="text-sm text-base-content/60 font-medium">
                Audit photographer galleries, enforce Terms of Service, override visibility status, and cascade delete assets.
            </p>
        </div>

        <!-- Search Bar -->
        <div class="join shadow-sm relative z-10">
            <input
                type="text"
                placeholder="Search title, owner, email..."
                class="input input-bordered join-item w-full md:w-80 font-medium bg-base-100"
                bind:value={searchValue}
                onkeydown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
                class="btn btn-primary join-item px-6"
                onclick={handleSearch}
                aria-label="Search galleries"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="w-5 h-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                </svg>
            </button>
        </div>
    </div>

    <!-- Active Filter Status Indicator -->
    {#if searchValue}
        <div class="flex items-center gap-2 text-xs font-bold text-base-content/60">
            <span>Filtering galleries matching "{searchValue}"</span>
            <button class="btn btn-xs btn-ghost text-error p-0 h-auto min-h-0" onclick={() => { searchValue = ""; handleSearch(); }}>
                (Clear Filter)
            </button>
        </div>
    {/if}

    <!-- Tabular Inspector Card -->
    <div class="card bg-base-100 shadow-md border border-base-content/5 overflow-hidden relative z-10">
        <div class="overflow-x-auto">
            <table class="table table-lg">
                <thead class="bg-base-200/50">
                    <tr class="text-base-content/50 font-bold uppercase text-[10px] tracking-widest border-none">
                        <th>Gallery</th>
                        <th>Owner</th>
                        <th>Scale & Engagement</th>
                        <th>Access Mode</th>
                        <th>Status Override</th>
                        <th class="text-right">Safety Action</th>
                    </tr>
                </thead>
                <tbody>
                    {#if loading}
                        {#each Array(5) as _}
                            <tr class="animate-pulse border-b border-base-content/5">
                                <td>
                                    <div class="space-y-2">
                                        <div class="h-4 w-44 bg-base-300 rounded"></div>
                                        <div class="h-3 w-32 bg-base-300 rounded"></div>
                                    </div>
                                </td>
                                <td>
                                    <div class="space-y-2">
                                        <div class="h-4 w-28 bg-base-300 rounded"></div>
                                        <div class="h-3 w-36 bg-base-300 rounded"></div>
                                    </div>
                                </td>
                                <td>
                                    <div class="h-4 w-24 bg-base-300 rounded"></div>
                                </td>
                                <td>
                                    <div class="h-6 w-16 bg-base-300 rounded-xl"></div>
                                </td>
                                <td>
                                    <div class="h-8 w-28 bg-base-300 rounded-xl"></div>
                                </td>
                                <td class="text-right">
                                    <div class="h-8 w-20 bg-base-300 rounded-xl ml-auto"></div>
                                </td>
                            </tr>
                        {/each}
                    {:else if galleries.length === 0}
                        <tr>
                            <td colspan="6" class="text-center py-20 opacity-50 font-bold text-sm">
                                No galleries matching current search filter.
                            </td>
                        </tr>
                    {:else}
                        {#each galleries as item}
                            <tr class="hover:bg-base-200/20 transition-all border-b border-base-content/5">
                                <td>
                                    <div class="space-y-1">
                                        <span class="font-black text-base-content hover:text-primary transition-colors cursor-default block">
                                            {item.title}
                                        </span>
                                        <span class="font-mono text-[9px] text-base-content/40 block">
                                            ID: {item.id}
                                        </span>
                                        <span class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider block">
                                            Created {formatDate(item.createdAt)}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <div class="space-y-0.5">
                                        <span class="font-bold block text-sm">{item.user.name}</span>
                                        <span class="opacity-50 block text-[11px] font-medium">{item.user.email}</span>
                                    </div>
                                </td>
                                <td>
                                    <div class="flex flex-col gap-1 text-xs">
                                        <div class="flex items-center gap-1.5">
                                            <span class="badge badge-sm badge-accent badge-soft font-bold tabular-nums">
                                                {item.photoCount} photos
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-1.5 text-base-content/50 font-medium">
                                            <span>👁️ {item.views} total views</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {#if item.accessMode === "PASSWORD"}
                                        <span class="badge badge-sm badge-warning badge-outline font-extrabold uppercase text-[8px] tracking-wider py-0.5 px-2">
                                            Password
                                        </span>
                                    {:else if item.accessMode === "OTP"}
                                        <span class="badge badge-sm badge-info badge-outline font-extrabold uppercase text-[8px] tracking-wider py-0.5 px-2">
                                            OTP Authentication
                                        </span>
                                    {:else}
                                        <span class="badge badge-sm badge-ghost badge-outline font-extrabold uppercase text-[8px] tracking-wider py-0.5 px-2">
                                            Public
                                        </span>
                                    {/if}
                                </td>
                                <td>
                                    <!-- Dynamic status selector -->
                                    <select
                                        class="select select-sm select-bordered font-bold text-xs rounded-xl focus:ring-0
                                        {item.status === 'PUBLISHED' ? 'text-success border-success/30 bg-success/5' : ''}
                                        {item.status === 'DRAFT' ? 'text-neutral border-base-content/10 bg-base-200/40' : ''}
                                        {item.status === 'ARCHIVED' ? 'text-warning border-warning/30 bg-warning/5' : ''}"
                                        value={item.status}
                                        onchange={(e) => updateStatus(item.id, (e.target as HTMLSelectElement).value as any)}
                                    >
                                        <option value="DRAFT" class="text-base-content bg-base-100">DRAFT (Edit Mode)</option>
                                        <option value="PUBLISHED" class="text-success bg-base-100">PUBLISHED</option>
                                        <option value="ARCHIVED" class="text-warning bg-base-100">ARCHIVED (Locked)</option>
                                    </select>
                                </td>
                                <td class="text-right">
                                    <button
                                        class="btn btn-sm btn-ghost hover:btn-error text-error/60 hover:text-error rounded-xl font-bold gap-1 transition-all"
                                        onclick={() => confirmDelete(item)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>

        <!-- Pagination Footer -->
        <div class="p-4 border-t border-base-content/5 flex items-center justify-between bg-base-200/20">
            <span class="text-xs font-bold opacity-50 uppercase tracking-widest">
                Showing {Math.min(offset + 1, totalGalleries)} to {Math.min(offset + limit, totalGalleries)} of {totalGalleries} galleries
            </span>
            <div class="join">
                <button
                    class="join-item btn btn-sm bg-base-100"
                    disabled={offset === 0}
                    onclick={() => { offset = Math.max(0, offset - limit); fetchGalleries(); }}
                >
                    « Prev
                </button>
                <button class="join-item btn btn-sm bg-base-100 cursor-default font-bold">
                    Page {Math.floor(offset / limit) + 1}
                </button>
                <button
                    class="join-item btn btn-sm bg-base-100"
                    disabled={offset + limit >= totalGalleries}
                    onclick={() => { offset += limit; fetchGalleries(); }}
                >
                    Next »
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Dynamic Alert Toasts -->
{#if showToast}
    <div class="toast toast-bottom toast-end z-80">
        <div class="alert font-semibold shadow-lg rounded-2xl
            {toastType === 'success' ? 'alert-success' : ''}
            {toastType === 'error' ? 'alert-error' : ''}
            {toastType === 'info' ? 'alert-info' : ''}">
            <span>{toastMessage}</span>
        </div>
    </div>
{/if}

<!-- Administrative Cascade Deletion Modal -->
{#if isDeleteModalOpen && galleryToDelete}
    <div class="modal modal-open z-70">
        <div class="modal-box rounded-3xl border border-error/20 bg-base-100 shadow-xl max-w-lg">
            <div class="flex items-center gap-3 text-error mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <h3 class="text-xl font-black">Cascade Deletion Warning</h3>
            </div>
            
            <p class="text-sm font-medium text-base-content/85 leading-relaxed">
                You are about to execute an administrative purge of gallery <strong class="text-primary font-black">"{galleryToDelete.title}"</strong> owned by <strong>{galleryToDelete.user.name}</strong> ({galleryToDelete.user.email}).
            </p>

            <div class="alert alert-error alert-soft rounded-2xl text-xs font-bold my-4 leading-relaxed">
                🚨 THIS ACTION CANNOT BE UNDONE. ALL relational database records, original raw uploaded photos, optimization thumbnails, and custom watermarked public assets will be dynamically list-cleared and physical files deleted from S3 instantly!
            </div>

            <div class="modal-action">
                <button
                    class="btn btn-ghost rounded-2xl font-bold"
                    disabled={isDeleting}
                    onclick={() => { isDeleteModalOpen = false; galleryToDelete = null; }}
                >
                    Cancel
                </button>
                <button
                    class="btn btn-error rounded-2xl font-black px-6 shadow-md shadow-error/15"
                    disabled={isDeleting}
                    onclick={executeDelete}
                >
                    {#if isDeleting}
                        <span class="loading loading-spinner loading-sm"></span> Purging Assets...
                    {:else}
                        Purge Permanently
                    {/if}
                </button>
            </div>
        </div>
        <button type="button" class="modal-backdrop text-left" onclick={() => !isDeleting && (isDeleteModalOpen = false)}>close</button>
    </div>
{/if}
