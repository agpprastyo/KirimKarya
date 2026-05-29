<script lang="ts">
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { api as apiClient, handleResponse } from "$lib/api";
    import { createQuery, createMutation, useQueryClient } from "@tanstack/svelte-query";
    import Alert from "$lib/components/Alert.svelte";
    import UploadStatus from "$lib/components/UploadStatus.svelte";

    // Sub-components
    import ConfirmDialog from "$lib/components/gallery/ConfirmDialog.svelte";
    import GalleryHeader from "$lib/components/gallery/GalleryHeader.svelte";
    import GalleryInsights from "$lib/components/gallery/GalleryInsights.svelte";
    import ReadyToDeliver from "$lib/components/gallery/ReadyToDeliver.svelte";
    import GallerySettingsModal from "$lib/components/gallery/GallerySettingsModal.svelte";
    import UploadDropzone from "$lib/components/gallery/UploadDropzone.svelte";
    import ManagedPhotosGrid from "$lib/components/gallery/ManagedPhotosGrid.svelte";
    import LightboxModal from "$lib/components/gallery/LightboxModal.svelte";

    const galleryId = page.params.id;
    const queryClient = useQueryClient();
    let alertRef = $state<{
        show: (message: string, type: "success" | "error") => void;
    } | null>(null);

    // -- QUERIES --

    const galleryQuery = createQuery(() => ({
        queryKey: ["galleries", galleryId],
        queryFn: () => handleResponse(apiClient.api.galleries[":id"].$get({
            param: { id: galleryId },
        })).then((res: any) => res.data)
    }));

    const photosQuery = createQuery(() => ({
        queryKey: ["galleries", galleryId, "photos"],
        queryFn: () => handleResponse(apiClient.api.photos.galleries[":id"].photos.$get({
            param: { id: galleryId },
        })).then((res: any) => res.data)
    }));

    // -- MUTATIONS --

    const updateGalleryMutation = createMutation(() => ({
        mutationFn: (payload: any) => handleResponse(apiClient.api.galleries[":id"].$put({
            param: { id: galleryId },
            json: payload,
        })).then((res: any) => res.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] });
        }
    }));

    const deliverMutation = createMutation(() => ({
        mutationFn: () => handleResponse(apiClient.api.galleries[":id"].deliver.$post({
            param: { id: galleryId },
        })),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] });
            alertRef?.show("Delivery process started! We will notify clients once ZIP is ready.", "success");
        },
        onError: (error: Error) => {
            alertRef?.show(error.message, "error");
        }
    }));

    const deletePhotosMutation = createMutation(() => ({
        mutationFn: (ids: string[]) => handleResponse(apiClient.api.photos.photos.$delete({
            json: { ids },
        })),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
            queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] }); // Refresh insights total count
            alertRef?.show("Photos deleted successfully!", "success");
            selectedPhotoIds = []; // Clear selection
        },
        onError: (error: Error) => {
            alertRef?.show(error.message, "error");
        }
    }));

    const deleteGalleryMutation = createMutation(() => ({
        mutationFn: () => handleResponse(apiClient.api.galleries[":id"].$delete({
            param: { id: galleryId },
        })),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["galleries", "list"] });
            goto("/dashboard/galleries");
        },
        onError: (error: Error) => {
            alertRef?.show(error.message, "error");
        }
    }));

    // -- UI STATE --

    interface SelectedFile {
        id: string;
        file: File;
        previewUrl: string;
        name: string;
        size: number;
    }

    let isUploading = $state(false);
    let uploadStats = $state({ total: 0, completed: 0, failed: 0 });
    let selectedFiles = $state<SelectedFile[]>([]);
    let activePreviewIndex = $state<number | null>(null);
    let lightboxType = $state<"queued" | "uploaded" | null>(null);
    let selectedPhotoIds = $state<string[]>([]);

    let isSettingsOpen = $state(false);
    let settingsError = $state("");

    // Custom DaisyUI Confirmation Modal State
    let isConfirmModalOpen = $state(false);
    let confirmModalTitle = $state("");
    let confirmModalMessage = $state("");
    let confirmModalCallback = $state<(() => void) | null>(null);

    function showConfirmation(title: string, message: string, onConfirm: () => void) {
        confirmModalTitle = title;
        confirmModalMessage = message;
        confirmModalCallback = () => {
            onConfirm();
            isConfirmModalOpen = false;
        };
        isConfirmModalOpen = true;
    }

    let editForm = $state({
        title: "",
        clientEmail: "",
        status: "DRAFT" as "DRAFT" | "PUBLISHED",
        isPrivate: false,
        accessMode: "OTP" as "OTP" | "PASSWORD",
        allowedEmails: "",
        password: "",
        expiresAt: "",
        selectionLimit: 0,
        pricePerExtraPhoto: 0,
    });

    function openSettings() {
        const gallery = galleryQuery.data;
        if (!gallery) return;
        editForm = {
            title: gallery.title,
            clientEmail: gallery.clientEmail || "",
            status: (gallery.status as any) || "DRAFT",
            isPrivate: gallery.isPrivate || false,
            accessMode: (gallery.accessMode as any) || "OTP",
            allowedEmails: (gallery.allowedEmails || []).join(", "),
            password: "",
            expiresAt: gallery.expiresAt
                ? new Date(gallery.expiresAt).toISOString().split("T")[0]
                : "",
            selectionLimit: gallery.selectionLimit || 0,
            pricePerExtraPhoto: gallery.pricePerExtraPhoto || 0,
        };
        isSettingsOpen = true;
    }

    async function handleSaveSettings(notify: boolean = false) {
        settingsError = "";
        try {
            const payload = {
                title: editForm.title,
                clientEmail: editForm.clientEmail || null,
                status: editForm.status as any,
                isPrivate: editForm.isPrivate,
                accessMode: editForm.accessMode as any,
                allowedEmails: editForm.allowedEmails
                    ? editForm.allowedEmails
                          .split(/[,\s]+/)
                          .filter((e) => e.includes("@"))
                    : [],
                expiresAt: editForm.expiresAt
                    ? new Date(editForm.expiresAt).toISOString()
                    : null,
                notify: notify,
                password:
                    editForm.password && editForm.password.length >= 4
                        ? editForm.password
                        : undefined,
                selectionLimit: editForm.selectionLimit,
                pricePerExtraPhoto: editForm.pricePerExtraPhoto,
            };

            await updateGalleryMutation.mutateAsync(payload);
            isSettingsOpen = false;
            alertRef?.show(
                notify
                    ? "Settings saved and clients notified!"
                    : "Settings updated successfully!",
                "success",
            );
        } catch (e: any) {
            settingsError = e.message;
        }
    }

    // Polling for delivery status
    $effect(() => {
        const gallery = galleryQuery.data;
        if (
            gallery?.deliveryStatus === "QUEUED" ||
            gallery?.deliveryStatus === "PROCESSING"
        ) {
            const interval = setInterval(() => {
                queryClient.invalidateQueries({ queryKey: ["galleries", galleryId] });
            }, 3000);
            return () => clearInterval(interval);
        }
    });

    // Refresh photo status every 5 seconds if there are processing photos
    $effect(() => {
        const photoList = (photosQuery.data || []) as any[];
        const hasProcessing = photoList.some(
            (p: any) => p.status === "PENDING" || p.status === "PROCESSING",
        );
        if (hasProcessing) {
            const interval = setInterval(() => {
                queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
            }, 5000);
            return () => clearInterval(interval);
        }
    });

    function handleFileSelect(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const newFiles = Array.from(input.files).map((file) => ({
            id: crypto.randomUUID(),
            file,
            previewUrl: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
        }));

        selectedFiles = [...selectedFiles, ...newFiles];
        input.value = "";
    }

    function removeSelectedFile(id: string) {
        const index = selectedFiles.findIndex((f) => f.id === id);
        if (index !== -1) {
            URL.revokeObjectURL(selectedFiles[index].previewUrl);
            selectedFiles = selectedFiles.filter((f) => f.id !== id);
        }
    }

    function clearAllSelected() {
        selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        selectedFiles = [];
    }

    // Automatically clean up object URLs when page is destroyed/unmounted
    $effect(() => {
        return () => {
            selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        };
    });

    function togglePhotoSelection(id: string) {
        if (selectedPhotoIds.includes(id)) {
            selectedPhotoIds = selectedPhotoIds.filter(x => x !== id);
        } else {
            selectedPhotoIds = [...selectedPhotoIds, id];
        }
    }

    async function handleUpload() {
        if (selectedFiles.length === 0) return;

        const queue = [...selectedFiles];
        isUploading = true;
        uploadStats = { total: queue.length, completed: 0, failed: 0 };

        const CONCURRENCY = 4;
        const activeUploads: Promise<void>[] = [];

        const uploadFile = async (item: SelectedFile) => {
            try {
                const formData = new FormData();
                formData.append("file", item.file);

                const url = apiClient.api.photos.galleries[":id"].photos.$url({
                    param: { id: galleryId },
                });

                const res = await fetch(url.toString(), {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                });

                if (res.ok) {
                    uploadStats.completed++;
                    URL.revokeObjectURL(item.previewUrl);
                    selectedFiles = selectedFiles.filter((f) => f.id !== item.id);
                    queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
                } else {
                    uploadStats.failed++;
                }
            } catch (e) {
                console.error("Upload failed for file:", item.name, e);
                uploadStats.failed++;
            }
        };

        while (queue.length > 0 || activeUploads.length > 0) {
            while (activeUploads.length < CONCURRENCY && queue.length > 0) {
                const item = queue.shift()!;
                const promise = uploadFile(item).then(() => {
                    activeUploads.splice(activeUploads.indexOf(promise), 1);
                });
                activeUploads.push(promise);
            }
            await Promise.race(activeUploads);
        }

        setTimeout(() => {
            if (uploadStats.completed + uploadStats.failed === uploadStats.total) {
                setTimeout(() => {
                    if (!isUploading)
                        uploadStats = { total: 0, completed: 0, failed: 0 };
                }, 3000);
            }
            isUploading = false;
        }, 500);

        queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] });
    }

    function copyShareLink() {
        const url = `${window.location.origin}/g/${galleryId}`;
        navigator.clipboard.writeText(url);
        alertRef?.show("Public link copied to clipboard!", "success");
    }

    async function handleQuickPublish() {
        const gallery = galleryQuery.data;
        if (!gallery) return;
        try {
            await updateGalleryMutation.mutateAsync({
                title: gallery.title,
                clientEmail: gallery.clientEmail || null,
                status: "PUBLISHED",
                isPrivate: gallery.isPrivate,
                accessMode: gallery.accessMode as any,
                allowedEmails: gallery.allowedEmails || [],
                expiresAt: gallery.expiresAt ? new Date(gallery.expiresAt).toISOString() : null,
                notify: true,
                selectionLimit: gallery.selectionLimit,
                pricePerExtraPhoto: gallery.pricePerExtraPhoto,
            });
            alertRef?.show("Gallery published successfully and clients notified via Magic Link!", "success");
        } catch (e: any) {
            alertRef?.show(e.message || "Failed to publish gallery", "error");
        }
    }

    $effect(() => {
        const pId = page.url.searchParams.get("photoId");
        if (pId && photosQuery.data) {
            const idx = photosQuery.data.findIndex((p: any) => p.id === pId);
            if (idx !== -1) {
                lightboxType = "uploaded";
                activePreviewIndex = idx;
                
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete("photoId");
                window.history.replaceState({}, "", newUrl.toString());
            }
        }
    });
</script>

<Alert bind:this={alertRef} />

<ConfirmDialog
    isOpen={isConfirmModalOpen}
    title={confirmModalTitle}
    message={confirmModalMessage}
    onConfirm={() => confirmModalCallback?.()}
    onCancel={() => isConfirmModalOpen = false}
/>

<div class="space-y-12 pb-20">
    {#if galleryQuery.isLoading}
        <div class="animate-pulse space-y-8">
            <div class="h-10 bg-base-200 rounded w-1/3"></div>
            <div class="h-64 bg-base-100 rounded-3xl"></div>
        </div>
    {:else if galleryQuery.error}
        <div class="alert alert-error">
            <span>Error loading gallery: {galleryQuery.error.message}</span>
        </div>
    {:else if !galleryQuery.data}
        <div class="text-center py-20">
            <h1 class="text-2xl font-bold italic opacity-30">
                Gallery not found
            </h1>
        </div>
    {:else}
        {@const gallery = galleryQuery.data}
        
        <!-- Header -->
        <GalleryHeader
            gallery={gallery}
            galleryId={galleryId}
            copyShareLink={copyShareLink}
            onOpenSettings={openSettings}
            onPublish={handleQuickPublish}
        />

        <!-- Top Controls Layout: Upload Dropzone & Widgets stacked beautifully side-by-side -->
        <div class="grid lg:grid-cols-3 gap-8 items-start">
            <!-- Left: Upload Dropzone (taking up 2/3 width) -->
            <div class="lg:col-span-2">
                <UploadDropzone
                    bind:selectedFiles
                    isUploading={isUploading}
                    uploadStats={uploadStats}
                    onFileSelect={handleFileSelect}
                    onRemoveSelectedFile={removeSelectedFile}
                    onClearAllSelected={clearAllSelected}
                    onUpload={handleUpload}
                    onOpenLightbox={(idx) => {
                        lightboxType = "queued";
                        activePreviewIndex = idx;
                    }}
                />
            </div>

            <!-- Right: Insights & Quick Action Cards (taking up 1/3 width) -->
            <div class="flex flex-col gap-6">
                <GalleryInsights
                    totalPhotos={photosQuery.data?.length || 0}
                    selectedPhotosCount={(photosQuery.data || []).filter((p: any) => p.selectionCount > 0).length}
                    galleryId={galleryId}
                    copyShareLink={copyShareLink}
                />

                <ReadyToDeliver
                    gallery={gallery}
                    deliverPending={deliverMutation.isPending}
                    onDeliver={() => deliverMutation.mutate()}
                />
            </div>
        </div>

        <!-- Full-Width Bottom Section: Spacious & Flexible Managed Photos Grid -->
        <div class="card bg-base-100 border border-base-content/5 shadow-sm overflow-hidden rounded-[2.5rem] w-full">
            <ManagedPhotosGrid
                photos={photosQuery.data || []}
                isLoading={photosQuery.isLoading}
                bind:selectedPhotoIds
                deletePending={deletePhotosMutation.isPending}
                onToggleSelection={togglePhotoSelection}
                onSelectAll={() => selectedPhotoIds = (photosQuery.data || []).map((p: any) => p.id)}
                onDeselectAll={() => selectedPhotoIds = []}
                onDeletePhotos={(ids) => {
                    const isBulk = ids.length > 1;
                    showConfirmation(
                        isBulk ? "Delete Selected Photos" : "Delete Photo",
                        isBulk
                            ? `Are you sure you want to permanently delete these ${ids.length} selected photos? This action cannot be undone.`
                            : "Are you sure you want to permanently delete this photo? This action cannot be undone.",
                        () => deletePhotosMutation.mutate(ids)
                    );
                }}
                onOpenLightbox={(idx) => {
                    lightboxType = "uploaded";
                    activePreviewIndex = idx;
                }}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["galleries", galleryId, "photos"] })}
            />
        </div>
    {/if}

    <UploadStatus
        {isUploading}
        total={uploadStats.total}
        completed={uploadStats.completed}
        failed={uploadStats.failed}
    />
</div>

<!-- Modals -->
<GallerySettingsModal
    isOpen={isSettingsOpen}
    bind:editForm
    settingsError={settingsError}
    savingPending={updateGalleryMutation.isPending}
    onSave={handleSaveSettings}
    onClose={() => isSettingsOpen = false}
    onDelete={() => {
        const title = galleryQuery.data?.title || "this gallery";
        showConfirmation(
            "Delete Gallery",
            `Are you sure you want to permanently delete "${title}" along with all its photos? This action cannot be undone.`,
            () => {
                isSettingsOpen = false;
                deleteGalleryMutation.mutate();
            }
        );
    }}
/>

{#if activePreviewIndex !== null && lightboxType}
    <LightboxModal
        bind:activePreviewIndex
        lightboxType={lightboxType}
        carouselList={lightboxType === "queued" ? selectedFiles : (photosQuery.data || [])}
        isUploading={isUploading}
        deletePending={deletePhotosMutation.isPending}
        onClose={() => {
            activePreviewIndex = null;
            lightboxType = null;
        }}
        onRemoveSelectedFile={removeSelectedFile}
        onDeleteUploadedPhoto={(idx) => {
            const photoToDelete = (photosQuery.data || [])[idx];
            showConfirmation(
                "Delete Photo",
                "Are you sure you want to permanently delete this photo? This action cannot be undone.",
                () => {
                    if (photosQuery.data && photosQuery.data.length > 1) {
                        if (idx < photosQuery.data.length - 1) {
                            activePreviewIndex = idx;
                        } else {
                            activePreviewIndex = idx - 1;
                        }
                    } else {
                        activePreviewIndex = null;
                        lightboxType = null;
                    }
                    deletePhotosMutation.mutate([photoToDelete.id]);
                }
            );
        }}
    />
{/if}

<style>
    :global(body) {
        background-color: #fafafa;
    }
</style>
