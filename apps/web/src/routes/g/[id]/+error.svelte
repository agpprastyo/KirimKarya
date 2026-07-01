<script lang="ts">
    import { page } from "$app/state";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";
</script>

<svelte:head>
    <title>Gallery Unavailable | Kirim Karya</title>
</svelte:head>

<div class="min-h-screen bg-base-100 text-base-content relative flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
    <!-- Premium glassmorphic/ambient lights -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,oklch(var(--p)/0.06),transparent_60%)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,oklch(var(--a)/0.04),transparent_60%)]"></div>

    <!-- Theme Toggle at the top corner -->
    <div class="absolute top-6 right-6">
        <ThemeToggle />
    </div>

    <div class="max-w-md w-full space-y-8 relative z-10">
        <div class="inline-flex items-center justify-center p-6 bg-warning/10 text-warning rounded-[2.5rem] mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
        </div>

        <h1 class="text-5xl font-black tracking-tighter leading-none">
            {page.status === 404 ? "Gallery Not Found" : "Access Unavailable"}
        </h1>
        
        <p class="text-base-content/40 font-bold uppercase tracking-wider text-[10px] italic">
            Kirim Karya Client Proofing
        </p>

        <div class="bg-base-200/50 p-8 rounded-4xl border border-base-content/5 backdrop-blur-2xl space-y-4">
            <p class="text-sm opacity-80 leading-relaxed font-medium">
                {#if page.status === 404}
                    The requested gallery proofing window either does not exist, has been removed by the photographer, or has an invalid URL.
                {:else}
                    {page.error?.message || "You do not have access to view this proofing gallery. Please check your credentials or contact the owner."}
                {/if}
            </p>
            <div class="text-[10px] font-black uppercase text-base-content/30 tracking-widest pt-2">
                URL Parameter: {page.params.id || "Unknown ID"}
            </div>
        </div>

        <div class="pt-6 space-y-4">
            <a href="/" class="btn btn-primary rounded-2xl font-black px-12 shadow-xl shadow-primary/20 h-14 w-full">
                Back to Home Page
            </a>
            <button onclick={() => window.history.back()} class="btn btn-ghost font-bold opacity-50 hover:opacity-100 text-xs italic underline underline-offset-8">
                Go back to previous page
            </button>
        </div>
    </div>
</div>
