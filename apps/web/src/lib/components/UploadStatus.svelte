<script lang="ts">
    import { Motion, AnimatePresence } from "svelte-motion";
    import { fade, fly } from "svelte/transition";

    let { 
        isUploading = false,
        total = 0,
        completed = 0,
        failed = 0
    } = $props();

    const progress = $derived(total > 0 ? Math.round(((completed + failed) / total) * 100) : 0);
    const isFinished = $derived((completed + failed) === total && total > 0);
</script>

<AnimatePresence>
    {#if isUploading || isFinished}
        <div class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
            <Motion
                initial={{ y: 100, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 100, opacity: 0, scale: 0.9 }}
            >
                <div class="bg-base-100 border border-base-content/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-3xl p-6 backdrop-blur-xl">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-3">
                            {#if isFinished}
                                <div class="size-8 bg-success/20 text-success rounded-full flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="size-4">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                    </svg>
                                </div>
                                <span class="font-black text-sm tracking-tight">Upload Complete</span>
                            {:else}
                                <div class="size-8 bg-primary/20 text-primary rounded-full flex items-center justify-center animate-pulse">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="size-4">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                                    </svg>
                                </div>
                                <span class="font-black text-sm tracking-tight">Uploading Moments...</span>
                            {/if}
                        </div>
                        <span class="text-[10px] font-black opacity-30 uppercase tracking-widest">{completed + failed} / {total} Photos</span>
                    </div>

                    <!-- Progress Bar -->
                    <div class="h-3 bg-base-200 rounded-full overflow-hidden mb-2">
                        <div 
                            class="h-full bg-primary transition-all duration-500 ease-out" 
                            style="width: {progress}%"
                        ></div>
                    </div>

                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black opacity-40 uppercase tracking-widest">Progress {progress}%</span>
                        {#if failed > 0}
                            <span class="text-[10px] font-black text-error uppercase tracking-widest">{failed} Failed</span>
                        {/if}
                    </div>
                </div>
            </Motion>
        </div>
    {/if}
</AnimatePresence>
