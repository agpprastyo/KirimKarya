<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import type { ApiResult } from "$lib/api";
    import { api } from "$lib/api";

    type InsightsData = ApiResult<typeof api.api.stats.insights.$get>["data"];

    interface Props {
        dailyActivity: InsightsData["dailyActivity"];
    }

    let { dailyActivity }: Props = $props();

    let chartEl: HTMLDivElement | undefined = $state();
    let chart: import("apexcharts") | null = null;

    const totalActivity = $derived(dailyActivity.reduce((s, d) => s + d.count, 0));
    const totalSelections = $derived(dailyActivity.reduce((s, d) => s + d.selections, 0));
    const activeDays = $derived(dailyActivity.filter(d => d.count > 0).length);

    onMount(async () => {
        if (!chartEl || dailyActivity.length === 0) return;

        const ApexChartsClass = (await import("apexcharts")).default;

        const categories = dailyActivity.map(d =>
            new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        );

        const options: import("apexcharts").ApexOptions = {
            chart: {
                type: "area",
                height: 220,
                toolbar: { show: false },
                zoom: { enabled: false },
                fontFamily: "inherit",
                background: "transparent",
                sparkline: { enabled: false },
                animations: {
                    enabled: true,
                    speed: 600,
                },
            },
            series: [
                {
                    name: "Activity",
                    data: dailyActivity.map(d => d.count),
                },
                {
                    name: "Selections",
                    data: dailyActivity.map(d => d.selections),
                },
            ],
            colors: ["#6366f1", "#f43f5e"],
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.25,
                    opacityTo: 0,
                    stops: [0, 90, 100],
                },
            },
            stroke: {
                curve: "smooth",
                width: [2.5, 2],
                dashArray: [0, 4],
            },
            xaxis: {
                categories,
                tickAmount: 6,
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    style: { fontSize: "11px", colors: "#9ca3af" },
                },
            },
            yaxis: {
                labels: {
                    style: { fontSize: "11px", colors: "#9ca3af" },
                    formatter: (v: number) => (v % 1 === 0 ? String(v) : ""),
                },
                min: 0,
            },
            grid: {
                borderColor: "#f1f5f9",
                strokeDashArray: 4,
                xaxis: { lines: { show: false } },
            },
            tooltip: {
                shared: true,
                intersect: false,
                theme: "light",
                style: { fontSize: "12px" },
                x: { show: true },
            },
            legend: { show: false },
            dataLabels: { enabled: false },
            markers: { size: 0 },
        };

        chart = new ApexChartsClass(chartEl, options);
        chart.render();
    });

    onDestroy(() => {
        chart?.destroy();
    });
</script>

<div class="bg-white rounded-2xl border border-gray-100 p-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
            <h2 class="font-bold text-base-content text-base">30-Day Client Activity</h2>
            <p class="text-xs text-base-content/40 mt-0.5">Interactions and photo selections over the last 30 days</p>
        </div>
        <!-- Legend -->
        <div class="flex items-center gap-5 text-xs font-semibold text-base-content/60">
            <span class="flex items-center gap-2">
                <span class="w-6 h-0.5 bg-indigo-500 rounded-full inline-block"></span>
                Activity
            </span>
            <span class="flex items-center gap-2">
                <svg class="w-6 h-0.5 inline-block" viewBox="0 0 24 2">
                    <line x1="0" y1="1" x2="24" y2="1" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4 2"/>
                </svg>
                Selections
            </span>
        </div>
    </div>

    <!-- Chart or empty state -->
    {#if dailyActivity.length === 0}
        <div class="h-[220px] flex flex-col items-center justify-center text-base-content/30 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p class="text-sm italic">No activity in the last 30 days</p>
        </div>
    {:else}
        <div bind:this={chartEl} id="analytics-activity-chart"></div>
    {/if}

    <!-- Summary stats below chart -->
    {#if dailyActivity.length > 0}
        <div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-50">
            <div class="text-center" id="analytics-total-interactions">
                <div class="text-xl font-black text-base-content">{totalActivity}</div>
                <div class="text-[10px] uppercase tracking-widest font-semibold text-base-content/40 mt-0.5">Total Interactions</div>
            </div>
            <div class="text-center" id="analytics-total-selections">
                <div class="text-xl font-black text-rose-500">{totalSelections}</div>
                <div class="text-[10px] uppercase tracking-widest font-semibold text-base-content/40 mt-0.5">Photo Selections</div>
            </div>
            <div class="text-center" id="analytics-active-days">
                <div class="text-xl font-black text-base-content">{activeDays}</div>
                <div class="text-[10px] uppercase tracking-widest font-semibold text-base-content/40 mt-0.5">Active Days</div>
            </div>
        </div>
    {/if}
</div>
