<script lang="ts">
    import type { ApiResult } from "$lib/api";
    import { api } from "$lib/api";

    type InsightsData = ApiResult<typeof api.api.stats.insights.$get>["data"];
    type Client = InsightsData["topClients"][number];

    interface Props {
        topClients: InsightsData["topClients"];
    }

    let { topClients }: Props = $props();

    function displayName(client: Client): string {
        if (client.clientEmail) return client.clientEmail;
        if (client.clientIdentifier) return client.clientIdentifier.slice(0, 14) + "…";
        return "Anonymous";
    }

    function initials(client: Client): string {
        const name = client.clientEmail ?? client.clientIdentifier ?? "?";
        return name.slice(0, 2).toUpperCase();
    }

    function timeAgo(dateStr: string | null): string {
        if (!dateStr) return "—";
        const diff = Date.now() - new Date(dateStr).getTime();
        const days = Math.floor(diff / 86_400_000);
        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    // Engagement score: weighted sum of selections + comments
    function engagementScore(client: Client): number {
        return client.totalSelections * 2 + client.totalComments;
    }

    const maxScore = $derived(
        topClients.length > 0 ? Math.max(...topClients.map(engagementScore), 1) : 1
    );

    const avatarColors = [
        "bg-indigo-100 text-indigo-700",
        "bg-rose-100 text-rose-700",
        "bg-emerald-100 text-emerald-700",
        "bg-amber-100 text-amber-700",
        "bg-violet-100 text-violet-700",
        "bg-cyan-100 text-cyan-700",
    ];
</script>

<div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <h2 class="font-bold text-base-content text-base">Top Clients</h2>
        <span class="text-xs font-semibold text-base-content/40">{topClients.length} clients</span>
    </div>

    {#if topClients.length === 0}
        <div class="flex flex-col items-center justify-center py-16 text-base-content/25 gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <p class="text-sm italic">No client activity yet</p>
        </div>
    {:else}
        <div class="divide-y divide-gray-50">
            {#each topClients.slice(0, 6) as client, i (client.clientIdentifier ?? i)}
                {@const score = engagementScore(client)}
                {@const pct = Math.round((score / maxScore) * 100)}
                {@const colorClass = avatarColors[i % avatarColors.length]}
                <div id="top-client-{i}" class="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                    <div class="flex items-center gap-3">
                        <!-- Avatar -->
                        <div class="w-9 h-9 rounded-full {colorClass} flex items-center justify-center text-xs font-black shrink-0">
                            {initials(client)}
                        </div>
                        <!-- Info -->
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-sm text-base-content truncate">
                                {displayName(client)}
                            </div>
                            <div class="text-[11px] text-base-content/40 truncate mt-0.5">
                                in "{client.galleryTitle}"
                            </div>
                        </div>
                        <!-- Last seen -->
                        <div class="text-[11px] font-semibold text-base-content/35 shrink-0">
                            {timeAgo(client.lastActivity)}
                        </div>
                    </div>

                    <!-- Engagement bar + stats -->
                    <div class="mt-3 ml-12">
                        <div class="flex items-center justify-between mb-1">
                            <div class="flex items-center gap-3 text-[11px] font-semibold text-base-content/40">
                                <span class="flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-rose-400" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                                    </svg>
                                    {client.totalSelections} picks
                                </span>
                                <span class="flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                                        <path fill-rule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clip-rule="evenodd" />
                                    </svg>
                                    {client.totalComments} comments
                                </span>
                            </div>
                        </div>
                        <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                class="h-full bg-gradient-to-r from-indigo-400 to-rose-400 rounded-full transition-all duration-700"
                                style="width: {pct}%"
                            ></div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
