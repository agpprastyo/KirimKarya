<script lang="ts">
    interface Props {
        totalPhotos: number;
        selectedPhotosCount: number;
        galleryId: string;
        copyShareLink: () => void;
    }

    let { totalPhotos, selectedPhotosCount, galleryId, copyShareLink }: Props = $props();
</script>

<div
    class="card bg-base-100 border border-base-content/5 p-8 rounded-4xl space-y-6"
>
    <h3 class="text-xl font-black">Gallery Insights</h3>
    <div class="grid grid-cols-2 gap-4">
        <div class="bg-base-200/50 p-6 rounded-3xl">
            <p class="text-xs font-bold opacity-40 mb-1">
                TOTAL PHOTOS
            </p>
            <p class="text-3xl font-black">
                {totalPhotos}
            </p>
        </div>
        <div class="bg-primary/5 p-6 rounded-3xl text-primary">
            <p class="text-xs font-bold opacity-60 mb-1">
                SELECTED
            </p>
            <p class="text-3xl font-black">
                {selectedPhotosCount}
            </p>
        </div>
    </div>

    <div class="pt-4">
        <p class="text-sm font-medium text-base-content/60">
            The client can view this gallery at:
        </p>
        <div
            class="mt-2 p-4 bg-base-200 rounded-2xl flex items-center justify-between gap-4 overflow-hidden"
        >
            <code class="text-xs font-bold truncate opacity-50">
                /g/{galleryId}
            </code>
            <button
                onclick={copyShareLink}
                class="btn btn-ghost btn-xs font-black shrink-0 cursor-pointer"
            >
                Copy
            </button>
        </div>
    </div>
</div>
