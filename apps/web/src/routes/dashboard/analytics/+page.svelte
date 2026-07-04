<script lang="ts">
    import { api, handleResponse } from "$lib/api";
    import type { ApiResult } from "$lib/api";
    import { createQuery } from "@tanstack/svelte-query";
    import AnalyticsKpiRow from "$lib/components/analytics/AnalyticsKpiRow.svelte";
    import AnalyticsChart from "$lib/components/analytics/AnalyticsChart.svelte";
    import GalleryPerformanceTable from "$lib/components/analytics/GalleryPerformanceTable.svelte";
    import TopClientsList from "$lib/components/analytics/TopClientsList.svelte";

    type InsightsResponse = ApiResult<typeof api.api.stats.insights.$get>;

    const insightsQuery = createQuery(() => ({
        queryKey: ["stats", "insights"],
        queryFn: (): Promise<InsightsResponse["data"]> =>
            handleResponse(api.api.stats.insights.$get()).then((res) => res.data),
        refetchInterval: 60_000,
    }));

    // Last refreshed timestamp
    let lastRefreshed = $state(new Date());
    $effect(() => {
        if (insightsQuery.dataUpdatedAt) {
            lastRefreshed = new Date(insightsQuery.dataUpdatedAt);
        }
    });

    function formatTime(d: Date): string {
        return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
</script>

<svelte:head>
    <title>Analytics | Kirim Karya</title>
    <meta
        name="description"
        content="Photographer studio analytics — funnel metrics, client engagement timeseries, and gallery performance insights."
    />
</svelte:head>

<div class="space-y-6 pb-20">
    <!-- ── Page Header ───────────────────────────────────────────────────── -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
            <h1 class="text-3xl font-black tracking-tight text-base-content">Analytics</h1>
            <p class="text-sm text-base-content/50 mt-1">
                Client behavior, conversions, and gallery performance.
            </p>
        </div>
        <div class="flex items-center gap-2 text-xs font-semibold text-base-content/40">
            <span class="inline-flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-3 py-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Auto-refresh · Updated {formatTime(lastRefreshed)}
            </span>
        </div>
    </div>

    <!-- ── Loading skeleton ──────────────────────────────────────────────── -->
    {#if insightsQuery.isLoading}
        <div class="space-y-5">
            <!-- KPI skeleton -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {#each Array(4) as _}
                    <div class="h-28 bg-base-200 animate-pulse rounded-2xl"></div>
                {/each}
            </div>
            <!-- Chart skeleton -->
            <div class="h-64 bg-base-200 animate-pulse rounded-2xl"></div>
            <!-- Bottom section skeleton -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div class="lg:col-span-2 h-72 bg-base-200 animate-pulse rounded-2xl"></div>
                <div class="h-72 bg-base-200 animate-pulse rounded-2xl"></div>
            </div>
        </div>

    <!-- ── Error state ───────────────────────────────────────────────────── -->
    {:else if insightsQuery.error}
        <div role="alert" class="alert alert-error alert-soft rounded-2xl font-semibold">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Failed to load analytics: {insightsQuery.error.message}
        </div>

    <!-- ── Data ─────────────────────────────────────────────────────────── -->
    {:else if insightsQuery.data}
        {@const data = insightsQuery.data}

        <!-- KPI Row -->
        <AnalyticsKpiRow funnel={data.funnel} />

        <!-- 30-Day Chart -->
        <AnalyticsChart dailyActivity={data.dailyActivity} />

        <!-- Gallery Performance + Top Clients -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div class="lg:col-span-2">
                <GalleryPerformanceTable galleryFunnels={data.galleryFunnels} />
            </div>
            <TopClientsList topClients={data.topClients} />
        </div>
    {/if}
</div>
