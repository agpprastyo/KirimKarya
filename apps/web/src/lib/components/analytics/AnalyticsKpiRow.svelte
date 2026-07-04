<script lang="ts">
    import type { ApiResult } from "$lib/api";
    import { api } from "$lib/api";

    type InsightsData = ApiResult<typeof api.api.stats.insights.$get>["data"];

    interface Props {
        funnel: InsightsData["funnel"];
    }

    let { funnel }: Props = $props();

    const kpis = $derived([
        {
            id: "total-views",
            label: "Gallery Views",
            value: funnel.totalViews,
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`,
            accent: "text-blue-600",
            bg: "bg-blue-50",
            border: "border-blue-100",
        },
        {
            id: "total-photos",
            label: "Photos Hosted",
            value: funnel.totalPhotos,
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>`,
            accent: "text-violet-600",
            bg: "bg-violet-50",
            border: "border-violet-100",
        },
        {
            id: "total-selections",
            label: "Photo Selections",
            value: funnel.totalSelections,
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>`,
            accent: "text-rose-600",
            bg: "bg-rose-50",
            border: "border-rose-100",
        },
        {
            id: "total-delivered",
            label: "Delivered",
            value: funnel.totalDelivered,
            icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
            accent: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-100",
        },
    ]);

    function fmt(n: number): string {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
        if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
        return String(n);
    }
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {#each kpis as kpi (kpi.id)}
        <div
            id={kpi.id}
            class="bg-white rounded-2xl border {kpi.border} p-5 flex flex-col gap-4 hover:shadow-sm transition-shadow"
        >
            <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-base-content/50 uppercase tracking-widest">
                    {kpi.label}
                </span>
                <span class="{kpi.bg} {kpi.accent} p-2 rounded-xl">
                    {@html kpi.icon}
                </span>
            </div>
            <div class="text-4xl font-black tracking-tight text-base-content">
                {fmt(kpi.value)}
            </div>
        </div>
    {/each}
</div>
