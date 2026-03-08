<script lang="ts">
    import ThemeToggle from "./ThemeToggle.svelte";
    import { useSession } from "$lib/auth-client";

    const session = useSession();
</script>

<nav class="navbar bg-transparent sticky top-0 z-50 py-4 max-w-7xl mx-auto">
    <div class="flex-1">
        <a href="/" class="flex items-center gap-2 group">
            <div
                class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-content font-black text-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform"
            >
                K
            </div>
            <span class="text-2xl font-bold tracking-tight text-base-content">
                KirimKarya
            </span>
        </a>
    </div>
    <div class="flex-none hidden lg:flex items-center gap-8 mr-8">
        <a
            href="#features"
            class="text-sm font-medium hover:text-primary transition-colors"
            >Features</a
        >
        <a
            href="#solutions"
            class="text-sm font-medium hover:text-primary transition-colors"
            >Solutions</a
        >
        <a
            href="#blog"
            class="text-sm font-medium hover:text-primary transition-colors"
            >Blog</a
        >
        <a
            href="#pricing"
            class="text-sm font-medium hover:text-primary transition-colors"
            >Pricing</a
        >
    </div>
    <div class="flex-none gap-2">
        <ThemeToggle />
        {#if $session.data}
            {#if $session.data.user.role === "admin"}
                <a
                    href="/admin"
                    class="btn btn-primary btn-sm rounded-xl font-bold px-4 shadow-lg shadow-primary/20"
                >
                    Admin Panel
                </a>
            {/if}
            <a
                href={$session.data.user.role === "admin"
                    ? "/admin"
                    : "/dashboard"}
                class="btn btn-ghost rounded-xl font-bold px-6"
            >
                Dashboard
            </a>
            {#if $session.data?.user?.image}
                <div class="avatar online ml-2">
                    <div
                        class="w-10 rounded-xl ring ring-primary/30 ring-offset-base-100 ring-offset-2 transition-all hover:ring-primary"
                    >
                        <img
                            src={$session.data.user.image}
                            alt={$session.data.user.name}
                        />
                    </div>
                </div>
            {:else}
                <div class="avatar placeholder ml-2">
                    <div
                        class="bg-primary/10 text-primary w-10 rounded-xl flex items-center justify-center border border-primary/20 transition-all hover:bg-primary/20"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="w-6 h-6 opacity-70"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                                clip-rule="evenodd"
                            />
                        </svg>
                    </div>
                </div>
            {/if}
        {:else}
            <a href="/login" class="btn btn-ghost rounded-xl font-bold px-6"
                >Login</a
            >
            <a
                href="/register"
                class="btn btn-primary rounded-xl px-8 font-black shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
            >
                Join Now
            </a>
        {/if}
    </div>
</nav>
