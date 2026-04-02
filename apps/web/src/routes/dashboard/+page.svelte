<script lang="ts">
    import { api, handleResponse } from "$lib/api";
    import { createQuery } from "@tanstack/svelte-query";
    import { Motion } from "svelte-motion";

    const statsQuery = createQuery(() => ({
        queryKey: ["stats", "summary"],
        queryFn: () => handleResponse(api.api.stats.summary.$get())
            .then(res => res.data)
    }));

    const formatActivity = (type: string) => {
        return type === 'COMMENT' ? 'added a comment' : 'selected a photo';
    };
</script>

<div class="space-y-12 pb-20">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 class="text-4xl font-black tracking-tight">Studio Dashboard</h1>
            <p class="text-base-content/60 mt-2 font-medium">
                Welcome back! Here's how your photography business is performing.
            </p>
        </div>
        <Motion whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <a
                href="/dashboard/galleries/new"
                class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20"
            >
                Create New Gallery
            </a>
        </Motion>
    </div>

    {#if statsQuery.isLoading}
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            {#each Array(4) as _}
                <div class="h-32 bg-base-200 animate-pulse rounded-3xl"></div>
            {/each}
        </div>
    {:else if statsQuery.error}
        <div class="alert alert-error">
            <span>Error loading dashboard stats: {statsQuery.error.message}</span>
        </div>
    {:else if statsQuery.data}
        {@const data = statsQuery.data}
        <!-- Stats Grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            {#each [
                { label: 'Total Galleries', value: data.stats.totalGalleries, icon: '🖼️' },
                { label: 'Photos Hosted', value: data.stats.totalPhotos, icon: '📸' },
                { label: 'Total Views', value: data.stats.totalViews, icon: '👁️' },
                { label: 'Photo Selections', value: data.stats.totalSelections, icon: '❤️' }
            ] as stat, i}
                <Motion 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                >
                    <div class="card bg-base-100 shadow-sm border border-base-content/5 p-6 hover:border-primary/20 transition-colors">
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-2xl">{stat.icon}</span>
                            <span class="text-[10px] font-black uppercase tracking-widest opacity-40">Lifetime</span>
                        </div>
                        <div class="text-sm font-bold opacity-50 uppercase tracking-wider">
                            {stat.label}
                        </div>
                        <div class="text-3xl font-black mt-1">{stat.value}</div>
                    </div>
                </Motion>
            {/each}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Top Galleries -->
            <div class="lg:col-span-2 space-y-6">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                        <span class="w-2 h-8 bg-primary rounded-full"></span>
                        Top Galleries By Views
                    </h2>
                </div>
                <div class="card bg-base-100 border border-base-content/5 overflow-hidden">
                    <div class="divide-y divide-base-content/5">
                        {#each data.topGalleries as gallery, i}
                            <Motion 
                                initial={{ x: -20, opacity: 0 }} 
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 + (i * 0.1) }}
                            >
                                <a href="/dashboard/galleries/{gallery.id}" class="flex items-center justify-between p-6 hover:bg-base-200/50 transition-colors group">
                                    <div class="flex items-center gap-4">
                                        <span class="w-8 h-8 rounded-full bg-base-200 flex items-center justify-center font-black text-xs">{i + 1}</span>
                                        <div>
                                            <div class="font-bold group-hover:text-primary transition-colors">{gallery.title}</div>
                                            <div class="text-xs opacity-40 font-medium">Gallery ID: {gallery.id.slice(0, 8)}...</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-4">
                                        <div class="text-right">
                                            <div class="font-black text-lg">{gallery.views}</div>
                                            <div class="text-[10px] uppercase font-black opacity-30">Views</div>
                                        </div>
                                        <div class="w-24 h-2 bg-base-200 rounded-full overflow-hidden hidden sm:block">
                                            <div class="h-full bg-primary" style="width: {(gallery.views / (data.topGalleries[0]?.views || 1)) * 100}%"></div>
                                        </div>
                                    </div>
                                </a>
                            </Motion>
                        {/each}
                        {#if data.topGalleries.length === 0}
                            <div class="text-center py-10 opacity-30 italic text-sm">
                                No galleries yet.
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div class="space-y-6">
                <h2 class="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                    <span class="w-2 h-8 bg-secondary rounded-full"></span>
                    Recent Activity
                </h2>
                <div class="space-y-4">
                    {#each data.recentActivity as activity, i}
                        <Motion 
                            initial={{ x: 20, opacity: 0 }} 
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + (i * 0.1) }}
                        >
                            <div class="card bg-base-200/30 p-4 border border-base-content/5 relative overflow-hidden group">
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors"></div>
                                <div class="text-xs font-black opacity-40 mb-1 flex justify-between">
                                    <span>{new Date(activity.createdAt).toLocaleDateString()}</span>
                                    <span class="text-primary">{activity.type}</span>
                                </div>
                                <p class="text-sm font-bold leading-tight">
                                    A client {formatActivity(activity.type)} in 
                                    <span class="text-primary">"{activity.galleryTitle}"</span>
                                </p>
                                <div class="mt-2 text-[10px] font-medium opacity-30 truncate">
                                    ID: {activity.clientIdentifier || 'Anonymous'}
                                </div>
                            </div>
                        </Motion>
                    {/each}
                    {#if data.recentActivity.length === 0}
                        <div class="text-center py-10 opacity-30 italic text-sm">
                            No recent activity yet.
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    :global(body) {
        background-color: #fafafa;
    }
</style>
