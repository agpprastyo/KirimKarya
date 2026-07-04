<script lang="ts">
    import type { ApiResult } from "$lib/api";
    import { api } from "$lib/api";

    type InsightsData = ApiResult<typeof api.api.stats.insights.$get>["data"];

    interface Props {
        galleryFunnels: InsightsData["galleryFunnels"];
    }

    let { galleryFunnels }: Props = $props();

    function selectionRate(g: InsightsData["galleryFunnels"][number]): number {
        if (g.totalPhotos === 0) return 0;
        return Math.min(100, Math.round((g.selections / g.totalPhotos) * 100));
    }
</script>

<div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <!-- Table header -->
    <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h2 class="font-bold text-base-content text-base">Gallery Performance</h2>
        <span class="text-xs font-semibold text-base-content/40">{galleryFunnels.length} galleries</span>
    </div>

    {#if galleryFunnels.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-base-content/25 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <p class="text-sm italic">No gallery data yet</p>
        </div>
    {:else}
        <div class="divide-y divide-gray-50">
            {#each galleryFunnels as g, i (g.id)}
                {@const rate = selectionRate(g)}
                <a
                    id="gallery-row-{g.id}"
                    href="/dashboard/galleries/{g.id}"
                    class="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/70 transition-colors group"
                >
                    <!-- Rank -->
                    <span class="w-7 h-7 rounded-full bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center font-bold text-[11px] text-base-content/50 group-hover:text-indigo-600 shrink-0 transition-colors">
                        {i + 1}
                    </span>

                    <!-- Title + metrics -->
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-sm text-base-content group-hover:text-indigo-600 truncate transition-colors">
                            {g.title}
                        </div>
                        <div class="flex items-center gap-3 mt-2">
                            <span class="flex items-center gap-1 text-[11px] font-semibold text-base-content/50">
                                <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"></span>
                                {g.views} views
                            </span>
                            <span class="flex items-center gap-1 text-[11px] font-semibold text-base-content/50">
                                <span class="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"></span>
                                {g.totalPhotos} photos
                            </span>
                            <span class="flex items-center gap-1 text-[11px] font-semibold text-base-content/50">
                                <span class="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block"></span>
                                {g.selections} picks
                            </span>
                        </div>
                    </div>

                    <!-- Selection rate bar -->
                    <div class="w-28 hidden sm:block shrink-0">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[10px] font-bold text-base-content/35 uppercase tracking-wider">Pick rate</span>
                            <span class="text-[11px] font-bold text-base-content/60">{rate}%</span>
                        </div>
                        <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                class="h-full rounded-full transition-all duration-700 {rate > 50 ? 'bg-emerald-500' : rate > 20 ? 'bg-amber-400' : 'bg-rose-400'}"
                                style="width: {rate}%"
                            ></div>
                        </div>
                    </div>

                    <!-- Status badges + arrow -->
                    <div class="flex items-center gap-2 shrink-0">
                        {#if g.delivered}
                            <span class="badge badge-success badge-sm text-[10px] font-bold px-2">Delivered</span>
                        {/if}
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-base-content/20 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </a>
            {/each}
        </div>
    {/if}
</div>
