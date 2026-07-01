<script lang="ts">
    import { page } from "$app/state";
    import { api as clientApi } from "$lib/api/client";
    import { invalidateAll } from "$app/navigation";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Motion } from "svelte-motion";
    import { env } from "../../../env";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";
    import GalleryAccessWall from "$lib/components/gallery/GalleryAccessWall.svelte";
    import GalleryPhotoGrid from "$lib/components/gallery/GalleryPhotoGrid.svelte";
    import GalleryLightbox from "$lib/components/gallery/GalleryLightbox.svelte";
    import GalleryModals from "$lib/components/gallery/GalleryModals.svelte";
    import type { PageData } from "./$types";
    import Icon from "$lib/components/icons/Icon.svelte";
    import type { PublicGallery, PublicPhoto } from "./+page.server";

    let { data }: { data: PageData } = $props();

    const api = clientApi;
    const galleryId = page.params.id;

    // Use SSR data
    let gallery = $state<PublicGallery | null>(data.gallery);
    let isDraft = $state(data.isDraft);
    let isExpired = $state(data.isExpired);
    let accessRequired = $state(data.accessRequired);

    let photos = $state<PublicPhoto[]>(data.photos || []);
    let isLoadingPhotos = $state(false);
    let clientId = $state(data.clientId || "");

    let isFinalizeModalOpen = $state(false);
    let isPaywallModalOpen = $state(false);
    let extraQuotaUnlocked = $state(false);
    let isSubmittingFinalization = $state(false);

    let selectedPhotoIndex = $state<number | null>(null);

    let toastMessage = $state("");
    let toastType = $state<"success" | "error" | "info">("info");

    function showToast(message: string, type: "success" | "error" | "info" = "info") {
        toastMessage = message;
        toastType = type;
        setTimeout(() => { toastMessage = ""; }, 4000);
    }

    onMount(async () => {
        if (!browser) return;

        let storedId = localStorage.getItem("kirimkarya_client_id") || data.clientId;
        if (storedId) {
            localStorage.setItem("kirimkarya_client_id", storedId);
        }
        clientId = storedId || "";

        // Only fetch if photos aren't already loaded in SSR but access is available
        if (!accessRequired && !isDraft && !isExpired && gallery && photos.length === 0) {
            await loadPhotos();
        }
    });

    async function loadPhotos() {
        isLoadingPhotos = true;
        try {
            const photosRes = await api.api.v1.public.galleries[":id"].photos.$get({
                param: { id: galleryId },
                header: { "x-client-id": clientId },
            });
            if (photosRes.ok) {
                const resData = await photosRes.json();
                photos = resData.data as PublicPhoto[];
            } else if (photosRes.status === 403) {
                accessRequired = true;
            }
        } finally {
            isLoadingPhotos = false;
        }
    }

    // Access methods
    async function handleRequestAccess(email: string) {
        const res = await api.api.v1.public.galleries[":id"]["request-access"].$post({
            param: { id: galleryId },
            json: { email },
        });
        if (res.ok) return { success: true };
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.message };
    }

    async function handleVerifyOTP(email: string, code: string) {
        const res = await api.api.v1.public.galleries[":id"]["verify-otp"].$post({
            param: { id: galleryId },
            json: { email, code },
        });
        if (res.ok) return { success: true };
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.message };
    }

    async function handleVerifyPassword(email: string, password: string) {
        const res = await api.api.v1.public.galleries[":id"]["verify-password"].$post({
            param: { id: galleryId },
            json: { email, password },
        });
        if (res.ok) return { success: true };
        const err = await res.json().catch(() => ({}));
        return { success: false, error: err.message };
    }

    function onAuthSuccess() {
        invalidateAll();
    }

    // Selection methods
    async function toggleSelection(photoId: string) {
        const photo = photos.find((p) => p.id === photoId);
        if (!photo) return;

        const newStatus = !photo.isSelected;

        if (newStatus && gallery?.selectionLimit > 0 && shortlistedCount >= gallery.selectionLimit && !extraQuotaUnlocked) {
            isPaywallModalOpen = true;
            return;
        }

        photo.isSelected = newStatus;

        try {
            const res = await api.api.v1.public.photos[":id"].feedback.$post({
                param: { id: photoId },
                header: { "x-client-id": clientId },
                json: { isSelected: newStatus },
            });

            if (!res.ok) {
                photo.isSelected = !newStatus;
                const errData = await res.json().catch(() => ({}));
                if (errData && errData.message === "Selection quota exceeded") {
                    if (gallery?.selectionLimit > 0 && !extraQuotaUnlocked) {
                        isPaywallModalOpen = true;
                    } else {
                        showToast(`Selection quota exceeded! You are allowed up to ${gallery?.selectionLimit || 0} selections.`, "error");
                    }
                } else {
                    showToast(errData.message || "Failed to update selection", "error");
                }
            } else {
                showToast(newStatus ? "Photo added to shortlist!" : "Photo removed from shortlist.", newStatus ? "success" : "info");
            }
        } catch {
            photo.isSelected = !newStatus;
            showToast("Something went wrong. Please try again.", "error");
        }
    }

    let saveTimeout: ReturnType<typeof setTimeout>;
    function saveComment(photoId: string, comment: string) {
        const photo = photos.find((p) => p.id === photoId);
        if (!photo) return;
        photo.comment = comment;

        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            try {
                await api.api.v1.public.photos[":id"].feedback.$post({
                    param: { id: photoId },
                    header: { "x-client-id": clientId },
                    json: { comment: comment },
                });
            } catch (e) {
                console.error("Failed to save comment", e);
            }
        }, 500);
    }

    async function finalizeSelection() {
        isSubmittingFinalization = true;
        try {
            const res = await api.api.v1.public.galleries[":id"].finalize.$post({
                param: { id: galleryId },
                header: { "x-client-id": clientId },
            });

            if (res.ok) {
                isFinalizeModalOpen = false;
                showToast("Selection finalized! Your photographer has been notified.", "success");
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.message || "Failed to finalize selection", "error");
            }
        } catch {
            showToast("Failed to finalize selection. Please try again.", "error");
        } finally {
            isSubmittingFinalization = false;
        }
    }

    const shortlistedCount = $derived(photos.filter((p) => p.isSelected).length);
</script>

<svelte:head>
    <title>{gallery?.title || "Gallery"} | Kirim Karya</title>
</svelte:head>

<div class="min-h-screen bg-base-100 text-base-content selection:bg-primary selection:text-primary-content">
    {#if isDraft}
        <div class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center">
            <Motion initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div class="max-w-md w-full space-y-8">
                    <div class="inline-flex items-center justify-center p-6 bg-warning/10 text-warning rounded-full mb-4">
                        <Icon name="warning" class="size-10" />
                    </div>
                    <h1 class="text-5xl font-black tracking-tight">Under Construction</h1>
                    <p class="text-xl text-base-content/40 font-medium italic">This gallery is currently in **DRAFT** mode and is not yet ready for public viewing.</p>
                    <div class="pt-8"><a href="/" class="btn btn-ghost font-bold opacity-50 hover:opacity-100 italic underline-offset-8 underline">Return to Home</a></div>
                </div>
            </Motion>
        </div>
    {:else if isExpired}
        <div class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center">
            <Motion initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div class="max-w-md w-full space-y-8">
                    <div class="inline-flex items-center justify-center p-6 bg-error/10 text-error rounded-full mb-4">
                        <Icon name="clock" class="size-10" />
                    </div>
                    <h1 class="text-5xl font-black tracking-tight">Gallery Expired</h1>
                    <p class="text-base-content/40 font-bold uppercase tracking-wider text-xs">This proofing window has closed</p>
                    <p class="text-sm opacity-60 leading-relaxed font-medium">Access to the gallery <strong>"{gallery?.title || "this project"}"</strong> has expired. Please contact your photographer if you need to request a deadline extension to complete your selection.</p>
                    <div class="pt-8">
                        <button onclick={() => showToast("Extension request sent! Your photographer will be notified.", "success")} class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20 cursor-pointer h-14 w-full">
                            Request Extension
                        </button>
                    </div>
                </div>
            </Motion>
        </div>
    {:else if !gallery && !accessRequired}
        <div class="flex flex-col items-center justify-center h-screen space-y-4">
            <h1 class="text-4xl font-black italic opacity-20">Gallery Not Found</h1>
            <a href="/" class="btn btn-ghost font-bold opacity-50 hover:opacity-100 italic underline-offset-8 underline">Back Home</a>
        </div>
    {:else if accessRequired}
        <GalleryAccessWall
            {gallery}
            requestAccessFn={handleRequestAccess}
            verifyOTPFn={handleVerifyOTP}
            verifyPasswordFn={handleVerifyPassword}
            onOTPSuccess={onAuthSuccess}
            onPasswordSuccess={onAuthSuccess}
        />
    {:else}
        <!-- Navigation -->
        <nav class="sticky top-0 z-40 bg-base-100/80 backdrop-blur-xl border-b border-base-content/5 px-8 h-20 flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-black tracking-tight">{gallery.title}</h1>
                <p class="text-[10px] uppercase font-black tracking-widest opacity-40 italic">By Kirim Karya Photographers</p>
            </div>
            <div class="flex items-center gap-6">
                {#if shortlistedCount > 0}
                    <div class="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-black text-xs animate-in zoom-in duration-300">
                        <Icon name="heart" class="size-4" />
                        <span>{shortlistedCount} SHORTLISTED</span>
                    </div>
                {/if}
                {#if gallery?.deliveryStatus === "COMPLETED" && gallery?.deliveryZipKey}
                    <a href="{env.PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/public/galleries/{galleryId}/download" class="btn btn-success btn-sm rounded-full font-black px-6 text-success-content shadow-xl shadow-success/20 animate-pulse">
                        <Icon name="download" class="size-4 mr-1" />
                        Download High-Res ZIP
                    </a>
                {:else}
                    <button onclick={() => (isFinalizeModalOpen = true)} disabled={shortlistedCount === 0 || isLoadingPhotos} class="btn btn-primary btn-sm rounded-full font-black px-6 shadow-xl shadow-primary/20">
                        Send Selection
                    </button>
                {/if}
                <div class="border-l border-base-content/10 pl-4 py-1 flex items-center">
                    <ThemeToggle />
                </div>
            </div>
        </nav>

        <div class="p-8 md:p-20 text-center space-y-4">
            <div class="badge badge-primary font-black text-[10px] tracking-widest uppercase px-3 py-1 mb-4">Official Gallery</div>
            <h2 class="text-6xl md:text-8xl font-black tracking-tighter leading-none mx-auto max-w-4xl">{gallery.title}</h2>
            <p class="text-xl md:text-2xl text-base-content/40 font-medium italic">A curated selection of your special moments.</p>
        </div>

        {#if isLoadingPhotos}
            <div class="flex items-center justify-center py-20">
                <span class="loading loading-ring loading-lg text-primary"></span>
            </div>
        {:else}
            <GalleryPhotoGrid
                {photos}
                onSelect={(idx) => (selectedPhotoIndex = idx)}
                onToggleSelection={toggleSelection}
            />
        {/if}

        <footer class="py-12 border-t border-base-content/5 text-center bg-base-100/50 backdrop-blur-md rounded-t-[32px] mt-16 max-w-7xl mx-auto px-6">
            <p class="text-xs font-black tracking-widest uppercase opacity-45">Kirim Karya Proofing</p>
            <p class="text-[10px] opacity-35 mt-2">© 2026 Kirim Karya. Beautiful client proofing experience. All rights reserved.</p>
        </footer>
    {/if}
</div>

{#if selectedPhotoIndex !== null && photos.length > 0}
    <GalleryLightbox
        {photos}
        selectedIndex={selectedPhotoIndex}
        onClose={() => (selectedPhotoIndex = null)}
        onNavigate={(idx) => (selectedPhotoIndex = idx)}
        onToggleSelection={toggleSelection}
        onSaveComment={saveComment}
        {shortlistedCount}
        selectionLimit={gallery?.selectionLimit || 0}
    />
{/if}

<GalleryModals
    {gallery}
    {shortlistedCount}
    {extraQuotaUnlocked}
    isFinalizeOpen={isFinalizeModalOpen}
    isPaywallOpen={isPaywallModalOpen}
    isSubmitting={isSubmittingFinalization}
    onConfirmFinalize={finalizeSelection}
    onCancelFinalize={() => (isFinalizeModalOpen = false)}
    onUnlockQuota={() => { extraQuotaUnlocked = true; isPaywallModalOpen = false; showToast("Payment Successful! Your quota has been extended.", "success"); }}
    onClosePaywall={() => (isPaywallModalOpen = false)}
/>

{#if toastMessage}
    <div class="toast toast-bottom toast-end z-[100] animate-in fade-in slide-in-from-bottom-5">
        <div class="alert font-bold rounded-2xl shadow-2xl border border-base-content/10 {toastType === 'success' ? 'alert-success text-success-content' : toastType === 'error' ? 'alert-error text-error-content' : 'alert-info text-info-content'}">
            <span>{toastMessage}</span>
        </div>
    </div>
{/if}

<style>
    :global(body) {
        background-color: oklch(var(--b1));
    }
</style>
