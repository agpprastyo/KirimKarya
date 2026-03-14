<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import Navbar from "$lib/components/Navbar.svelte";

    let { children } = $props();
    const session = authClient.useSession();

    onMount(() => {
        if (!$session.data && !$session.isPending) {
            goto("/login");
        }
    });

    const menuItems = [
        {
            name: "Overview",
            href: "/dashboard",
            icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
        },
        {
            name: "Galleries",
            href: "/dashboard/galleries",
            icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
        },
        {
            name: "Settings",
            href: "/dashboard/settings",
            icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z",
        },
    ];
</script>

<div class="min-h-screen bg-base-200 flex flex-col">
    <Navbar />

    <div class="flex grow max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 gap-8">
        <!-- Sidebar -->
        <aside class="w-64 shrink-0 hidden lg:block">
            <div
                class="card bg-base-100 shadow-sm border border-base-content/5 p-4 sticky top-28"
            >
                <nav class="space-y-1">
                    {#each menuItems as item}
                        <a
                            href={item.href}
                            class="flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all hover:bg-primary/5 hover:text-primary group"
                        >
                            <svg
                                class="w-5 h-5 opacity-50 group-hover:opacity-100"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d={item.icon}
                                />
                            </svg>
                            {item.name}
                        </a>
                    {/each}
                </nav>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 min-w-0">
            {@render children()}
        </main>
    </div>
</div>
