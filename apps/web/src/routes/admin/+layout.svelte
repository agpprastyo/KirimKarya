<script lang="ts">
    import { useSession, signOut } from "$lib/auth-client";
    import { page } from "$app/state";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";
    import Avatar from "$lib/components/Avatar.svelte";
    import { goto } from "$app/navigation";
    import MeshBackground from "$lib/components/MeshBackground.svelte";
    import { localizeHref } from "$lib/paraglide/runtime.js";

    import * as m from "$lib/paraglide/messages.js";
    import LocaleSwitcher from "$lib/components/LocaleSwitcher.svelte";

    let { children } = $props();

    const session = useSession();

    const handleLogout = async () => {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    goto("/");
                },
            },
        });
    };

    const menuItems = $derived([
        {
            label: m.admin_dashboard(),
            href: "/admin",
            icon: "M13 10V3L4 14h7v7l9-11h-7z",
        },
        {
            label: m.user_management(),
            href: "/admin/users",
            icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
        },
    ]);
</script>

<div
    class="drawer lg:drawer-open h-screen bg-base-100 relative overflow-hidden"
>
    <MeshBackground />

    <input id="admin-drawer" type="checkbox" class="drawer-toggle" />

    <div class="drawer-content flex flex-col h-screen overflow-y-auto">
        <main class="p-4 grow">
            {@render children()}
        </main>
    </div>

    <div
        class="drawer-side z-60 is-drawer-close:overflow-visible p-4 h-screen overflow-hidden"
    >
        <label
            for="admin-drawer"
            aria-label="close sidebar"
            class="drawer-overlay"
        ></label>

        <aside
            class="flex min-h-full flex-col rounded-xl bg-base-100 border-r border-base-content/5 transition-all duration-300 ease-in-out is-drawer-close:w-16 is-drawer-open:w-72 is-drawer-close:items-center"
        >
            <!-- Sidebar Header -->
            <div
                class="flex items-center justify-between p-4 border-b border-base-content/5 w-full is-drawer-close:justify-center"
            >
                <a
                    href={localizeHref("/")}
                    class="flex items-center gap-2 text-xl font-bold tracking-tight is-drawer-close:hidden"
                >
                    <span class="text-primary">Kirim</span>Karya
                    <span
                        class="badge badge-ghost border-primary/30 text-primary font-bold text-[10px] py-0 px-2"
                        >ADMIN</span
                    >
                </a>

                <label
                    for="admin-drawer"
                    aria-label="toggle sidebar"
                    class="btn btn-square btn-ghost btn-sm"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                        stroke-width="2"
                        fill="none"
                        stroke="currentColor"
                        class="size-5 transition-transform is-drawer-open:rotate-180"
                    >
                        <path
                            d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"
                        ></path>
                        <path d="M9 4v16"></path>
                        <path d="M14 10l2 2l-2 2"></path>
                    </svg>
                </label>
            </div>

            <!-- Navigation -->
            <nav
                class="flex-1 p-3 is-drawer-close:px-0 is-drawer-close:py-4 space-y-2 mt-2 w-full flex flex-col is-drawer-close:items-center"
            >
                {#each menuItems as item}
                    <a
                        href={localizeHref(item.href)}
                        class="flex items-center gap-4 px-3 py-3 rounded-xl font-bold transition-all
                        {page.url.pathname === item.href
                            ? 'bg-primary text-primary-content'
                            : 'text-base-content/60 hover:text-primary hover:bg-primary/5'}
                        is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center is-drawer-close:size-12 is-drawer-close:p-0 is-drawer-close:mx-auto is-drawer-close:gap-0"
                        data-tip={item.label}
                    >
                        <div
                            class="flex-none flex items-center justify-center w-6 h-6"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                stroke="currentColor"
                                class="size-6"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d={item.icon}
                                />
                            </svg>
                        </div>
                        <span class="truncate is-drawer-close:hidden"
                            >{item.label}</span
                        >
                    </a>
                {/each}
            </nav>

            <!-- Sidebar Footer -->
            <div
                class="mt-auto border-t border-base-content/5 p-4 is-drawer-close:p-2 is-drawer-close:pb-4 space-y-4"
            >
                <div
                    class="flex items-center gap-2 is-drawer-close:justify-center"
                >
                    <div class="flex-1 is-drawer-close:hidden">
                        <LocaleSwitcher />
                    </div>
                    <div
                        class="flex items-center justify-center p-2 bg-base-100 border border-base-content/5 rounded-xl hover:border-primary/20 transition-all"
                    >
                        <ThemeToggle />
                    </div>
                </div>

                <a
                    href={localizeHref("/admin/profile")}
                    class="flex items-center gap-3 p-2 rounded-2xl hover:bg-base-200/50 transition-all group is-drawer-close:justify-center"
                >
                    <Avatar
                        src={$session.data?.user?.image}
                        name={$session.data?.user?.name || "Admin"}
                        size="sm"
                        ring={false}
                        shape="square"
                    />

                    <div class="flex-1 min-w-0 is-drawer-close:hidden">
                        <p
                            class="text-xs font-black truncate group-hover:text-primary transition-colors"
                        >
                            {$session.data?.user?.name || "Admin"}
                        </p>
                        <p class="text-[10px] opacity-40 truncate">
                            {$session.data?.user?.email}
                        </p>
                    </div>
                </a>

                <button
                    onclick={handleLogout}
                    class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[10px] font-black hover:bg-error/10 hover:text-error transition-all border border-base-content/5 group is-drawer-close:p-2"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="size-4 opacity-50 group-hover:opacity-100"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                    >
                        <path
                            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                        />
                    </svg>
                    <span class="is-drawer-close:hidden">{m.logout()}</span>
                </button>
            </div>
        </aside>
    </div>
</div>
