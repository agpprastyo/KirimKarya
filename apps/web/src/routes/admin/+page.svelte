<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { api as apiClient } from "$lib/api";
    import { onMount } from "svelte";
    import AdminSystemStatus from "$lib/components/admin/AdminSystemStatus.svelte";
    import AdminShortcuts from "$lib/components/admin/AdminShortcuts.svelte";

    let stats = $state({
        users: 0,
        admins: 0,
        banned: 0,
    });

    let summaryStats = $state({
        totalUsers: 0,
        totalGalleries: 0,
        totalPhotos: 0,
        totalViews: 0,
        storageUsedBytes: 0,
        activeUsersCount: 0,
        newSignupsCount: 0,
    });

    let systems = $state({
        auth: "...",
        db: "...",
        redis: "...",
        s3: "...",
    });

    let formattedTime = $state("");
    let isStatsLoading = $state(true);

    function formatBytes(bytes: number, decimals = 2) {
        if (!bytes) return "0 Bytes";
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    onMount(() => {
        // Simple ticking clock for serverside visibility
        const updateClock = () => {
            const now = new Date();
            formattedTime = now.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            }) + " UTC";
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);

        const fetchAllData = async () => {
            isStatsLoading = true;
            try {
                // Fetch Better-Auth basic metrics
                const statsRes = await authClient.admin.listUsers({
                    query: { limit: 1000 },
                });
                if (statsRes.data) {
                    stats.users = statsRes.data.total;
                    stats.admins = statsRes.data.users.filter(
                        (u: any) => u.role === "admin",
                    ).length;
                    stats.banned = statsRes.data.users.filter(
                        (u: any) => u.banned,
                    ).length;
                }

                // Fetch new Hono analytics statistics
                const summaryRes = await apiClient.api.admin.stats.summary.$get();
                if (summaryRes.ok) {
                    const summaryData = await summaryRes.json();
                    if (summaryData.data) {
                        summaryStats = summaryData.data.stats;
                    }
                }

                // Fetch system services health
                const res = await (apiClient as any).api.health.$get();
                if (res.ok) {
                    const healthData = await res.json();
                    if (healthData.data) {
                        systems = healthData.data.services;
                    }
                }
            } catch (error) {
                console.error("Failed to load admin dashboard summary stats:", error);
                systems = {
                    auth: "ERROR",
                    db: "ERROR",
                    redis: "ERROR",
                    s3: "ERROR",
                };
            } finally {
                isStatsLoading = false;
            }
        };

        fetchAllData();

        return () => {
            clearInterval(timer);
        };
    });

    // Helper calculate storage progress ratio against a soft 100GB limit
    let storagePercent = $derived(
        Math.min(Math.round((summaryStats.storageUsedBytes / (100 * 1024 * 1024 * 1024)) * 100), 100)
    );

    // Derived values for the growth SVG curve coordinates
    let sVal = $derived(summaryStats.newSignupsCount || 2);
    let p1Y = 160;
    let p2Y = $derived(Math.max(160 - sVal * 12, 40));
    let p3Y = $derived(Math.max(170 - sVal * 6, 60));
    let p4Y = $derived(Math.max(150 - sVal * 18, 30));

    let aVal = $derived(summaryStats.activeUsersCount || 1);
    let a1Y = 180;
    let a2Y = $derived(Math.max(175 - aVal * 18, 50));
    let a3Y = $derived(Math.max(160 - aVal * 10, 80));
    let a4Y = $derived(Math.max(170 - aVal * 25, 20));
</script>

<div class="space-y-8 pb-12">
    <!-- Header Hero -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-base-content/5 pb-6">
        <div>
            <div class="flex items-center gap-2">
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span class="text-[10px] font-bold tracking-widest uppercase text-emerald-500">System Active</span>
            </div>
            <h1 class="text-3xl font-black tracking-tight mt-1 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                System Overview
            </h1>
            <p class="text-sm text-base-content/60 font-medium">
                Platform stats, user distributions, storage metrics, and quick actions.
            </p>
        </div>
        <div class="flex flex-col md:items-end font-mono">
            <span class="text-[9px] font-bold tracking-widest uppercase opacity-40">Operational Clock</span>
            <span class="text-md font-bold text-primary tabular-nums">{formattedTime || "00:00:00"}</span>
        </div>
    </div>

    <!-- Stats Grid -->
    {#if isStatsLoading}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {#each Array(4) as _}
                <div class="h-32 bg-base-200 animate-pulse rounded-3xl"></div>
            {/each}
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- 1. Total Photographers -->
            <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden z-10 shadow-sm hover:shadow-md transition-all">
                <div class="absolute -right-4 -bottom-4 text-primary/5 size-28 select-none pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                </div>
                <div class="space-y-3">
                    <span class="badge badge-sm badge-primary badge-outline font-extrabold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">
                        Photographers
                    </span>
                    <div class="text-3xl font-black tracking-tight tabular-nums text-base-content">
                        {summaryStats.totalUsers || stats.users}
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-base-content/50 font-bold">
                        <span class="text-emerald-500 font-black">+{summaryStats.newSignupsCount}</span>
                        <span>new this week</span>
                    </div>
                </div>
            </div>

            <!-- 2. Galleries Hosted -->
            <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden z-10 shadow-sm hover:shadow-md transition-all">
                <div class="absolute -right-4 -bottom-4 text-secondary/5 size-28 select-none pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                </div>
                <div class="space-y-3">
                    <span class="badge badge-sm badge-secondary badge-outline font-extrabold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">
                        Galleries
                    </span>
                    <div class="text-3xl font-black tracking-tight tabular-nums text-base-content">
                        {summaryStats.totalGalleries}
                    </div>
                    <div class="flex items-center gap-1 text-xs text-base-content/50 font-bold">
                        <span class="text-secondary font-black">{summaryStats.totalViews}</span>
                        <span>total public views</span>
                    </div>
                </div>
            </div>

            <!-- 3. Photos Hosted -->
            <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden z-10 shadow-sm hover:shadow-md transition-all">
                <div class="absolute -right-4 -bottom-4 text-accent/5 size-28 select-none pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                </div>
                <div class="space-y-3">
                    <span class="badge badge-sm badge-accent badge-outline font-extrabold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">
                        Photos Hosted
                    </span>
                    <div class="text-3xl font-black tracking-tight tabular-nums text-base-content">
                        {summaryStats.totalPhotos}
                    </div>
                    <div class="flex items-center gap-1.5 text-xs text-base-content/50 font-bold">
                        <span class="text-emerald-500 font-black">{summaryStats.activeUsersCount}</span>
                        <span>active uploaders</span>
                    </div>
                </div>
            </div>

            <!-- 4. Storage Utilized -->
            <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden z-10 shadow-sm hover:shadow-md transition-all">
                <div class="absolute -right-4 -bottom-4 text-warning/5 size-28 select-none pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-full h-full">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75m0 3.75v3.75m-16.5-3.75v3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
                    </svg>
                </div>
                <div class="space-y-3">
                    <span class="badge badge-sm badge-warning badge-outline font-extrabold uppercase tracking-widest text-[9px] px-2 py-0.5 rounded-md">
                        MinIO Storage
                    </span>
                    <div class="text-3xl font-black tracking-tight tabular-nums text-base-content truncate">
                        {formatBytes(summaryStats.storageUsedBytes)}
                    </div>
                    <div class="space-y-1">
                        <div class="flex justify-between text-[10px] font-bold text-base-content/40">
                            <span>{storagePercent}% Capacity</span>
                            <span>Limit: 100 GB</span>
                        </div>
                        <progress class="progress progress-warning h-1.5 rounded-full" value={storagePercent} max="100"></progress>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- High-Fidelity SVG Curve Graph & Metrics Insight -->
    <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden z-10">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                <h3 class="text-lg font-black">Weekly Growth & Ingest Trend</h3>
                <p class="text-xs text-base-content/50">Photographer registrations and active photo ingestion curves</p>
            </div>
            <div class="flex items-center gap-4 text-[10px] font-extrabold tracking-widest uppercase">
                <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    <span class="text-base-content/70">New Signups ({summaryStats.newSignupsCount})</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                    <span class="text-base-content/70">Active Uploaders ({summaryStats.activeUsersCount})</span>
                </div>
            </div>
        </div>

        <!-- Dynamic SVG line chart -->
        <div class="h-64 w-full relative">
            <svg class="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.25"/>
                        <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0.0"/>
                    </linearGradient>
                    <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--color-secondary)" stop-opacity="0.25"/>
                        <stop offset="100%" stop-color="var(--color-secondary)" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>
                
                <!-- Grid Horizontal Lines -->
                <line x1="0" y1="50" x2="600" y2="50" stroke="currentColor" class="opacity-5" stroke-dasharray="4" />
                <line x1="0" y1="100" x2="600" y2="100" stroke="currentColor" class="opacity-5" stroke-dasharray="4" />
                <line x1="0" y1="150" x2="600" y2="150" stroke="currentColor" class="opacity-5" stroke-dasharray="4" />

                <!-- Mock curves built using custom math and backend parameters -->
                <!-- Signups Area and Line (Primary) -->
                <path d="M 0 170 Q 150 {p1Y} 300 {p2Y} T 450 {p3Y} T 600 {p4Y} L 600 200 L 0 200 Z" fill="url(#signupGrad)" stroke="none" />
                <path d="M 0 170 Q 150 {p1Y} 300 {p2Y} T 450 {p3Y} T 600 {p4Y}" fill="none" class="stroke-primary" stroke-width="4" stroke-linecap="round" />

                <!-- Active Uploaders Area and Line (Secondary) -->
                <path d="M 0 190 Q 150 {a1Y} 300 {a2Y} T 450 {a3Y} T 600 {a4Y} L 600 200 L 0 200 Z" fill="url(#activeGrad)" stroke="none" />
                <path d="M 0 190 Q 150 {a1Y} 300 {a2Y} T 450 {a3Y} T 600 {a4Y}" fill="none" class="stroke-secondary" stroke-width="4" stroke-linecap="round" />
            </svg>
        </div>
        <div class="flex justify-between text-[10px] font-black opacity-35 px-2 mt-3 tracking-wider">
            <span>6 DAYS AGO</span>
            <span>4 DAYS AGO</span>
            <span>2 DAYS AGO</span>
            <span>TODAY (SYSTEM SYNCHRONIZED)</span>
        </div>
    </div>

    <!-- Details Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        <AdminSystemStatus {systems} />
        <AdminShortcuts />
    </div>
</div>
