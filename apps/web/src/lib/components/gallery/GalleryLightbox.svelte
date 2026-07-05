<script lang="ts">
    interface Photo {
        id: string;
        filename?: string;
        watermarkUrl?: string | null;
        thumbnailUrl?: string | null;
        comment?: string | null;
        isSelected: boolean;
    }

    interface Props {
        photos: Photo[];
        selectedIndex: number;
        onClose: () => void;
        onNavigate: (index: number) => void;
        onToggleSelection: (photoId: string) => void;
        onSaveComment: (photoId: string, comment: string) => void;
        shortlistedCount: number;
        selectionLimit: number;
    }

    let {
        photos,
        selectedIndex,
        onClose,
        onNavigate,
        onToggleSelection,
        onSaveComment,
        shortlistedCount,
        selectionLimit,
    }: Props = $props();

    const photo = $derived(photos[selectedIndex]);

    // Zoom & pan state
    let zoomScale = $state(1);
    let panX = $state(0);
    let panY = $state(0);
    let isPanning = $state(false);
    let startX = 0;
    let startY = 0;
    let imageContainerEl = $state<HTMLDivElement | null>(null);

    // Per-photo rotation
    let photoRotations = $state<Record<string, number>>({});
    const rotationDegrees = $derived(
        photo ? (photoRotations[photo.id] || 0) : 0
    );

    function resetZoom() {
        zoomScale = 1;
        panX = 0;
        panY = 0;
        isPanning = false;
    }

    $effect(() => {
        if (selectedIndex !== null) resetZoom();
    });

    $effect(() => {
        const el = imageContainerEl;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = 0.15;
            zoomScale = e.deltaY < 0
                ? Math.min(zoomScale + factor, 5)
                : Math.max(zoomScale - factor, 0.7);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    });

    function handleMouseDown(e: MouseEvent) {
        if (zoomScale <= 1) return;
        e.preventDefault();
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    }
    function handleMouseMove(e: MouseEvent) {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
    }
    function handleMouseUp() { isPanning = false; }

    function handleRotate(dir: "cw" | "ccw") {
        if (!photo) return;
        const cur = photoRotations[photo.id] || 0;
        photoRotations[photo.id] = dir === "cw"
            ? (cur + 90) % 360
            : (cur - 90 + 360) % 360;
        resetZoom();
    }

    // Keyboard navigation
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowLeft" && selectedIndex > 0) onNavigate(selectedIndex - 1);
        if (e.key === "ArrowRight" && selectedIndex < photos.length - 1) onNavigate(selectedIndex + 1);
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if photo}
<div class="fixed inset-0 z-[9999] bg-base-100 flex flex-col md:flex-row animate-in fade-in duration-300 overflow-hidden">
    <!-- Left Pane: Image Viewer -->
    <div class="flex-1 h-full flex flex-col relative bg-base-200/30 overflow-hidden">
        <!-- Viewer Header -->
        <div class="h-20 flex items-center justify-between px-6 bg-base-100/10 border-b border-base-content/5 z-10">
            <span class="text-xs font-black italic opacity-60 uppercase tracking-widest bg-base-200/80 px-3 py-1.5 rounded-full">
                {selectedIndex + 1} / {photos.length}
            </span>
            <div class="flex items-center gap-2">
                <button onclick={() => handleRotate("ccw")} class="btn btn-ghost btn-circle btn-sm animate-none" title="Rotate Counter-Clockwise">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                </button>
                <button onclick={() => handleRotate("cw")} class="btn btn-ghost btn-circle btn-sm animate-none" title="Rotate Clockwise">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                    </svg>
                </button>
                <button onclick={onClose} class="btn btn-ghost btn-circle btn-sm md:hidden" aria-label="Close Lightbox">✕</button>
            </div>
        </div>

        <!-- Viewport -->
        <div class="flex-1 relative flex items-center justify-center p-4 min-h-0">
            <button disabled={selectedIndex === 0} onclick={() => onNavigate(selectedIndex - 1)}
                class="absolute left-4 z-25 w-12 h-12 rounded-full bg-base-100/50 hover:bg-base-100/80 flex items-center justify-center disabled:opacity-0 transition-opacity border border-base-content/5 cursor-pointer shadow-md"
                aria-label="Previous Photo">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
            </button>

            <div bind:this={imageContainerEl} class="w-full h-full flex items-center justify-center max-w-[85%] max-h-[85%] relative overflow-hidden">
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <img
                    src={photo.watermarkUrl}
                    alt="Selected preview"
                    onmousedown={handleMouseDown}
                    onmousemove={handleMouseMove}
                    onmouseup={handleMouseUp}
                    onmouseleave={handleMouseUp}
                    ondblclick={resetZoom}
                    class="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-base-content/5 animate-in zoom-in duration-300 select-none"
                    style="transform: translate({panX}px, {panY}px) scale({zoomScale}) rotate({rotationDegrees}deg); transition: {isPanning ? 'none' : 'transform 0.15s ease-out'}; cursor: {zoomScale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in'};"
                    draggable="false"
                />
            </div>

            <button disabled={selectedIndex === photos.length - 1} onclick={() => onNavigate(selectedIndex + 1)}
                class="absolute right-4 z-25 w-12 h-12 rounded-full bg-base-100/50 hover:bg-base-100/80 flex items-center justify-center disabled:opacity-0 transition-opacity border border-base-content/5 cursor-pointer shadow-md"
                aria-label="Next Photo">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="size-6">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
            </button>
        </div>
    </div>

    <!-- Right Pane: Sidebar -->
    <div class="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-base-content/10 bg-base-100 flex flex-col h-full z-20">
        <div class="h-20 px-6 md:px-8 border-b border-base-content/5 flex items-center justify-between">
            <div>
                <h3 class="text-sm font-black uppercase tracking-wider opacity-60">Photo Info</h3>
                <p class="text-[11px] font-mono opacity-40 truncate max-w-[200px]">{photo.filename || `IMG_${photo.id.slice(0, 8)}`}</p>
            </div>
            <button onclick={onClose} class="btn btn-ghost btn-circle btn-sm hidden md:flex" aria-label="Close Lightbox">✕</button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            <!-- Selection badge -->
            <div class="flex items-center justify-between bg-base-200/50 p-4 rounded-2xl border border-base-content/5">
                <span class="text-xs font-black uppercase opacity-55">Selection Status</span>
                <span class="badge font-black text-[10px] uppercase px-3 py-1 {photo.isSelected ? 'badge-primary' : 'badge-ghost border-base-content/10'}">
                    {photo.isSelected ? 'Selected' : 'Not Selected'}
                </span>
            </div>

            <!-- Quota progress -->
            {#if selectionLimit > 0}
                <div class="bg-base-200/50 p-4 rounded-2xl border border-base-content/5 space-y-2">
                    <div class="flex items-center justify-between text-[10px] font-black tracking-widest uppercase opacity-55">
                        <span>Shortlist Progress</span>
                        <span class={shortlistedCount > selectionLimit ? 'text-error' : 'text-primary'}>
                            {shortlistedCount} / {selectionLimit}
                        </span>
                    </div>
                    <div class="w-full bg-base-300 rounded-full h-1.5 overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-300 {shortlistedCount > selectionLimit ? 'bg-error' : shortlistedCount === selectionLimit ? 'bg-success' : 'bg-primary'}"
                            style="width: {Math.min((shortlistedCount / selectionLimit) * 100, 100)}%">
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Comment -->
            <div class="space-y-2">
                <label class="label p-0" for="lightbox-comment">
                    <span class="label-text text-[10px] font-black uppercase tracking-wider opacity-60">Comments & Instructions</span>
                </label>
                <textarea
                    id="lightbox-comment"
                    placeholder="Add sizing request, retouch notes, or special instructions..."
                    class="textarea textarea-bordered w-full bg-base-200/40 rounded-2xl border-base-content/10 focus:border-primary/50 transition-all py-4 px-6 min-h-[140px] text-sm resize-none"
                    value={photo.comment || ""}
                    oninput={(e) => onSaveComment(photo.id, e.currentTarget.value)}
                ></textarea>
            </div>
        </div>

        <!-- Sidebar CTA -->
        <div class="p-6 md:p-8 border-t border-base-content/5 bg-base-200/20">
            <button onclick={() => onToggleSelection(photo.id)}
                class="btn btn-lg w-full h-14 rounded-2xl font-black transition-all gap-2 duration-300 shadow-xl {photo.isSelected ? 'btn-primary shadow-primary/20 hover:scale-[1.01]' : 'btn-outline border-base-content/25 hover:bg-primary hover:text-primary-content hover:border-primary hover:scale-[1.01]'}">
                <svg xmlns="http://www.w3.org/2000/svg" fill={photo.isSelected ? "currentColor" : "none"} viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z" />
                </svg>
                <span>{photo.isSelected ? 'Shortlisted' : 'Add to Shortlist'}</span>
            </button>
        </div>
    </div>
</div>
{/if}
