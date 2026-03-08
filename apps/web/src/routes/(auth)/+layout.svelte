<script lang="ts">
    import type { Snippet } from "svelte";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";

    let { children }: { children: Snippet } = $props();
</script>

<div
    class="min-h-screen relative flex flex-col font-sans selection:bg-primary selection:text-primary-content overflow-x-hidden bg-base-100"
>
    <!-- Mesh Gradient Background -->
    <div class="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <!-- Main Glow -->
        <div
            class="absolute top-[-10%] right-[-10%] w-[70vw] h-[70vw] rounded-full bg-primary/20 blur-[120px] dark:bg-primary/10 animate-pulse"
        ></div>
        <div
            class="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-secondary/20 blur-[100px] dark:bg-secondary/10 animate-pulse"
            style="animation-delay: 2s;"
        ></div>

        <!-- Center Accent -->
        <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-accent/10 blur-[80px] dark:bg-accent/5"
        ></div>
    </div>

    <!-- Theme Toggle Floating -->
    <div class="fixed bottom-4 right-4 z-50">
        <ThemeToggle />
    </div>

    <!-- Branding Header -->
    <div class="relative z-10 w-full p-8 max-w-7xl mx-auto">
        <a href="/" class="flex items-center gap-2 group w-fit">
            <div
                class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-content font-black text-xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform"
            >
                K
            </div>
            <span class="text-2xl font-bold tracking-tight text-base-content"
                >KirimKarya</span
            >
        </a>
    </div>

    <!-- Main Content Container -->
    <main class="relative z-10 grow flex items-center justify-center p-4">
        <div class="w-full max-w-md">
            {@render children()}
        </div>
    </main>
</div>
