<script lang="ts">
    import { page } from "$app/state";
</script>

<svelte:head>
    <title>An Error Occurred | Kirim Karya</title>
</svelte:head>

<div class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden select-none">
    <!-- Sleek, ambient radial background gradient -->
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(var(--p)/0.08),transparent_50%)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,oklch(var(--s)/0.05),transparent_50%)]"></div>

    <div class="max-w-md w-full space-y-8 relative z-10">
        <div class="inline-flex items-center justify-center p-6 bg-error/10 text-error rounded-[2.5rem] mb-4 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="size-16">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
        </div>
        
        <h1 class="text-6xl font-black tracking-tighter leading-none">
            Oops!
        </h1>
        <p class="text-base-content/40 font-bold uppercase tracking-wider text-xs">
            Something went sideways
        </p>

        <div class="bg-base-200/50 p-6 rounded-3xl border border-base-content/5 backdrop-blur-xl">
            <p class="text-sm opacity-80 font-medium leading-relaxed">
                {page.error?.message || "An unexpected application error has occurred. Please try reloading the page or check back later."}
            </p>
            {#if page.status}
                <div class="badge badge-error/10 text-error font-black mt-4 px-4 py-3 rounded-full text-xs">
                    STATUS {page.status}
                </div>
            {/if}
        </div>

        <div class="pt-6 flex flex-col sm:flex-row gap-4 justify-center">
            <button onclick={() => window.location.reload()} class="btn btn-outline border-base-content/20 hover:bg-base-content/5 rounded-2xl font-black px-8 h-14">
                Reload Page
            </button>
            <a href="/" class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20 h-14">
                Return Home
            </a>
        </div>
    </div>
</div>
