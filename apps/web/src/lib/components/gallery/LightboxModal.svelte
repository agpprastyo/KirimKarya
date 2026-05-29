<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        activePreviewIndex: number | null;
        lightboxType: "queued" | "uploaded";
        carouselList: any[];
        isUploading: boolean;
        deletePending: boolean;
        onClose: () => void;
        onRemoveSelectedFile: (id: string) => void;
        onDeleteUploadedPhoto: (index: number) => void;
    }

    let {
        activePreviewIndex = $bindable(),
        lightboxType,
        carouselList,
        isUploading,
        deletePending,
        onClose,
        onRemoveSelectedFile,
        onDeleteUploadedPhoto,
    }: Props = $props();

    const isQueued = $derived(lightboxType === "queued");

    // Zoom & Pan State
    let zoomScale = $state(1);
    let panX = $state(0);
    let panY = $state(0);
    let isPanning = $state(false);
    let startX = 0;
    let startY = 0;
    let imageContainerEl = $state<HTMLDivElement | null>(null);

    function resetZoom() {
        zoomScale = 1;
        panX = 0;
        panY = 0;
        isPanning = false;
    }

    // Reset zoom when switching slides
    $effect(() => {
        if (activePreviewIndex !== null) {
            resetZoom();
        }
    });

    // Native wheel zoom listener with passive: false to enable scroll-to-zoom
    $effect(() => {
        const el = imageContainerEl;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = 0.15;
            if (e.deltaY < 0) {
                zoomScale = Math.min(zoomScale + zoomFactor, 5); // Max 5x zoom
            } else {
                zoomScale = Math.max(zoomScale - zoomFactor, 0.7); // Min 0.7x zoom
            }
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            el.removeEventListener("wheel", onWheel);
        };
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

    function handleMouseUp() {
        isPanning = false;
    }

    function handleKeydown(e: KeyboardEvent) {
        if (activePreviewIndex === null) return;
        if (e.key === "Escape") {
            onClose();
        } else if (e.key === "ArrowLeft" && activePreviewIndex > 0) {
            activePreviewIndex--;
        } else if (
            e.key === "ArrowRight" &&
            activePreviewIndex < carouselList.length - 1
        ) {
            activePreviewIndex++;
        }
    }

    let photoRotations = $state<Record<string, number>>({});

    let rotationDegrees = $derived(
        activePreviewIndex !== null && carouselList[activePreviewIndex]
            ? (photoRotations[carouselList[activePreviewIndex].id] || 0)
            : 0
    );

    function handleRotate(direction: "cw" | "ccw") {
        if (activePreviewIndex === null) return;
        const activePhoto = carouselList[activePreviewIndex];
        if (!activePhoto) return;

        const currentDeg = photoRotations[activePhoto.id] || 0;
        const nextDeg = direction === "cw"
            ? (currentDeg + 90) % 360
            : (currentDeg - 90 + 360) % 360;

        photoRotations[activePhoto.id] = nextDeg;
        resetZoom();
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if activePreviewIndex !== null && carouselList[activePreviewIndex]}
    {@const activeFile = carouselList[activePreviewIndex]}
    {@const activeFileUrl = isQueued
        ? activeFile.previewUrl
        : activeFile.previewUrl || activeFile.thumbnailUrl}
    {@const activeFileName = isQueued ? activeFile.name : activeFile.filename}
    {@const activeFileSize = isQueued ? activeFile.size : null}

    <div
        class="fixed inset-0 z-50 flex flex-col items-center justify-between bg-white/75 backdrop-blur-3xl p-6 md:p-8 select-none animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
    >
        <!-- Top bar (Info and Close) -->
        <div
            class="w-full flex items-center justify-between text-slate-800 z-10"
        >
            <div class="text-left">
                <p
                    class="text-sm font-black truncate max-w-[200px] md:max-w-md"
                >
                    {activeFileName}
                </p>
                <p
                    class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5"
                >
                    {activePreviewIndex + 1} of {carouselList.length}
                    {#if activeFileSize !== null}
                        • {(activeFileSize / (1024 * 1024)).toFixed(2)} MB
                    {/if}
                </p>
            </div>

            <button
                onclick={onClose}
                class="w-12 h-12 rounded-full bg-slate-950/5 hover:bg-slate-950/10 text-slate-800 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer border border-slate-200/50"
                aria-label="Close Lightbox"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="w-6 h-6"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
        <!-- Main Content Area with Navigation (Split Layout for Comments) -->
        <div
            class="relative w-full max-w-[90vw] h-[64vh] flex flex-col md:flex-row items-stretch justify-center my-auto overflow-hidden rounded-3xl gap-6"
        >
            <!-- Left Side: Image Container -->
            <div
                bind:this={imageContainerEl}
                class="relative flex-1 flex items-center justify-center overflow-hidden min-h-[300px]"
            >
                <!-- Left Arrow Button -->
                {#if activePreviewIndex > 0}
                    <button
                        onclick={() => {
                            if (activePreviewIndex !== null)
                                activePreviewIndex--;
                        }}
                        class="absolute left-2 w-14 h-14 rounded-full bg-slate-950/5 hover:bg-slate-950/10 text-slate-800 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md z-10 cursor-pointer border border-slate-200/50"
                        aria-label="Previous Photo"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2.5"
                            stroke="currentColor"
                            class="w-6 h-6"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M15.75 19.5 8.25 12l7.5-7.5"
                            />
                        </svg>
                    </button>
                {/if}

                <!-- Full Image Preview -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <img
                    src={activeFileUrl}
                    alt={activeFileName}
                    onmousedown={handleMouseDown}
                    onmousemove={handleMouseMove}
                    onmouseup={handleMouseUp}
                    onmouseleave={handleMouseUp}
                    ondblclick={resetZoom}
                    class="max-w-full max-h-full object-contain rounded-2xl shadow-xl select-none animate-in zoom-in-95 duration-200"
                    style="transform: translate({panX}px, {panY}px) scale({zoomScale}) rotate({rotationDegrees}deg); transition: {isPanning
                        ? 'none'
                        : 'transform 0.15s ease-out'}; cursor: {zoomScale > 1
                        ? isPanning
                            ? 'grabbing'
                            : 'grab'
                        : 'zoom-in'};"
                    draggable="false"
                />

                <!-- Right Arrow Button -->
                {#if activePreviewIndex < carouselList.length - 1}
                    <button
                        onclick={() => {
                            if (activePreviewIndex !== null)
                                activePreviewIndex++;
                        }}
                        class="absolute right-2 w-14 h-14 rounded-full bg-slate-950/5 hover:bg-slate-950/10 text-slate-800 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md z-10 cursor-pointer border border-slate-200/50"
                        aria-label="Next Photo"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2.5"
                            stroke="currentColor"
                            class="w-6 h-6"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="m8.25 4.5 7.5 7.5-7.5 7.5"
                            />
                        </svg>
                    </button>
                {/if}
            </div>

            <!-- Right Side: Comments Sidebar (Only shown if uploaded and has comments) -->
            {#if !isQueued && activeFile.feedbacks && activeFile.feedbacks.length > 0}
                <div
                    class="w-full md:w-80 bg-white/90 border border-slate-200/50 backdrop-blur-md rounded-3xl p-5 flex flex-col justify-start text-slate-800 text-left shrink-0"
                >
                    <h4
                        class="font-black text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-500 mb-4"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            class="w-4 h-4 text-secondary"
                        >
                            <path
                                fill-rule="evenodd"
                                d="M5.337 21.718a6.707 6.707 0 0 1-.533-.074.85.85 0 0 1-.44-.3A.78.78 0 0 1 4.25 21v-3.197a7.71 7.71 0 0 1-2.25-5.553C2 7.821 6.477 4 12 4s10 3.82 10 8.25-4.477 8.25-10 8.25a10.82 10.82 0 0 1-3.663-.637l-3 1.855ZM12 6.5c-4.418 0-8 3.022-8 6.75 0 1.705.748 3.256 1.986 4.385a.75.75 0 0 1 .264.557l-.001 1.792 1.954-1.208a.75.75 0 0 1 .472-.143 10.14 10.14 0 0 0 3.326.567c4.418 0 8-3.022 8-6.75s-3.582-6.75-8-6.75Z"
                                clip-rule="evenodd"
                            />
                        </svg>
                        Feedback & Comments
                    </h4>
                    <div class="space-y-4 flex-1 overflow-y-auto pr-1">
                        {#each activeFile.feedbacks as fb}
                            <div
                                class="border-b border-slate-100 pb-3 last:border-0"
                            >
                                <div
                                    class="flex items-center justify-between mb-1"
                                >
                                    <span
                                        class="text-xs font-black text-slate-800 truncate max-w-[140px] font-mono"
                                        title={fb.clientIdentifier}
                                    >
                                        {fb.clientIdentifier?.split("@")[0]}
                                    </span>
                                    {#if fb.isSelected}
                                        <span
                                            class="badge badge-primary badge-xs font-bold text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                                            >Shortlisted</span
                                        >
                                    {/if}
                                </div>
                                {#if fb.comment}
                                    <p
                                        class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl mt-1 italic border-l-2 border-primary/20 break-words font-medium leading-relaxed"
                                    >
                                        "{fb.comment}"
                                    </p>
                                {:else}
                                    <p
                                        class="text-[10px] text-slate-400 italic mt-1 font-bold"
                                    >
                                        No written comment
                                    </p>
                                {/if}
                                <span
                                    class="text-[9px] text-slate-400 font-bold mt-1.5 block"
                                >
                                    {new Date(fb.createdAt).toLocaleDateString(
                                        undefined,
                                        {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        },
                                    )}
                                </span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
        <!-- Bottom Controls & Ribbon Carousel -->
        <div
            class="w-full max-w-3xl flex flex-col items-center gap-4 mt-auto z-10"
        >
            <div class="flex items-center gap-3">
                <!-- Rotate CCW Button -->
                {#if !isQueued}
                    <button
                        onclick={() => handleRotate("ccw")}
                        disabled={isUploading || deletePending}
                        class="btn btn-ghost border border-slate-200/50 bg-white hover:bg-slate-50 btn-sm rounded-xl font-black px-4 h-10 shadow-sm flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                        Rotate CCW
                    </button>
                {/if}

                <!-- Delete Button -->
                <button
                    onclick={() => {
                        const toDeleteIndex = activePreviewIndex!;
                        if (isQueued) {
                            if (carouselList.length > 1) {
                                if (toDeleteIndex < carouselList.length - 1) {
                                    activePreviewIndex = toDeleteIndex;
                                } else {
                                    activePreviewIndex = toDeleteIndex - 1;
                                }
                            } else {
                                activePreviewIndex = null;
                                onClose();
                            }
                            onRemoveSelectedFile(activeFile.id);
                        } else {
                            onDeleteUploadedPhoto(toDeleteIndex);
                        }
                    }}
                    disabled={isUploading || deletePending}
                    class="btn btn-error btn-sm rounded-xl font-black px-6 h-10 shadow-lg shadow-error/25 flex items-center gap-1.5 cursor-pointer text-xs"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                        stroke="currentColor"
                        class="w-4 h-4"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                    </svg>
                    Delete Photo
                </button>

                <!-- Rotate CW Button -->
                {#if !isQueued}
                    <button
                        onclick={() => handleRotate("cw")}
                        disabled={isUploading || deletePending}
                        class="btn btn-ghost border border-slate-200/50 bg-white hover:bg-slate-50 btn-sm rounded-xl font-black px-4 h-10 shadow-sm flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                        </svg>
                        Rotate CW
                    </button>
                {/if}
            </div>

            <!-- Horizontal Scroll strip of photos -->
            <div
                class="w-full overflow-x-auto py-3 px-3 flex justify-start sm:justify-center items-center gap-3 no-scrollbar border border-slate-200/60 bg-slate-900/5 backdrop-blur-md rounded-2xl"
            >
                {#each carouselList as thumb, idx}
                    {@const thumbUrl = isQueued
                        ? thumb.previewUrl
                        : thumb.thumbnailUrl}
                    <button
                        onclick={() => {
                            activePreviewIndex = idx;
                        }}
                        class="relative aspect-square w-14 h-14 rounded-xl overflow-hidden border-2 transition-all duration-300 shrink-0 cursor-pointer hover:scale-105 active:scale-95
                            {activePreviewIndex === idx
                            ? 'border-primary scale-110 shadow-lg shadow-primary/30 ring-2 ring-primary/20'
                            : 'border-slate-200/80 opacity-55 hover:opacity-85'}"
                    >
                        <img
                            src={thumbUrl}
                            alt="thumbnail"
                            class="w-full h-full object-cover"
                        />
                    </button>
                {/each}
            </div>
        </div>
    </div>
{/if}
