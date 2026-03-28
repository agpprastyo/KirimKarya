<script lang="ts">
    import { page } from "$app/state";
    import { api as clientApi } from "$lib/api";
    const api = clientApi as any;
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Motion } from "svelte-motion";

    const galleryId = page.params.id;
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

    let selectedPhotoIndex = $state<number | null>(null);

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

        photo.isSelected = newStatus;

        try {
            const res = await api.api.public.photos[":id"].feedback.$post({
                param: { id: photoId },
                header: { "x-client-id": clientId },
                json: { isSelected: newStatus },
            });

            if (!res.ok) {
                photo.isSelected = !newStatus;
            }
        } catch (e) {
            photo.isSelected = !newStatus;
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
                <button
                    class="btn btn-primary btn-sm rounded-full font-black px-6 shadow-xl shadow-primary/20"
                    >Send Selection</button
                >
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
                class="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4"
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
                            class="relative group break-inside-avoid rounded-3xl overflow-hidden bg-base-200 border border-base-content/5 transition-all hover:shadow-2xl hover:shadow-primary/5"
                        >
                            <button
                                class="w-full text-left focus:outline-hidden cursor-zoom-in"
                                onclick={() => (selectedPhotoIndex = i)}
                            >
                                <img
                                    src={photo.thumbnailUrl}
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
    {/if}
</div>

<!-- Lightbox Modal -->
{#if selectedPhotoIndex !== null}
    <div
        class="fixed inset-0 z-9999 bg-base-100/95 backdrop-blur-3xl flex flex-col animate-in fade-in duration-300"
    >
        <div
            class="h-20 flex items-center justify-between px-8 bg-base-100/10 border-b border-base-content/5"
        >
            <div class="flex items-center gap-4">
                <span
                    class="text-xs font-black italic opacity-40 uppercase tracking-widest"
                    >{selectedPhotoIndex + 1} / {photos.length}</span
                >
            </div>
            <button
                onclick={() => (selectedPhotoIndex = null)}
                class="btn btn-ghost btn-circle btn-lg"
                aria-label="Close Lightbox"
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
                        d="M6 18 18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>

        <div class="flex-1 relative flex items-center justify-center p-4">
            <!-- Prev/Next -->
            <button
                disabled={selectedPhotoIndex === 0}
                onclick={() =>
                    selectedPhotoIndex !== null &&
                    selectedPhotoIndex > 0 &&
                    selectedPhotoIndex--}
                class="absolute left-8 btn btn-circle btn-lg btn-ghost disabled:opacity-0 transition-opacity"
                aria-label="Previous Photo"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="3"
                    stroke="currentColor"
                    class="size-8"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15.75 19.5 8.25 12l7.5-7.5"
                    />
                </svg>
            </button>

            <img
                src={photos[selectedPhotoIndex!].watermarkUrl}
                alt="Selected preview"
                class="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/5 animate-in zoom-in duration-500"
            />

            <button
                disabled={selectedPhotoIndex === photos.length - 1}
                onclick={() =>
                    selectedPhotoIndex !== null &&
                    selectedPhotoIndex < photos.length - 1 &&
                    selectedPhotoIndex++}
                class="absolute right-8 btn btn-circle btn-lg btn-ghost disabled:opacity-0 transition-opacity"
                aria-label="Next Photo"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="3"
                    stroke="currentColor"
                    class="size-8"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                </svg>
            </button>
        </div>

        <!-- Comment and Selection Bar in Lightbox -->
        <div class="flex flex-col items-center gap-6 pb-12">
            <div class="w-full max-w-lg px-4">
                <div class="relative group">
                    <textarea
                        placeholder="Add a special instruction or comment for this photo..."
                        class="textarea textarea-bordered w-full bg-base-200/50 backdrop-blur-md rounded-2xl border-base-content/10 focus:border-primary/50 transition-all py-4 px-6 min-h-[80px] text-sm resize-none"
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

            <button
                onclick={() => toggleSelection(photos[selectedPhotoIndex!].id)}
                class="btn btn-lg rounded-full font-black px-12 transition-all gap-3 {photos[
                    selectedPhotoIndex
                ].isSelected
                    ? 'btn-primary shadow-xl shadow-primary/30'
                    : 'bg-base-200 hover:bg-primary/10'}"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill={photos[selectedPhotoIndex].isSelected
                        ? "currentColor"
                        : "none"}
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="size-6"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.5 3c1.557 0 3.046.727 4 2.015Q12.454 3 14 3c2.786 0 5.25 2.322 5.25 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001Z"
                    />
                </svg>
                <span
                    >{photos[selectedPhotoIndex!].isSelected
                        ? "SHORTLISTED"
                        : "ADD TO SHORTLIST"}</span
                >
            </button>
        </div>
    </div>
{/if}

<style>
    /* Premium Masonry spacing and hover effects */
    :global(body) {
        background-color: oklch(var(--b1));
    }
</style>
