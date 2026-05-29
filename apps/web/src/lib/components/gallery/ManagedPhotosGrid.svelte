<script lang="ts">
    interface Feedback {
        id: string;
        isSelected: boolean;
        comment?: string | null;
        clientIdentifier?: string | null;
        createdAt: string;
    }

    interface Photo {
        id: string;
        filename: string;
        thumbnailUrl?: string | null;
        status: string;
        selectionCount: number;
        feedbacks?: Feedback[];
    }

    interface Props {
        photos: Photo[];
        isLoading: boolean;
        selectedPhotoIds: string[];
        deletePending: boolean;
        onToggleSelection: (id: string) => void;
        onSelectAll: () => void;
        onDeselectAll: () => void;
        onDeletePhotos: (ids: string[]) => void;
        onOpenLightbox: (index: number) => void;
        onRefresh: () => void;
    }

    let {
        photos = [],
        isLoading,
        selectedPhotoIds = $bindable(),
        deletePending,
        onToggleSelection,
        onSelectAll,
        onDeselectAll,
        onDeletePhotos,
        onOpenLightbox,
        onRefresh,
    }: Props = $props();
</script>

<div class="p-8">
    <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-base-content/5"
    >
        <div class="text-left">
            <h3 class="text-xl font-black">Managed Photos</h3>
            <p
                class="text-xs text-base-content/40 font-bold uppercase tracking-wider mt-0.5"
            >
                {#if selectedPhotoIds.length > 0}
                    {selectedPhotoIds.length} of {photos.length} selected
                {:else}
                    {photos.length} photos uploaded
                {/if}
            </p>
        </div>

        <div class="flex items-center gap-3">
            {#if selectedPhotoIds.length > 0}
                <div
                    class="flex gap-2 animate-in fade-in slide-in-from-right-2 duration-200"
                >
                    <button
                        onclick={onDeselectAll}
                        class="btn btn-ghost btn-sm rounded-xl font-black border border-base-content/10 cursor-pointer"
                    >
                        Deselect All
                    </button>
                    <button
                        onclick={() => onDeletePhotos(selectedPhotoIds)}
                        disabled={deletePending}
                        class="btn btn-error btn-sm rounded-xl font-black shadow-md shadow-error/20 cursor-pointer"
                    >
                        {#if deletePending}
                            <span class="loading loading-spinner loading-xs"
                            ></span>
                        {/if}
                        Delete ({selectedPhotoIds.length})
                    </button>
                </div>
            {:else if photos.length > 0}
                <button
                    onclick={onSelectAll}
                    class="btn btn-ghost btn-sm rounded-xl font-black border border-base-content/10 text-xs cursor-pointer"
                >
                    Select All
                </button>
            {/if}

            <button
                onclick={onRefresh}
                class="btn btn-ghost btn-sm rounded-xl font-black text-xs border border-base-content/5 hover:bg-base-content/5 cursor-pointer"
            >
                Refresh
            </button>
        </div>
    </div>

    {#if isLoading}
        <div class="columns-2 sm:columns-3 md:columns-4 gap-4 space-y-4">
            {#each Array(4) as _}
                <div
                    class="break-inside-avoid aspect-3/4 bg-base-200 rounded-3xl animate-pulse w-full"
                ></div>
            {/each}
        </div>
    {:else if photos.length === 0}
        <div
            class="aspect-video bg-base-200 rounded-2xl flex items-center justify-center border-2 border-dashed border-base-content/5 opacity-30 italic font-bold"
        >
            No photos uploaded yet
        </div>
    {:else}
        <div class="columns-2 sm:columns-3 md:columns-4 gap-4 space-y-4">
            {#each photos as photo, index (photo.id)}
                <div
                    class="break-inside-avoid relative bg-base-200 rounded-3xl overflow-hidden border border-base-content/5 shadow-xs hover:shadow-xl transition-all hover:scale-[1.02] group cursor-pointer"
                >
                    <!-- Clickable Area for Full Preview -->
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        onclick={() => onOpenLightbox(index)}
                        class="w-full h-auto block"
                    >
                        {#if photo.thumbnailUrl}
                            <img
                                src={photo.thumbnailUrl}
                                alt={photo.filename}
                                crossorigin="use-credentials"
                                class="w-full h-auto object-cover rounded-3xl"
                            />
                        {:else}
                            <div
                                class="aspect-square w-full flex items-center justify-center"
                            >
                                <span
                                    class="loading loading-spinner loading-md opacity-20"
                                ></span>
                            </div>
                        {/if}

                        <!-- Zoom overlay on Hover -->
                        <div
                            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl"
                        >
                            <div
                                class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
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
                                        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Bulk Checkbox (absolute top-left) -->
                    <div
                        class="absolute top-3 left-3 z-10 transition-opacity duration-200 {selectedPhotoIds.includes(
                            photo.id,
                        )
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'}"
                    >
                        <input
                            type="checkbox"
                            checked={selectedPhotoIds.includes(photo.id)}
                            onclick={(e) => {
                                e.stopPropagation();
                                onToggleSelection(photo.id);
                            }}
                            class="checkbox checkbox-primary bg-white/95 border-slate-300 shadow-md checkbox-md rounded-lg cursor-pointer"
                        />
                    </div>

                    <!-- Single Delete button (absolute top-right) -->
                    <button
                        onclick={(e) => {
                            e.stopPropagation();
                            onDeletePhotos([photo.id]);
                        }}
                        disabled={deletePending}
                        class="absolute top-3 right-3 w-9 h-9 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all shadow-md z-10 cursor-pointer"
                        title="Delete Photo"
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
                                d="M6 18 18 6M6 6l12 12"
                            />
                        </svg>
                    </button>

                    <!-- Selection & Comment badge info overlay bottom -->
                    <div
                        class="absolute bottom-3 left-3 flex flex-wrap gap-1.5 z-10"
                    >
                        {#if photo.selectionCount > 0}
                            <div
                                class="bg-primary text-primary-content text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl shadow-md flex items-center gap-1"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    class="w-3 h-3"
                                >
                                    <path
                                        d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z"
                                    />
                                </svg>
                                {photo.selectionCount} Selected
                            </div>
                        {/if}
                        {#if (photo.feedbacks || []).filter((f) => f.comment && f.comment.trim()).length > 0}
                            {@const cCount = (photo.feedbacks || []).filter(
                                (f) => f.comment && f.comment.trim(),
                            ).length}
                            <div
                                class="bg-secondary text-secondary-content text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl shadow-md flex items-center gap-1"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    class="w-3 h-3"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M5.337 21.718a6.707 6.707 0 0 1-.533-.074.85.85 0 0 1-.44-.3A.78.78 0 0 1 4.25 21v-3.197a7.71 7.71 0 0 1-2.25-5.553C2 7.821 6.477 4 12 4s10 3.82 10 8.25-4.477 8.25-10 8.25a10.82 10.82 0 0 1-3.663-.637l-3 1.855ZM12 6.5c-4.418 0-8 3.022-8 6.75 0 1.705.748 3.256 1.986 4.385a.75.75 0 0 1 .264.557l-.001 1.792 1.954-1.208a.75.75 0 0 1 .472-.143 10.14 10.14 0 0 0 3.326.567c4.418 0 8-3.022 8-6.75s-3.582-6.75-8-6.75Z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                                {cCount} Comment{cCount > 1 ? "s" : ""}
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
