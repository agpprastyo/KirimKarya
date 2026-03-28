<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { api as apiClient } from "$lib/api";
    import { onMount } from "svelte";
    import AdminStatsGrid from "$lib/components/admin/AdminStatsGrid.svelte";
    import AdminSystemStatus from "$lib/components/admin/AdminSystemStatus.svelte";
    import AdminShortcuts from "$lib/components/admin/AdminShortcuts.svelte";

    let stats = {
        users: 0,
        admins: 0,
        banned: 0,
    };

    let systems = {
        auth: "...",
        db: "...",
        redis: "...",
        s3: "...",
    };


    onMount(async () => {
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

        try {
            const res = await (apiClient as any).api.health.$get();
            if (res.ok) {
                const healthData = await res.json();
                if (healthData.data) {
                    systems = healthData.data.services;
                }
            }
        } catch (error) {
            console.error("Failed to fetch system health:", error);
            systems = {
                auth: "ERROR",
                db: "ERROR",
                redis: "ERROR",
                s3: "ERROR",
            };
        }
    });
</script>

<div class="space-y-4">
    <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p class="text-base text-base-content/60">
            Platform overview and quick actions.
        </p>
    </div>

    <AdminStatsGrid {stats} />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        <AdminSystemStatus {systems} />
        <AdminShortcuts />
    </div>
</div>
