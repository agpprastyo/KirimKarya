<script lang="ts">
    import { api } from "$lib/api";
    import { onMount } from "svelte";

    let galleries = $state<any[]>([]);
    let isLoading = $state(true);

    onMount(async () => {
        try {
            const res = await api.api.galleries.$get();
            if (res.ok) {
                const json = await res.json();
                galleries = json.data;
            }
        } finally {
            isLoading = false;
        }
    });

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
            class="btn btn-primary rounded-2xl font-black px-8"
        >
            New Gallery
        </a>
    </div>

    {#if isLoading}
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
    {:else if galleries.length === 0}
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
                    class="btn btn-primary rounded-2xl font-black"
                    >Create My First Gallery</a
                >
            </div>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each galleries as gallery}
                <a
                    href="/dashboard/galleries/{gallery.id}"
                    class="card bg-base-100 shadow-sm border border-base-content/5 hover:border-primary/30 transition-all group overflow-hidden"
                >
                    <div class="p-6">
                        <div class="flex items-start justify-between mb-4">
                            <span
                                class="badge {getStatusColor(
                                    gallery.status,
                                )} font-bold text-[10px] uppercase px-2 py-0 border-none"
                            >
                                {gallery.status}
                            </span>
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
