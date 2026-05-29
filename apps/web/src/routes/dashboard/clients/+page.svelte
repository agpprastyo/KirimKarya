<script lang="ts">
    import { api, handleResponse } from "$lib/api";
    import { createQuery } from "@tanstack/svelte-query";
    import { Motion } from "svelte-motion";

    const clientsQuery = createQuery(() => ({
        queryKey: ["stats", "clients"],
        queryFn: () => handleResponse((api.api.stats as any).clients.$get()).then((res: any) => res.data),
        refetchInterval: 30000,
    }));

    let searchTerm = $state("");
    let selectedGallery = $state("all");
    let reminderClientId = $state<string | null>(null);
    let reminderMessage = $state("");
    let isSendingReminder = $state(false);
    let reminderSent = $state(false);

    const filteredClients = $derived(() => {
        if (!clientsQuery.data) return [];
        return clientsQuery.data.filter((c: any) => {
            const matchSearch = !searchTerm ||
                (c.clientEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.galleryTitle || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.clientIdentifier || "").includes(searchTerm);
            const matchGallery = selectedGallery === "all" || c.galleryId === selectedGallery;
            return matchSearch && matchGallery;
        });
    });

    const uniqueGalleries = $derived(() => {
        if (!clientsQuery.data) return [];
        const seen = new Map<string, string>();
        for (const c of clientsQuery.data) {
            if (!seen.has(c.galleryId)) seen.set(c.galleryId, c.galleryTitle);
        }
        return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
    });

    async function sendReminder() {
        if (!reminderMessage.trim() || !reminderClientId) return;
        const clientObj = clientsQuery.data?.find((c: any) => c.clientIdentifier === reminderClientId);
        if (!clientObj) return;

        isSendingReminder = true;
        try {
            const res = await (api.api.stats as any)["clients"]["send-reminder"].$post({
                json: {
                    clientEmail: reminderClientId,
                    galleryId: clientObj.galleryId,
                    message: reminderMessage,
                },
            });
            if (res.ok) {
                reminderSent = true;
            }
        } catch (e) {
            console.error("Failed to send reminder:", e);
        } finally {
            isSendingReminder = false;
        }

        setTimeout(() => {
            reminderSent = false;
            reminderClientId = null;
            reminderMessage = "";
        }, 2500);
    }

    function deliveryBadge(status: string) {
        if (status === "COMPLETED") return "badge-success";
        if (status === "PROCESSING" || status === "QUEUED") return "badge-warning";
        if (status === "FAILED") return "badge-error";
        return "badge-ghost";
    }
</script>

<svelte:head>
    <title>Clients | Kirim Karya</title>
    <meta name="description" content="Client CRM hub — manage all your photography session clients, review selection activity, and send instant email reminders." />
</svelte:head>

<div class="space-y-10 pb-20">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 class="text-4xl font-black tracking-tight">Clients</h1>
            <p class="text-base-content/60 mt-2 font-medium">
                Manage all your photography clients, track activity, and send instant reminders.
            </p>
        </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-4 absolute left-4 top-1/2 -translate-y-1/2 opacity-40">
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
                id="client-search"
                type="text"
                placeholder="Search by email, name, or gallery..."
                bind:value={searchTerm}
                class="input input-bordered w-full rounded-2xl pl-11 font-medium"
            />
        </div>
        <select
            id="gallery-filter"
            bind:value={selectedGallery}
            class="select select-bordered rounded-2xl font-bold min-w-48"
        >
            <option value="all">All Galleries</option>
            {#each uniqueGalleries() as g}
                <option value={g.id}>{g.title}</option>
            {/each}
        </select>
    </div>

    {#if clientsQuery.isLoading}
        <div class="space-y-3">
            {#each Array(5) as _}
                <div class="h-20 bg-base-200 animate-pulse rounded-2xl"></div>
            {/each}
        </div>
    {:else if clientsQuery.error}
        <div role="alert" class="alert alert-error alert-soft rounded-2xl font-semibold">
            Error loading clients: {clientsQuery.error.message}
        </div>
    {:else if clientsQuery.data}
        <!-- Stats strip -->
        {@const fc = filteredClients()}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            {#each [
                { label: "Total Clients", value: fc.length, icon: "👥" },
                { label: "Total Selections", value: fc.reduce((s: number, c: any) => s + c.totalSelections, 0), icon: "❤️" },
                { label: "Total Comments", value: fc.reduce((s: number, c: any) => s + c.totalComments, 0), icon: "💬" },
                { label: "Delivered", value: fc.filter((c: any) => c.deliveryStatus === "COMPLETED").length, icon: "✅" },
            ] as stat}
                <div class="card bg-base-100 border border-base-content/5 p-5 hover:border-primary/20 transition-colors">
                    <div class="text-xl mb-1">{stat.icon}</div>
                    <div class="text-2xl font-black">{stat.value}</div>
                    <div class="text-[10px] font-black uppercase opacity-40">{stat.label}</div>
                </div>
            {/each}
        </div>

        <!-- Client table -->
        <Motion initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div class="card bg-base-100 border border-base-content/5 overflow-hidden">
                {#if fc.length === 0}
                    <div class="text-center py-16 opacity-30 italic text-sm">No clients found{searchTerm ? " matching your search" : ""}.</div>
                {:else}
                    <div class="overflow-x-auto">
                        <table class="table">
                            <thead>
                                <tr class="text-[10px] uppercase font-black opacity-40 border-b border-base-content/5">
                                    <th class="bg-base-100">Client</th>
                                    <th class="bg-base-100">Gallery</th>
                                    <th class="bg-base-100 text-center">Selections</th>
                                    <th class="bg-base-100 text-center">Comments</th>
                                    <th class="bg-base-100 text-center">Delivery</th>
                                    <th class="bg-base-100 text-center">Last Active</th>
                                    <th class="bg-base-100"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each fc as client, i}
                                    <Motion
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                    >
                                        <tr class="hover:bg-base-200/40 transition-colors border-b border-base-content/5 last:border-0">
                                            <td>
                                                <div class="flex items-center gap-3">
                                                    <div class="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0">
                                                        {(client.clientEmail || client.clientIdentifier || "?")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div class="font-bold text-sm">{client.clientIdentifier || client.clientEmail || "Anonymous"}</div>
                                                        {#if client.clientEmail && client.clientEmail !== client.clientIdentifier}
                                                            <div class="text-[10px] opacity-40 font-medium">Owner: {client.clientEmail}</div>
                                                        {/if}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <a href="/dashboard/galleries/{client.galleryId}" class="font-bold text-sm hover:text-primary transition-colors">
                                                    {client.galleryTitle}
                                                </a>
                                            </td>
                                            <td class="text-center">
                                                <span class="font-black text-primary">{client.totalSelections}</span>
                                            </td>
                                            <td class="text-center">
                                                <span class="font-black opacity-70">{client.totalComments}</span>
                                            </td>
                                            <td class="text-center">
                                                <span class="badge {deliveryBadge(client.deliveryStatus)} badge-sm font-black text-[9px]">
                                                    {client.deliveryStatus}
                                                </span>
                                            </td>
                                            <td class="text-center">
                                                <span class="text-xs opacity-50 font-bold">
                                                    {client.lastActivity ? new Date(client.lastActivity).toLocaleDateString() : "—"}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    id="remind-btn-{i}"
                                                    onclick={() => { reminderClientId = client.clientIdentifier; reminderMessage = ""; }}
                                                    class="btn btn-xs btn-ghost rounded-xl font-black hover:btn-primary"
                                                >
                                                    Remind
                                                </button>
                                            </td>
                                        </tr>
                                    </Motion>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>
        </Motion>
    {/if}
</div>

<!-- Quick Reminder Slide-out Panel -->
{#if reminderClientId}
    <button
        type="button"
        class="fixed inset-0 z-40 bg-base-content/20 backdrop-blur-sm cursor-default"
        onclick={() => reminderClientId = null}
        aria-label="Close reminder panel"
    ></button>
    <div class="fixed right-0 top-0 bottom-0 z-50 w-96 bg-base-100 border-l border-base-content/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div class="p-6 border-b border-base-content/5 flex items-center justify-between">
            <div>
                <h3 class="font-black text-lg">Send Reminder</h3>
                <p class="text-[10px] font-bold opacity-40 uppercase mt-1">Quick client notification</p>
            </div>
            <button class="btn btn-circle btn-ghost btn-sm" onclick={() => reminderClientId = null}>✕</button>
        </div>

        <div class="flex-1 p-6 space-y-6 overflow-y-auto">
            <div class="bg-base-200/50 p-4 rounded-2xl">
                <div class="text-[10px] font-black uppercase opacity-40 mb-1">Sending to</div>
                <div class="font-black text-sm font-mono">{reminderClientId?.slice(0, 16)}…</div>
            </div>

            <div class="space-y-3">
                {#each [
                    "Only 3 days left to submit your wedding book selections!",
                    "Your gallery is ready for review. Please select your favorite photos.",
                    "Hi! Just a friendly reminder to check your gallery and make your selections.",
                ] as template}
                    <button
                        onclick={() => reminderMessage = template}
                        class="w-full text-left p-3 rounded-xl border border-base-content/10 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-all"
                    >
                        "{template}"
                    </button>
                {/each}
            </div>

            <div class="form-control">
                <label class="label p-0 mb-2" for="reminder-message">
                    <span class="label-text font-black uppercase text-[10px] opacity-40">Custom Message</span>
                </label>
                <textarea
                    id="reminder-message"
                    bind:value={reminderMessage}
                    placeholder="Type a personal message..."
                    class="textarea textarea-bordered rounded-2xl font-medium min-h-[120px] resize-none"
                ></textarea>
            </div>
        </div>

        <div class="p-6 border-t border-base-content/5">
            {#if reminderSent}
                <div class="alert alert-success rounded-2xl font-black text-sm animate-in zoom-in-95">
                    ✓ Reminder queued successfully!
                </div>
            {:else}
                <button
                    id="send-reminder-btn"
                    onclick={sendReminder}
                    disabled={!reminderMessage.trim() || isSendingReminder}
                    class="btn btn-primary w-full rounded-2xl font-black h-12 shadow-xl shadow-primary/20"
                >
                    {#if isSendingReminder}
                        <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        </svg>
                        Send Reminder
                    {/if}
                </button>
            {/if}
        </div>
    </div>
{/if}
