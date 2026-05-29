<script lang="ts">
    import { page } from "$app/state";
    import { api as clientApi } from "$lib/api";
    const api = clientApi as any;
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Motion } from "svelte-motion";
    import { env } from "../../../env";
    import ThemeToggle from "$lib/components/ThemeToggle.svelte";

    const galleryId = page.params.id;
    let isFinalizeModalOpen = $state(false);
    let isPaywallModalOpen = $state(false);
    let extraQuotaUnlocked = $state(false);
    let isSubmittingFinalization = $state(false);
    let gallery = $state<any>(null);
    let photos = $state<any[]>([]);
    let isLoading = $state(true);
    let clientId = $state("");
    let accessRequired = $state(false);
    let email = $state("");
    let otp = $state("");
    let step = $state<"email" | "otp" | "password">("email");
    let error = $state("");
    let isVerifying = $state(false);
    let password = $state("");
    let isDraft = $state(false);
    let isExpired = $state(false);

    let selectedPhotoIndex = $state<number | null>(null);

    // Client-side visual rotation state for lightbox
    let photoRotations = $state<Record<string, number>>({});
    let rotationDegrees = $derived(
        selectedPhotoIndex !== null && photos[selectedPhotoIndex]
            ? (photoRotations[photos[selectedPhotoIndex].id] || 0)
            : 0
    );

    function handleRotate(direction: "cw" | "ccw") {
        if (selectedPhotoIndex === null) return;
        const activePhoto = photos[selectedPhotoIndex];
        if (!activePhoto) return;

        const currentDeg = photoRotations[activePhoto.id] || 0;
        const nextDeg = direction === "cw"
            ? (currentDeg + 90) % 360
            : (currentDeg - 90 + 360) % 360;

        photoRotations[activePhoto.id] = nextDeg;
        resetZoom();
    }

    // Zoom & Pan State for public gallery lightbox
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
        if (selectedPhotoIndex !== null) {
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

    let toastMessage = $state("");
    let toastType = $state<"success" | "error" | "info">("info");

    function showToast(
        message: string,
        type: "success" | "error" | "info" = "info",
    ) {
        toastMessage = message;
        toastType = type;
        setTimeout(() => {
            toastMessage = "";
        }, 4000);
    }

    async function finalizeSelection() {
        isSubmittingFinalization = true;
        try {
            const res = await api.api.public.galleries[":id"].finalize.$post({
                param: { id: galleryId },
                header: { "x-client-id": clientId },
            });

            if (res.ok) {
                isFinalizeModalOpen = false;
                showToast(
                    "Selection finalized! Your photographer has been notified.",
                    "success",
                );
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(
                    errData.message || "Failed to finalize selection",
                    "error",
                );
            }
        } catch (e) {
            showToast(
                "Failed to finalize selection. Please try again.",
                "error",
            );
        } finally {
            isSubmittingFinalization = false;
        }
    }

    onMount(async () => {
        if (browser) {
            let storedId = localStorage.getItem("kirimkarya_client_id");
            if (!storedId) {
                storedId = crypto.randomUUID();
                localStorage.setItem("kirimkarya_client_id", storedId);
            }
            clientId = storedId;
        }

        try {
            const [metaRes, photosRes] = await Promise.all([
                api.api.public.galleries[":id"].$get({
                    param: { id: galleryId },
                }),
                api.api.public.galleries[":id"].photos.$get({
                    param: { id: galleryId },
                    header: { "x-client-id": clientId },
                }),
            ]);

            if (metaRes.status === 403) {
                const data = await metaRes.json();
                if (data.error === "Gallery not published yet") {
                    isDraft = true;
                } else {
                    accessRequired = true;
                }
                return;
            }

            if (metaRes.ok) {
                const data = await metaRes.json();
                gallery = data.data;

                if (
                    gallery.expiresAt &&
                    new Date(gallery.expiresAt) < new Date()
                ) {
                    isExpired = true;
                    isLoading = false;
                    return;
                }

                if (gallery.isPrivate) {
                    if (photosRes.status === 403) {
                        accessRequired = true;
                        if (gallery.accessMode === "PASSWORD") {
                            step = "email";
                        } else {
                            step = "email";
                        }
                    }
                }
            }

            if (photosRes.ok) {
                const data = await photosRes.json();
                photos = data.data;
            }
        } finally {
            isLoading = false;
        }
    });

    async function requestAccess() {
        error = "";
        isVerifying = true;
        try {
            if (gallery.accessMode === "PASSWORD") {
                if (email.includes("@")) {
                    step = "password";
                } else {
                    error = "Please enter a valid email address.";
                }
            } else {
                const res = await api.api.public.galleries[":id"][
                    "request-access"
                ].$post({
                    param: { id: galleryId },
                    json: { email },
                });
                if (res.ok) {
                    step = "otp";
                } else {
                    const data = await res.json();
                    error =
                        data.message ||
                        "Email not authorized for this gallery.";
                }
            }
        } catch (e) {
            error = "Something went wrong. Please try again.";
        } finally {
            isVerifying = false;
        }
    }

    async function verifyOTP() {
        error = "";
        isVerifying = true;
        try {
            const res = await api.api.public.galleries[":id"][
                "verify-otp"
            ].$post({
                param: { id: galleryId },
                json: { email, code: otp },
            });
            if (res.ok) {
                window.location.reload();
            } else {
                const data = await res.json();
                error = data.message || "Invalid or expired code";
            }
        } catch (e) {
            error = "Verification failed. Please try again.";
        } finally {
            isVerifying = false;
        }
    }

    async function verifyPassword() {
        error = "";
        isVerifying = true;
        try {
            const res = await api.api.public.galleries[":id"][
                "verify-password"
            ].$post({
                param: { id: galleryId },
                json: { email, password },
            });
            if (res.ok) {
                window.location.reload();
            } else {
                const data = await res.json();
                error =
                    data.message || "Incorrect password or unauthorized email";
            }
        } catch (e) {
            error = "Verification failed. Please try again.";
        } finally {
            isVerifying = false;
        }
    }

    async function toggleSelection(photoId: string) {
        const photo = photos.find((p) => p.id === photoId);
        if (!photo) return;

        const newStatus = !photo.isSelected;

        // If they exceed quota, trigger Paywall modal instead
        if (
            newStatus &&
            gallery?.selectionLimit > 0 &&
            shortlistedCount >= gallery.selectionLimit &&
            !extraQuotaUnlocked
        ) {
            isPaywallModalOpen = true;
            return;
        }

        photo.isSelected = newStatus;

        try {
            const res = await api.api.public.photos[":id"].feedback.$post({
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
                        showToast(
                            `Selection quota exceeded! You are allowed up to ${gallery?.selectionLimit || 0} selections.`,
                            "error",
                        );
                    }
                } else {
                    showToast(
                        errData.message || "Failed to update selection",
                        "error",
                    );
                }
            } else {
                if (newStatus) {
                    showToast("Photo added to shortlist!", "success");
                } else {
                    showToast("Photo removed from shortlist.", "info");
                }
            }
        } catch (e) {
            photo.isSelected = !newStatus;
            showToast("Something went wrong. Please try again.", "error");
        }
    }

    let saveTimeout: ReturnType<typeof setTimeout>;
    async function saveComment(photoId: string, comment: string) {
        const photo = photos.find((p) => p.id === photoId);
        if (!photo) return;

        photo.comment = comment;

        if (saveTimeout) clearTimeout(saveTimeout);

        saveTimeout = setTimeout(async () => {
            try {
                await api.api.public.photos[":id"].feedback.$post({
                    param: { id: photoId },
                    header: { "x-client-id": clientId },
                    json: { comment: comment },
                });
            } catch (e) {
                console.error("Failed to save comment", e);
            }
        }, 500);
    }

    const shortlistedCount = $derived(
        photos.filter((p) => p.isSelected).length,
    );
</script>

<svelte:head>
    <title>{gallery?.title || "Gallery"} | Kirim Karya</title>
</svelte:head>

<div
    class="min-h-screen bg-base-100 text-base-content selection:bg-primary selection:text-primary-content"
>
    {#if isLoading}
        <div class="flex items-center justify-center h-screen">
            <span class="loading loading-ring loading-lg text-primary"></span>
        </div>
    {:else if isDraft}
        <div
            class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center"
        >
            <Motion
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div class="max-w-md w-full space-y-8">
                    <div
                        class="inline-flex items-center justify-center p-6 bg-warning/10 text-warning rounded-full mb-4"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-10"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                            />
                        </svg>
                    </div>
                    <h1 class="text-5xl font-black tracking-tight">
                        Under Construction
                    </h1>
                    <p class="text-xl text-base-content/40 font-medium italic">
                        This gallery is currently in **DRAFT** mode and is not
                        yet ready for public viewing.
                    </p>
                    <div class="pt-8">
                        <a
                            href="/"
                            class="btn btn-ghost font-bold opacity-50 hover:opacity-100 italic underline-offset-8 underline"
                            >Return to Home</a
                        >
                    </div>
                </div>
            </Motion>
        </div>
    {:else if isExpired}
        <div
            class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center"
        >
            <Motion
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
            >
                <div class="max-w-md w-full space-y-8">
                    <div
                        class="inline-flex items-center justify-center p-6 bg-error/10 text-error rounded-full mb-4"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2.5"
                            stroke="currentColor"
                            class="size-10"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                            />
                        </svg>
                    </div>
                    <h1 class="text-5xl font-black tracking-tight">
                        Gallery Expired
                    </h1>
                    <p
                        class="text-base-content/40 font-bold uppercase tracking-wider text-xs"
                    >
                        This proofing window has closed
                    </p>
                    <p class="text-sm opacity-60 leading-relaxed font-medium">
                        Access to the gallery <strong
                            >"{gallery?.title || "this project"}"</strong
                        > has expired. Please contact your photographer if you need
                        to request a deadline extension to complete your selection.
                    </p>
                    <div class="pt-8">
                        <button
                            onclick={() => {
                                showToast(
                                    "Extension request sent! Your photographer will be notified.",
                                    "success",
                                );
                            }}
                            class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20 cursor-pointer h-14 w-full"
                        >
                            Request Extension
                        </button>
                    </div>
                </div>
            </Motion>
        </div>
    {:else if !gallery}
        <div
            class="flex flex-col items-center justify-center h-screen space-y-4"
        >
            <h1 class="text-4xl font-black italic opacity-20">
                Gallery Not Found
            </h1>
            <a
                href="/"
                class="btn btn-ghost font-bold opacity-50 hover:opacity-100 italic underline-offset-8 underline"
                >Back Home</a
            >
        </div>
    {:else if accessRequired}
        <!-- Security Wall -->
        <div
            class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center"
        >
            <Motion
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div class="max-w-md w-full space-y-8">
                    <div class="space-y-2">
                        <div
                            class="inline-flex items-center justify-center p-4 bg-primary/10 text-primary rounded-3xl mb-4"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2.5"
                                stroke="currentColor"
                                class="size-8"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                                />
                            </svg>
                        </div>
                        <h2 class="text-4xl font-black tracking-tight">
                            Private Gallery
                        </h2>
                        <p class="text-base-content/40 font-medium italic">
                            This gallery is protected. Please verify your email
                            to continue.
                        </p>
                    </div>

                    <div
                        class="bg-base-200/50 p-8 rounded-4xl border border-base-content/5 space-y-6"
                    >
                        {#if error}
                            <div
                                class="alert alert-error text-xs font-bold rounded-2xl animate-in shake duration-300"
                            >
                                {error}
                            </div>
                        {/if}

                        {#if step === "email"}
                            <div class="form-control w-full space-y-2">
                                <label class="label p-0" for="access-email">
                                    <span
                                        class="label-text font-black uppercase text-[10px] opacity-40 ml-1"
                                        >Your Email Address</span
                                    >
                                </label>
                                <input
                                    id="access-email"
                                    type="email"
                                    bind:value={email}
                                    placeholder="your@email.com"
                                    class="input input-lg bg-base-100 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary/20 transition-all"
                                />
                                <button
                                    class="btn btn-primary btn-lg w-full rounded-2xl font-black h-16 shadow-xl shadow-primary/20"
                                    onclick={requestAccess}
                                    disabled={isVerifying ||
                                        !email.includes("@")}
                                >
                                    {#if isVerifying}
                                        <span class="loading loading-spinner"
                                        ></span>
                                    {:else}
                                        {gallery?.accessMode === "PASSWORD"
                                            ? "Continue"
                                            : "Request Access"}
                                    {/if}
                                </button>
                            </div>
                        {:else if step === "otp"}
                            <div class="form-control w-full space-y-4">
                                <div class="space-y-1">
                                    <label class="label p-0" for="access-otp">
                                        <span
                                            class="label-text font-black uppercase text-[10px] opacity-40 ml-1"
                                            >Verification Code</span
                                        >
                                    </label>
                                    <input
                                        id="access-otp"
                                        type="text"
                                        bind:value={otp}
                                        placeholder="------"
                                        maxlength="6"
                                        class="input input-lg bg-base-100 rounded-2xl font-black text-center tracking-[0.5em] text-2xl border-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <p
                                    class="text-[10px] font-bold opacity-40 uppercase"
                                >
                                    Code sent to {email}
                                </p>
                                <button
                                    class="btn btn-primary btn-lg w-full rounded-2xl font-black h-16 shadow-xl shadow-primary/20"
                                    onclick={verifyOTP}
                                    disabled={isVerifying || otp.length < 6}
                                >
                                    {#if isVerifying}
                                        <span class="loading loading-spinner"
                                        ></span>
                                    {:else}
                                        Verify & Enter
                                    {/if}
                                </button>
                                <button
                                    class="btn btn-ghost btn-sm font-black opacity-40 hover:opacity-100"
                                    onclick={() => (step = "email")}
                                >
                                    Change Email
                                </button>
                            </div>
                        {:else if step === "password"}
                            <div class="form-control w-full space-y-4">
                                <div class="space-y-1">
                                    <label
                                        class="label p-0"
                                        for="access-password"
                                    >
                                        <span
                                            class="label-text font-black uppercase text-[10px] opacity-40 ml-1"
                                            >Gallery Password</span
                                        >
                                    </label>
                                    <input
                                        id="access-password"
                                        type="password"
                                        bind:value={password}
                                        placeholder="••••••••"
                                        class="input input-lg bg-base-100 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                                <p
                                    class="text-[10px] font-bold opacity-40 uppercase"
                                >
                                    Access for {email}
                                </p>
                                <button
                                    class="btn btn-primary btn-lg w-full rounded-2xl font-black h-16 shadow-xl shadow-primary/20"
                                    onclick={verifyPassword}
                                    disabled={isVerifying ||
                                        password.length < 1}
                                >
                                    {#if isVerifying}
                                        <span class="loading loading-spinner"
                                        ></span>
                                    {:else}
                                        Unlock Gallery
                                    {/if}
                                </button>
                                <button
                                    class="btn btn-ghost btn-sm font-black opacity-40 hover:opacity-100"
                                    onclick={() => (step = "email")}
                                >
                                    Change Email
                                </button>
                            </div>
                        {/if}
                    </div>

                    <a
                        href="/"
                        class="btn btn-ghost btn-sm font-bold opacity-30"
                        >Back Home</a
                    >
                </div>
            </Motion>
        </div>
    {:else}
        <!-- Navigation -->
        <nav
            class="sticky top-0 z-40 bg-base-100/80 backdrop-blur-xl border-b border-base-content/5 px-8 h-20 flex items-center justify-between"
        >
            <div>
                <h1 class="text-2xl font-black tracking-tight">
                    {gallery.title}
                </h1>
                <p
                    class="text-[10px] uppercase font-black tracking-widest opacity-40 italic"
                >
                    By Kirim Karya Photographers
                </p>
            </div>

            <div class="flex items-center gap-6">
                {#if shortlistedCount > 0}
                    <div
                        class="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-black text-xs animate-in zoom-in duration-300"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            class="size-4"
                        >
                            <path
                                d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z"
                            />
                        </svg>
                        <span>{shortlistedCount} SHORTLISTED</span>
                    </div>
                {/if}
                {#if gallery?.deliveryStatus === "COMPLETED" && gallery?.deliveryZipKey}
                    <a
                        href="{env.PUBLIC_API_URL ||
                            'http://localhost:3000'}/api/public/galleries/{galleryId}/download"
                        class="btn btn-success btn-sm rounded-full font-black px-6 text-success-content shadow-xl shadow-success/20 animate-pulse"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2.5"
                            stroke="currentColor"
                            class="size-4 mr-1"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                            />
                        </svg>
                        Download High-Res ZIP
                    </a>
                {:else}
                    <button
                        onclick={() => (isFinalizeModalOpen = true)}
                        disabled={shortlistedCount === 0}
                        class="btn btn-primary btn-sm rounded-full font-black px-6 shadow-xl shadow-primary/20"
                    >
                        Send Selection
                    </button>
                {/if}
                <div class="border-l border-base-content/10 pl-4 py-1 flex items-center">
                    <ThemeToggle />
                </div>
            </div>
        </nav>

        <!-- Gallery Hero / Info -->
        <div class="p-8 md:p-20 text-center space-y-4">
            <div
                class="badge badge-primary font-black text-[10px] tracking-widest uppercase px-3 py-1 mb-4"
            >
                Official Gallery
            </div>
            <h2
                class="text-6xl md:text-8xl font-black tracking-tighter leading-none mx-auto max-w-4xl"
            >
                {gallery.title}
            </h2>
            <p
                class="text-xl md:text-2xl text-base-content/40 font-medium italic"
            >
                A curated selection of your special moments.
            </p>
        </div>

        <!-- Masonry Grid -->
        <div class="px-4 md:px-8 pb-32">
            <div
                class="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4"
            >
                {#each photos as photo, i}
                    <Motion
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            duration: 0.5,
                            delay: i * 0.05,
                            ease: "easeOut",
                        }}
                    >
                        <div
                            class="relative group break-inside-avoid rounded-3xl overflow-hidden bg-base-200 border border-base-content/5 transition-all hover:shadow-2xl hover:shadow-primary/5 inline-block w-full mb-4"
                        >
                            <button
                                class="w-full text-left focus:outline-hidden cursor-zoom-in"
                                onclick={() => (selectedPhotoIndex = i)}
                            >
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
                                    <div
                                        class="btn btn-circle btn-sm bg-black/20 text-white backdrop-blur-md border border-white/20 pointer-events-none"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke-width="2.5"
                                            stroke="currentColor"
                                            class="size-4"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                                            />
                                        </svg>
                                    </div>
                                {/if}
                                <button
                                    onclick={() => toggleSelection(photo.id)}
                                    class="btn btn-circle btn-sm shadow-2xl backdrop-blur-md border border-white/20 transition-all {photo.isSelected
                                        ? 'bg-primary text-primary-content'
                                        : 'bg-black/20 text-white hover:bg-primary/80'}"
                                    aria-label={photo.isSelected
                                        ? "Deselect photo"
                                        : "Select photo"}
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill={photo.isSelected
                                            ? "currentColor"
                                            : "none"}
                                        viewBox="0 0 24 24"
                                        stroke-width="2.5"
                                        stroke="currentColor"
                                        class="size-4"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </Motion>
                {/each}
            </div>
        </div>

        <!-- Elegant Footer -->
        <footer class="py-12 border-t border-base-content/5 text-center bg-base-100/50 backdrop-blur-md rounded-t-[32px] mt-16 max-w-7xl mx-auto px-6">
            <p class="text-xs font-black tracking-widest uppercase opacity-45">Kirim Karya Proofing</p>
            <p class="text-[10px] opacity-35 mt-2">© 2026 Kirim Karya. Beautiful client proofing experience. All rights reserved.</p>
        </footer>
    {/if}
</div>

<!-- Lightbox Modal -->
{#if selectedPhotoIndex !== null}
    <div
        class="fixed inset-0 z-9999 bg-base-100 flex flex-col md:flex-row animate-in fade-in duration-300 overflow-hidden"
    >
        <!-- Left Pane: Image Viewer -->
        <div class="flex-1 h-full flex flex-col relative bg-base-200/30 overflow-hidden">
            <!-- Viewer Header -->
            <div
                class="h-20 flex items-center justify-between px-6 bg-base-100/10 border-b border-base-content/5 z-10"
            >
                <div class="flex items-center gap-4">
                    <span
                        class="text-xs font-black italic opacity-60 uppercase tracking-widest bg-base-200/80 px-3 py-1.5 rounded-full"
                        >{selectedPhotoIndex + 1} / {photos.length}</span
                    >
                </div>
                <div class="flex items-center gap-2">
                    <!-- Symmetrical visual rotation buttons -->
                    <button
                        onclick={() => handleRotate("ccw")}
                        class="btn btn-ghost btn-circle btn-sm animate-none"
                        title="Rotate Counter-Clockwise"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                        </svg>
                    </button>
                    <button
                        onclick={() => handleRotate("cw")}
                        class="btn btn-ghost btn-circle btn-sm animate-none"
                        title="Rotate Clockwise"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
                        </svg>
                    </button>
                    
                    <!-- Close Button on Mobile/Desktop left pane -->
                    <button
                        onclick={() => (selectedPhotoIndex = null)}
                        class="btn btn-ghost btn-circle btn-sm md:hidden"
                        aria-label="Close Lightbox"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <!-- Viewport with Navigation -->
            <div class="flex-1 relative flex items-center justify-center p-4 min-h-0">
                <!-- Prev -->
                <button
                    disabled={selectedPhotoIndex === 0}
                    onclick={() =>
                        selectedPhotoIndex !== null &&
                        selectedPhotoIndex > 0 &&
                        selectedPhotoIndex--}
                    class="absolute left-4 z-25 w-12 h-12 rounded-full bg-base-100/50 hover:bg-base-100/80 text-base-content flex items-center justify-center disabled:opacity-0 transition-opacity border border-base-content/5 cursor-pointer shadow-md"
                    aria-label="Previous Photo"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="3"
                        stroke="currentColor"
                        class="size-6"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M15.75 19.5 8.25 12l7.5-7.5"
                        />
                    </svg>
                </button>

                <div bind:this={imageContainerEl} class="w-full h-full flex items-center justify-center max-w-[85%] max-h-[85%] relative overflow-hidden">
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <img
                        src={photos[selectedPhotoIndex!].watermarkUrl}
                        alt="Selected preview"
                        onmousedown={handleMouseDown}
                        onmousemove={handleMouseMove}
                        onmouseup={handleMouseUp}
                        onmouseleave={handleMouseUp}
                        ondblclick={resetZoom}
                        class="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-base-content/5 animate-in zoom-in duration-300 select-none"
                        style="transform: translate({panX}px, {panY}px) scale({zoomScale}) rotate({rotationDegrees}deg); transition: {isPanning ? 'none' : 'transform 0.15s ease-out'}; cursor: {zoomScale > 1 ? isPanning ? 'grabbing' : 'grab' : 'zoom-in'};"
                        draggable="false"
                    />
                </div>

                <!-- Next -->
                <button
                    disabled={selectedPhotoIndex === photos.length - 1}
                    onclick={() =>
                        selectedPhotoIndex !== null &&
                        selectedPhotoIndex < photos.length - 1 &&
                        selectedPhotoIndex++}
                    class="absolute right-4 z-25 w-12 h-12 rounded-full bg-base-100/50 hover:bg-base-100/80 text-base-content flex items-center justify-center disabled:opacity-0 transition-opacity border border-base-content/5 cursor-pointer shadow-md"
                    aria-label="Next Photo"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="3"
                        stroke="currentColor"
                        class="size-6"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m8.25 4.5 7.5 7.5-7.5 7.5"
                        />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Right Pane: Details Sidebar -->
        <div class="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-base-content/10 bg-base-100 flex flex-col h-full z-20">
            <!-- Sidebar Header -->
            <div class="h-20 px-6 md:px-8 border-b border-base-content/5 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-black uppercase tracking-wider opacity-60">Photo Info</h3>
                    <p class="text-[11px] font-mono opacity-40 truncate max-w-[200px]">{photos[selectedPhotoIndex!].filename || `IMG_${photos[selectedPhotoIndex!].id.slice(0,8)}`}</p>
                </div>
                <!-- Symmetrical desktop close button -->
                <button
                    onclick={() => (selectedPhotoIndex = null)}
                    class="btn btn-ghost btn-circle btn-sm hidden md:flex"
                    aria-label="Close Lightbox"
                >
                    ✕
                </button>
            </div>

            <!-- Sidebar Scrollable Body -->
            <div class="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <!-- Selection State badge -->
                <div class="flex items-center justify-between bg-base-200/50 p-4 rounded-2xl border border-base-content/5">
                    <span class="text-xs font-black uppercase opacity-55">Selection Status</span>
                    <span class="badge font-black text-[10px] uppercase px-3 py-1 {photos[selectedPhotoIndex!].isSelected ? 'badge-primary' : 'badge-ghost border-base-content/10'}">
                        {photos[selectedPhotoIndex!].isSelected ? 'Selected' : 'Not Selected'}
                    </span>
                </div>

                <!-- Selection Quota Info inside Sidebar -->
                {#if gallery.selectionLimit > 0}
                    <div class="bg-base-200/50 p-4 rounded-2xl border border-base-content/5 space-y-2">
                        <div class="flex items-center justify-between text-[10px] font-black tracking-widest uppercase opacity-55">
                            <span>Shortlist Progress</span>
                            <span class={shortlistedCount > gallery.selectionLimit ? 'text-error' : 'text-primary'}>
                                {shortlistedCount} / {gallery.selectionLimit}
                            </span>
                        </div>
                        <div class="w-full bg-base-300 rounded-full h-1.5 overflow-hidden">
                            <div 
                                class="h-full rounded-full transition-all duration-300 {shortlistedCount > gallery.selectionLimit ? 'bg-error' : shortlistedCount === gallery.selectionLimit ? 'bg-success' : 'bg-primary'}"
                                style="width: {Math.min((shortlistedCount / gallery.selectionLimit) * 100, 100)}%"
                            ></div>
                        </div>
                    </div>
                {/if}

                <!-- Client Comments & Notes section -->
                <div class="space-y-2">
                    <label class="label p-0" for="lightbox-comment">
                        <span class="label-text text-[10px] font-black uppercase tracking-wider opacity-60">Comments & Instructions</span>
                    </label>
                    <div class="relative group">
                        <textarea
                            id="lightbox-comment"
                            placeholder="Add sizing request, retouch notes, or special instructions for your photographer..."
                            class="textarea textarea-bordered w-full bg-base-200/40 rounded-2xl border-base-content/10 focus:border-primary/50 transition-all py-4 px-6 min-h-[140px] text-sm resize-none"
                            value={photos[selectedPhotoIndex!].comment || ""}
                            oninput={(e) =>
                                saveComment(
                                    photos[selectedPhotoIndex!].id,
                                    e.currentTarget.value,
                                )}
                        ></textarea>
                        <div
                            class="absolute right-4 bottom-4 opacity-20 pointer-events-none"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="2"
                                stroke="currentColor"
                                class="size-4"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                                />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sidebar Selection Call-to-Action Footer -->
            <div class="p-6 md:p-8 border-t border-base-content/5 bg-base-200/20">
                <button
                    onclick={() => toggleSelection(photos[selectedPhotoIndex!].id)}
                    class="btn btn-lg w-full h-14 rounded-2xl font-black transition-all gap-2 duration-300 shadow-xl {photos[selectedPhotoIndex!].isSelected
                        ? 'btn-primary text-primary-content shadow-primary/20 hover:scale-[1.01]'
                        : 'btn-outline border-base-content/25 text-base-content hover:bg-primary hover:text-primary-content hover:border-primary hover:scale-[1.01]'}"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill={photos[selectedPhotoIndex!].isSelected ? "currentColor" : "none"}
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                        stroke="currentColor"
                        class="size-5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z"
                        />
                    </svg>
                    <span>
                        {photos[selectedPhotoIndex!].isSelected ? 'Shortlisted' : 'Add to Shortlist'}
                    </span>
                </button>
            </div>
        </div>
    </div>
{/if}

{#if isFinalizeModalOpen}
    <div class="modal modal-open z-50">
        <div
            class="modal-box rounded-3xl max-w-md p-8 border border-base-content/5 bg-base-100 shadow-2xl animate-in zoom-in-95"
        >
            <h3 class="text-2xl font-black mb-4">Send Selection?</h3>
            <p class="text-sm opacity-75 mb-6 leading-relaxed">
                Are you ready to submit your shortlisted selection of <strong
                    class="text-primary">{shortlistedCount}</strong
                > photos to your photographer? This will notify them to start packaging
                your high-resolution original copies.
            </p>
            <div class="modal-action flex justify-end gap-3 mt-8">
                <button
                    class="btn btn-ghost rounded-2xl font-black cursor-pointer"
                    onclick={() => (isFinalizeModalOpen = false)}
                    disabled={isSubmittingFinalization}
                >
                    Cancel
                </button>
                <button
                    class="btn btn-primary rounded-2xl font-black px-6 shadow-lg shadow-primary/20 cursor-pointer"
                    onclick={finalizeSelection}
                    disabled={isSubmittingFinalization}
                >
                    {#if isSubmittingFinalization}
                        <span class="loading loading-spinner loading-xs"></span>
                    {:else}
                        Submit Selection
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if isPaywallModalOpen}
    <div class="modal modal-open z-50">
        <div
            class="modal-box rounded-3xl max-w-md p-8 border border-base-content/5 bg-base-100 shadow-2xl space-y-6 animate-in zoom-in-95"
        >
            <div class="flex items-center justify-between">
                <span
                    class="badge badge-secondary font-black text-[9px] tracking-widest uppercase px-2.5 py-1"
                    >Premium Upgrade</span
                >
                <button
                    class="btn btn-sm btn-circle btn-ghost"
                    onclick={() => (isPaywallModalOpen = false)}>✕</button
                >
            </div>

            <div class="text-center space-y-2">
                <h3 class="text-3xl font-black tracking-tight leading-none">
                    Extend Your Limit
                </h3>
                <p class="text-xs opacity-60 font-bold uppercase">
                    Unlock selections beyond free limit
                </p>
            </div>

            <div class="bg-base-200/50 p-6 rounded-2xl text-center space-y-1">
                <span class="text-xs opacity-50 uppercase font-black"
                    >Price Per Extra Photo</span
                >
                <h4 class="text-2xl font-black text-primary">
                    {new Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                    }).format(gallery?.pricePerExtraPhoto || 0)}
                </h4>
                <p class="text-[10px] opacity-40 font-bold">
                    Set by your photographer: {gallery?.title}
                </p>
            </div>

            <div class="space-y-4">
                <div class="form-control w-full space-y-1">
                    <span
                        class="label-text font-black uppercase text-[9px] opacity-40 ml-1"
                        >Cardholder Name</span
                    >
                    <input
                        type="text"
                        placeholder="John Doe"
                        class="input input-bordered rounded-2xl font-bold bg-base-200/50"
                    />
                </div>
                <div class="form-control w-full space-y-1">
                    <span
                        class="label-text font-black uppercase text-[9px] opacity-40 ml-1"
                        >Card Details (Mockup)</span
                    >
                    <div class="relative">
                        <input
                            type="text"
                            placeholder="4242 4242 4242 4242"
                            class="input input-bordered w-full rounded-2xl font-bold bg-base-200/50 pr-20"
                        />
                        <span
                            class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30 tracking-widest"
                            >MM/YY CVC</span
                        >
                    </div>
                </div>
            </div>

            <div
                class="alert alert-info text-[10px] font-black rounded-2xl p-4 bg-info/10 text-info border-none"
            >
                <span
                    >🔒 Secure checkout powered by Stripe. You will be billed
                    only for the excess selections you approve.</span
                >
            </div>

            <button
                onclick={() => {
                    extraQuotaUnlocked = true;
                    isPaywallModalOpen = false;
                    showToast(
                        "Payment Successful! Your quota has been extended.",
                        "success",
                    );
                }}
                class="btn btn-primary btn-lg w-full rounded-2xl font-black shadow-xl shadow-primary/20 h-14"
            >
                Pay & Unlock Extra Quota
            </button>
        </div>
    </div>
{/if}

{#if toastMessage}
    <div
        class="toast toast-bottom toast-end z-100 animate-in fade-in slide-in-from-bottom-5"
    >
        <div
            class="alert font-bold rounded-2xl shadow-2xl border border-base-content/10 {toastType ===
            'success'
                ? 'alert-success text-success-content'
                : toastType === 'error'
                  ? 'alert-error text-error-content'
                  : 'alert-info text-info-content'}"
        >
            <span>{toastMessage}</span>
        </div>
    </div>
{/if}

<style>
    /* Premium Masonry spacing and hover effects */
    :global(body) {
        background-color: oklch(var(--b1));
    }
</style>
