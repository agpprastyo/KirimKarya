<script lang="ts">
    import { api, handleResponse } from "$lib/api";
    import { createQuery } from "@tanstack/svelte-query";
    import { Motion } from "svelte-motion";

    const insightsQuery = createQuery(() => ({
        queryKey: ["stats", "insights"],
        queryFn: () => handleResponse((api.api.stats as any).insights.$get()).then((res: any) => res.data),
        refetchInterval: 60000,
    }));

    function formatIDR(n: number) {
        return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n);
    }

    // SVG chart helpers
    function buildSparkPath(data: { count: number }[], width = 500, height = 80): string {
        if (!data || data.length < 2) return "";
        const max = Math.max(...data.map(d => d.count), 1);
        const step = width / (data.length - 1);
        const pts = data.map((d, i) => {
            const x = i * step;
            const y = height - (d.count / max) * height;
            return `${x},${y}`;
        });
        return `M${pts.join(" L")}`;
    }

    function buildSelectionPath(data: { selections: number }[], width = 500, height = 80): string {
        if (!data || data.length < 2) return "";
        const max = Math.max(...data.map(d => d.selections), 1);
        const step = width / (data.length - 1);
        const pts = data.map((d, i) => {
            const x = i * step;
            const y = height - (d.selections / max) * height;
            return `${x},${y}`;
        });
        return `M${pts.join(" L")}`;
    }
</script>

<svelte:head>
    <title>Analytics | Kirim Karya</title>
    <meta name="description" content="Photographer studio analytics — funnel metrics, client engagement timeseries, and gallery performance insights." />
</svelte:head>

<div class="space-y-12 pb-20">
    <!-- Header -->
    <div>
        <h1 class="text-4xl font-black tracking-tight">Analytics</h1>
        <p class="text-base-content/60 mt-2 font-medium">
            Deep insights into client behavior, session conversions, and gallery performance.
        </p>
    </div>

    {#if insightsQuery.isLoading}
        <div class="space-y-6">
            {#each Array(3) as _}
                <div class="h-40 bg-base-200 animate-pulse rounded-3xl"></div>
            {/each}
        </div>
    {:else if insightsQuery.error}
        <div role="alert" class="alert alert-error alert-soft rounded-2xl font-semibold">
            Error loading analytics: {insightsQuery.error.message}
        </div>
    {:else if insightsQuery.data}
        {@const data = insightsQuery.data}

        <!-- Conversion Funnel -->
        <Motion initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <section>
                <h2 class="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-6">
                    <span class="w-2 h-8 bg-primary rounded-full"></span>
                    Conversion Funnel
                </h2>
                <div class="card bg-base-100 border border-base-content/5 p-8">
                    <div class="flex flex-col md:flex-row items-stretch gap-1">
                        {#each [
                            { label: "Gallery Views", value: data.funnel.totalViews, color: "bg-primary", pct: 100 },
                            { label: "Photos Hosted", value: data.funnel.totalPhotos, color: "bg-secondary", pct: data.funnel.totalViews > 0 ? Math.round((data.funnel.totalPhotos / Math.max(data.funnel.totalViews, 1)) * 100) : 0 },
                            { label: "Selections Made", value: data.funnel.totalSelections, color: "bg-accent", pct: data.funnel.totalPhotos > 0 ? Math.round((data.funnel.totalSelections / Math.max(data.funnel.totalPhotos, 1)) * 100) : 0 },
                            { label: "Delivered", value: data.funnel.totalDelivered, color: "bg-success", pct: data.funnel.totalGalleries > 0 ? Math.round((data.funnel.totalDelivered / Math.max(data.funnel.totalGalleries, 1)) * 100) : 0 },
                        ] as step, i}
                            <div class="flex-1 relative group">
                                <div class="rounded-2xl p-6 {step.color} bg-opacity-10 border border-base-content/5 h-full transition-all hover:bg-opacity-20">
                                    <div class="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2">{step.label}</div>
                                    <div class="text-4xl font-black">{formatIDR(step.value)}</div>
                                    <div class="mt-3 h-1.5 bg-base-200 rounded-full overflow-hidden">
                                        <div class="h-full {step.color} rounded-full transition-all duration-700" style="width: {step.pct}%"></div>
                                    </div>
                                    <div class="text-[10px] font-black mt-1 opacity-40">{step.pct}% rate</div>
                                </div>
                                {#if i < 3}
                                    <div class="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-6 h-6 rounded-full bg-base-100 border border-base-content/10 items-center justify-center text-xs opacity-40">›</div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </section>
        </Motion>

        <!-- 30-Day Activity Chart -->
        <Motion initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <section>
                <h2 class="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-6">
                    <span class="w-2 h-8 bg-secondary rounded-full"></span>
                    30-Day Client Activity
                </h2>
                <div class="card bg-base-100 border border-base-content/5 p-8">
                    {#if data.dailyActivity.length === 0}
                        <div class="text-center py-12 opacity-30 italic text-sm">No client activity in the last 30 days.</div>
                    {:else}
                        <div class="overflow-hidden">
                            <svg viewBox="0 0 500 100" class="w-full" preserveAspectRatio="none" style="height: 120px;">
                                <!-- Grid lines -->
                                {#each [0, 25, 50, 75, 100] as y}
                                    <line x1="0" y1={y * 0.8} x2="500" y2={y * 0.8} stroke="currentColor" stroke-width="0.3" stroke-opacity="0.1" />
                                {/each}
                                <!-- Activity fill area -->
                                <defs>
                                    <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="oklch(var(--p))" stop-opacity="0.3" />
                                        <stop offset="100%" stop-color="oklch(var(--p))" stop-opacity="0" />
                                    </linearGradient>
                                    <linearGradient id="selectGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stop-color="oklch(var(--s))" stop-opacity="0.3" />
                                        <stop offset="100%" stop-color="oklch(var(--s))" stop-opacity="0" />
                                    </linearGradient>
                                </defs>
                                <!-- Activity path -->
                                <path d="{buildSparkPath(data.dailyActivity)} V80 H0 Z" fill="url(#activityGrad)" />
                                <path d={buildSparkPath(data.dailyActivity)} fill="none" stroke="oklch(var(--p))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <!-- Selections path -->
                                <path d="{buildSelectionPath(data.dailyActivity)} V80 H0 Z" fill="url(#selectGrad)" />
                                <path d={buildSelectionPath(data.dailyActivity)} fill="none" stroke="oklch(var(--s))" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 2" />
                            </svg>
                            <div class="flex items-center gap-6 mt-4 text-xs font-black opacity-60">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-0.5 bg-primary rounded"></div>
                                    Total Activity
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-0.5 bg-secondary rounded" style="border-top: 2px dashed"></div>
                                    Selections
                                </div>
                                <div class="ml-auto opacity-40 italic text-[10px]">Last 30 days</div>
                            </div>
                        </div>
                        <div class="mt-6 flex gap-8 text-center">
                            <div>
                                <div class="text-2xl font-black">{data.dailyActivity.reduce((s: number, d: any) => s + d.count, 0)}</div>
                                <div class="text-[10px] font-black uppercase opacity-40">Total Interactions</div>
                            </div>
                            <div>
                                <div class="text-2xl font-black text-primary">{data.dailyActivity.reduce((s: number, d: any) => s + d.selections, 0)}</div>
                                <div class="text-[10px] font-black uppercase opacity-40">Photo Selections</div>
                            </div>
                            <div>
                                <div class="text-2xl font-black">{data.dailyActivity.length}</div>
                                <div class="text-[10px] font-black uppercase opacity-40">Active Days</div>
                            </div>
                        </div>
                    {/if}
                </div>
            </section>
        </Motion>

        <!-- Gallery Funnels + Top Clients -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Per-Gallery Mini Funnels -->
            <Motion initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <section class="lg:col-span-2">
                    <h2 class="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-6">
                        <span class="w-2 h-8 bg-accent rounded-full"></span>
                        Gallery Performance
                    </h2>
                    <div class="card bg-base-100 border border-base-content/5 overflow-hidden">
                        <div class="divide-y divide-base-content/5">
                            {#each data.galleryFunnels as g, i}
                                <a href="/dashboard/galleries/{g.id}" class="flex items-center gap-4 p-5 hover:bg-base-200/40 transition-colors group">
                                    <span class="w-7 h-7 rounded-full bg-base-200 flex items-center justify-center font-black text-[11px] shrink-0">{i + 1}</span>
                                    <div class="flex-1 min-w-0">
                                        <div class="font-bold text-sm group-hover:text-primary transition-colors truncate">{g.title}</div>
                                        <div class="flex items-center gap-3 mt-1.5">
                                            {#each [
                                                { label: "Views", value: g.views, color: "bg-primary" },
                                                { label: "Photos", value: g.totalPhotos, color: "bg-secondary" },
                                                { label: "Picks", value: g.selections, color: "bg-accent" },
                                            ] as metric}
                                                <div class="flex items-center gap-1 text-[10px] font-black">
                                                    <span class="w-1.5 h-1.5 rounded-full {metric.color}"></span>
                                                    <span class="opacity-50">{metric.label}</span>
                                                    <span>{metric.value}</span>
                                                </div>
                                            {/each}
                                            {#if g.delivered}
                                                <span class="badge badge-success text-[9px] font-black">DELIVERED</span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="w-24 hidden sm:block">
                                        <div class="text-[9px] font-black opacity-30 uppercase mb-1">Selection rate</div>
                                        <div class="h-1.5 bg-base-200 rounded-full overflow-hidden">
                                            <div class="h-full bg-accent rounded-full" style="width: {g.totalPhotos > 0 ? Math.min(100, Math.round((g.selections / g.totalPhotos) * 100)) : 0}%"></div>
                                        </div>
                                    </div>
                                </a>
                            {/each}
                            {#if data.galleryFunnels.length === 0}
                                <div class="text-center py-10 opacity-30 italic text-sm">No gallery data yet.</div>
                            {/if}
                        </div>
                    </div>
                </section>
            </Motion>

            <!-- Top Active Clients -->
            <Motion initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <section>
                    <h2 class="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-6">
                        <span class="w-2 h-8 bg-success rounded-full"></span>
                        Top Clients
                    </h2>
                    <div class="space-y-3">
                        {#each data.topClients.slice(0, 6) as client, i}
                            <div class="card bg-base-100 border border-base-content/5 p-4 relative overflow-hidden group hover:border-primary/20 transition-colors">
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary/20 group-hover:bg-primary transition-colors rounded-l-2xl"></div>
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <div class="font-black text-xs truncate">{client.clientEmail || client.clientIdentifier?.slice(0, 12) + '...'}</div>
                                        <div class="text-[10px] opacity-40 font-bold truncate mt-0.5">in "{client.galleryTitle}"</div>
                                    </div>
                                    <div class="flex gap-1 shrink-0">
                                        <span class="badge badge-primary badge-sm font-black text-[9px]">{client.totalSelections} picks</span>
                                    </div>
                                </div>
                                <div class="flex gap-3 mt-2 text-[9px] font-black opacity-40">
                                    <span>{client.totalComments} comments</span>
                                    <span>·</span>
                                    <span>{new Date(client.lastActivity).toLocaleDateString()}</span>
                                </div>
                            </div>
                        {/each}
                        {#if data.topClients.length === 0}
                            <div class="text-center py-10 opacity-30 italic text-sm">No client activity yet.</div>
                        {/if}
                    </div>
                </section>
            </Motion>
        </div>
    {/if}
</div>
