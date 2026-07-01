<script lang="ts">
    import { Motion } from "svelte-motion";

    interface Photo {
        id: string;
        watermarkUrl?: string;
        thumbnailUrl?: string;
        comment?: string;
        isSelected: boolean;
    }

    interface Props {
        photos: Photo[];
        onSelect: (index: number) => void;
        onToggleSelection: (photoId: string) => void;
    }

    let { photos, onSelect, onToggleSelection }: Props = $props();
</script>

<div class="px-4 md:px-8 pb-32">
    <div class="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
        {#each photos as photo, i}
            <Motion
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
            >
                <div class="relative group break-inside-avoid rounded-3xl overflow-hidden bg-base-200 border border-base-content/5 transition-all hover:shadow-2xl hover:shadow-primary/5 inline-block w-full mb-4">
                    <button class="w-full text-left focus:outline-hidden cursor-zoom-in" onclick={() => onSelect(i)}>
                        <img
                            src={photo.watermarkUrl || photo.thumbnailUrl}
                            alt="Gallery preview"
                            class="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                        />
                    </button>

                    <!-- Actions Overlay -->
                    <div class="absolute top-4 right-4 z-10 flex gap-2">
                        {#if photo.comment}
                            <div class="btn btn-circle btn-sm bg-black/20 text-white backdrop-blur-md border border-white/20 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-4">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                                </svg>
                            </div>
                        {/if}
                        <button
                            onclick={() => onToggleSelection(photo.id)}
                            class="btn btn-circle btn-sm shadow-2xl backdrop-blur-md border border-white/20 transition-all {photo.isSelected ? 'bg-primary text-primary-content' : 'bg-black/20 text-white hover:bg-primary/80'}"
                            aria-label={photo.isSelected ? "Deselect photo" : "Select photo"}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill={photo.isSelected ? "currentColor" : "none"} viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-4">
                                <path stroke-linecap="round" stroke-linejoin="round" d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </Motion>
        {/each}
    </div>
</div>
