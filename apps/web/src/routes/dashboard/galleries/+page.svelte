<script lang="ts">
    import { api } from "$lib/api";
    import { createQuery, createMutation, useQueryClient } from "@tanstack/svelte-query";
    import Alert from "$lib/components/Alert.svelte";
    import ConfirmDialog from "$lib/components/gallery/ConfirmDialog.svelte";

    const queryClient = useQueryClient();
    let alertRef = $state<{
        show: (message: string, type: "success" | "error") => void;
    } | null>(null);

    const galleriesQuery = createQuery(() => ({
        queryKey: ["galleries", "list"],
        queryFn: async () => {
            const res = await api.api.galleries.$get();
            if (!res.ok) throw new Error("Failed to fetch galleries");
            const json = await res.json();
            return json.data;
        }
    }));

    const deleteGalleryMutation = createMutation(() => ({
        mutationFn: async (id: string) => {
            const res = await api.api.galleries[":id"].$delete({
                param: { id },
            });
            if (!res.ok) {
                const err = (await res.json()) as any;
                throw new Error(err.message || "Failed to delete gallery");
            }
            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", "list"] });
            alertRef?.show("Gallery deleted successfully!", "success");
        },
        onError: (err: Error) => {
            alertRef?.show(err.message, "error");
        }
    }));

    // Custom Confirmation Modal State
    let isConfirmModalOpen = $state(false);
    let confirmModalTitle = $state("");
    let confirmModalMessage = $state("");
    let confirmModalCallback = $state<(() => void) | null>(null);

    function showConfirmation(title: string, message: string, onConfirm: () => void) {
        confirmModalTitle = title;
        confirmModalMessage = message;
        confirmModalCallback = () => {
            onConfirm();
            isConfirmModalOpen = false;
        };
        isConfirmModalOpen = true;
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "PUBLISHED":
                return "badge-success";
            case "DRAFT":
                return "badge-ghost";
            case "ARCHIVED":
                return "badge-error";
            default:
                return "badge-ghost";
        }
    };
</script>

<Alert bind:this={alertRef} />

<ConfirmDialog
    isOpen={isConfirmModalOpen}
    title={confirmModalTitle}
    message={confirmModalMessage}
    onConfirm={() => confirmModalCallback?.()}
    onCancel={() => isConfirmModalOpen = false}
/>

<div class="space-y-8">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-3xl font-black tracking-tight">Galleries</h1>
            <p class="text-base-content/60 mt-1">
                Manage your photography projects and client deliveries.
            </p>
        </div>
        <a
            href="/dashboard/galleries/new"
            class="btn btn-primary rounded-2xl font-black px-8 cursor-pointer"
        >
            New Gallery
        </a>
    </div>

    {#if galleriesQuery.isLoading}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each Array(3) as _}
                <div
                    class="card bg-base-100 shadow-sm border border-base-content/5 p-6 animate-pulse"
                >
                    <div class="h-6 bg-base-200 rounded w-3/4 mb-4"></div>
                    <div class="h-4 bg-base-200 rounded w-1/2 mb-6"></div>
                    <div class="h-10 bg-base-200 rounded"></div>
                </div>
            {/each}
        </div>
    {:else if galleriesQuery.error}
        <div role="alert" class="alert alert-error alert-soft rounded-2xl flex items-center gap-3 font-semibold mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Error loading galleries: {galleriesQuery.error.message}</span>
        </div>
    {:else if !galleriesQuery.data || galleriesQuery.data.length === 0}
        <div
            class="card bg-base-100 border-2 border-dashed border-base-content/10 p-16 text-center"
        >
            <div class="max-w-md mx-auto">
                <div
                    class="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <svg
                        class="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>
                <h3 class="text-xl font-bold">No galleries yet</h3>
                <p class="text-base-content/60 mt-2 mb-8">
                    Create your first gallery to start sharing your beautiful
                    photos with clients.
                </p>
                <a
                    href="/dashboard/galleries/new"
                    class="btn btn-primary rounded-2xl font-black cursor-pointer"
                    >Create My First Gallery</a
                >
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each galleriesQuery.data as gallery}
                <a
                    href="/dashboard/galleries/{gallery.id}"
                    class="card bg-base-100 shadow-sm border border-base-content/5 hover:border-primary/30 transition-all group overflow-hidden"
                >
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <span
                                class="badge {getStatusColor(
                                    gallery.status,
                                )} font-bold text-[10px] uppercase px-2 py-0 border-none"
                            >
                                {gallery.status}
                            </span>

                            <!-- Trash Delete Button visible on card hover -->
                            <button
                                onclick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    showConfirmation(
                                        "Delete Gallery",
                                        `Are you sure you want to permanently delete "${gallery.title}" along with all its photos? This action cannot be undone.`,
                                        () => deleteGalleryMutation.mutate(gallery.id)
                                    );
                                }}
                                disabled={deleteGalleryMutation.isPending}
                                class="w-8 h-8 rounded-full bg-error/10 hover:bg-error text-error hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-xs z-10 cursor-pointer border-none"
                                title="Delete Gallery"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                            </button>
                        </div>
                        <h3
                            class="text-xl font-black truncate group-hover:text-primary transition-colors"
                        >
                            {gallery.title}
                        </h3>
                        <p class="text-sm text-base-content/50 mt-1 truncate">
                            {gallery.clientEmail || "No client assigned"}
                        </p>

                        <div
                            class="mt-8 pt-6 border-t border-base-content/5 flex items-center justify-between"
                        >
                            <div
                                class="text-[10px] font-bold uppercase opacity-30 tracking-widest"
                            >
                                Created {new Date(
                                    gallery.createdAt,
                                ).toLocaleDateString()}
                            </div>
                            <svg
                                class="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                                />
                            </svg>
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {/if}
</div>
