<script lang="ts">
    interface SelectedFile {
        id: string;
        file: File;
        previewUrl: string;
        name: string;
        size: number;
    }

    interface Props {
        selectedFiles: SelectedFile[];
        isUploading: boolean;
        uploadStats: { total: number; completed: number; failed: number };
        onFileSelect: (e: Event) => void;
        onRemoveSelectedFile: (id: string) => void;
        onClearAllSelected: () => void;
        onUpload: () => void;
        onOpenLightbox: (index: number) => void;
    }

    let {
        selectedFiles = $bindable(),
        isUploading,
        uploadStats,
        onFileSelect,
        onRemoveSelectedFile,
        onClearAllSelected,
        onUpload,
        onOpenLightbox
    }: Props = $props();

    let isDragging = $state(false);

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave() {
        isDragging = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;

        if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;

        const imageFiles = Array.from(e.dataTransfer.files).filter((file) =>
            file.type.startsWith("image/")
        );

        if (imageFiles.length === 0) return;

        const newFiles = imageFiles.map((file) => ({
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
        }));

        selectedFiles = [...selectedFiles, ...newFiles];
    }
</script>

<div
    class="card bg-base-100 border border-base-content/5 shadow-sm overflow-hidden rounded-[2.5rem]"
>
    <div
        class="p-8 text-center border-b border-base-content/5 bg-primary/5"
    >
        <h2 class="text-2xl font-black mb-4">Upload Photos</h2>
        <div class="max-w-2xl mx-auto">
            <input
                type="file"
                id="photo-upload"
                multiple
                accept="image/*"
                onchange={onFileSelect}
                class="hidden"
            />

            {#if selectedFiles.length === 0}
                <label
                    for="photo-upload"
                    class="flex flex-col items-center justify-center border-2 border-dashed {isDragging ? 'border-primary bg-primary/10 scale-[0.98]' : 'border-primary/20 bg-base-100'} rounded-4xl p-12 cursor-pointer hover:border-primary/50 transition-all duration-300 group"
                    ondragover={handleDragOver}
                    ondragleave={handleDragLeave}
                    ondrop={handleDrop}
                >
                    <div class="flex flex-col items-center gap-4">
                        <div class="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-8 h-8">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </div>
                        <div>
                            <p class="text-lg font-black text-base-content/85">Click or drag photos here</p>
                            <p class="text-xs text-base-content/40 font-bold mt-1 uppercase tracking-wider">Supports JPEG, PNG, WEBP</p>
                        </div>
                    </div>
                </label>
            {:else}
                <div class="space-y-6">
                    <!-- Controls row -->
                    <div class="flex items-center justify-between bg-base-100 p-4 rounded-3xl border border-base-content/5 shadow-xs">
                        <div class="text-left">
                            <p class="text-sm font-black text-base-content/90">{selectedFiles.length} photos selected</p>
                            <p class="text-xs text-base-content/40 font-bold uppercase tracking-wider">Ready to upload</p>
                        </div>
                        <div class="flex gap-2">
                            <label
                                for="photo-upload"
                                class="btn btn-ghost btn-sm rounded-xl font-black border border-base-content/10 flex items-center gap-1 cursor-pointer"
                                class:pointer-events-none={isUploading}
                                class:opacity-50={isUploading}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add More
                            </label>
                            <button
                                onclick={onClearAllSelected}
                                disabled={isUploading}
                                class="btn btn-ghost btn-sm rounded-xl font-black text-error hover:bg-error/10 flex items-center gap-1 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                                Clear All
                            </button>
                        </div>
                    </div>

                    <!-- Grid Container -->
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[350px] overflow-y-auto p-2 bg-base-200/30 rounded-3xl border border-base-content/5">
                        {#each selectedFiles as item, index (item.id)}
                            <div class="group relative aspect-square bg-base-300 rounded-2xl overflow-hidden border border-base-content/5 shadow-xs transition-all hover:scale-[0.98]">
                                <!-- Clickable Area for Full Preview -->
                                <button
                                    type="button"
                                    onclick={() => onOpenLightbox(index)}
                                    class="w-full h-full p-0 border-0 bg-transparent cursor-pointer block"
                                >
                                    <img
                                        src={item.previewUrl}
                                        alt={item.name}
                                        class="w-full h-full object-cover"
                                    />
                                    
                                    <!-- Zoom/Eye Icon Overlay on Hover -->
                                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 transition-transform shadow-xs">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-5 h-5">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                                            </svg>
                                        </div>
                                    </div>
                                </button>
                                
                                <!-- Absolute Delete Button on Hover -->
                                <button
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        onRemoveSelectedFile(item.id);
                                    }}
                                    disabled={isUploading}
                                    class="absolute top-2 right-2 w-8 h-8 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-md z-10 cursor-pointer"
                                    title="Remove Photo"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        {/each}
                    </div>

                    <!-- Start Upload Button -->
                    <div class="flex justify-center pt-2">
                        <button
                            onclick={onUpload}
                            disabled={isUploading}
                            class="btn btn-primary rounded-2xl font-black px-16 h-14 shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer"
                        >
                            {#if isUploading}
                                <span class="loading loading-spinner"></span>
                                Uploading {uploadStats.completed}/{uploadStats.total}...
                            {:else}
                                Start Upload
                            {/if}
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>
