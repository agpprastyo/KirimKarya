<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { env } from "../../../env";
    import Alert from "$lib/components/Alert.svelte";
    import MeshBackground from "$lib/components/MeshBackground.svelte";
    import Cropper from "svelte-easy-crop";
    import { getCroppedImg } from "$lib/utils/canvas";
    import { fade, scale } from "svelte/transition";

    const session = authClient.useSession();

    let name = $state("");
    let avatarFile: File | null = $state(null);
    let avatarPreview: string | null = $state(null);
    let showCropper = $state(false);
    let crop = $state({ x: 0, y: 0 });
    let zoom = $state(1);
    let croppedAreaPixels = $state({ x: 0, y: 0, width: 0, height: 0 });
    let imageToCrop: string | undefined = $state(undefined);

    let currentPassword = $state("");
    let newPassword = $state("");
    let confirmPassword = $state("");
    let loading = $state(false);
    let alertRef: any;

    $effect(() => {
        if ($session.data?.user?.name) {
            name = $session.data.user.name;
        }
    });

    function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];

            imageToCrop = URL.createObjectURL(file);
            showCropper = true;
            input.value = ""; // Reset input value to allow selecting the same file again if cancelled
        }
    }

    async function handleCropConfirm() {
        if (!imageToCrop) return;

        try {
            const croppedBlob = await getCroppedImg(
                imageToCrop,
                croppedAreaPixels,
            );

            const croppedFile = new File([croppedBlob], "avatar.jpg", {
                type: "image/jpeg",
            });

            avatarFile = croppedFile;
            avatarPreview = URL.createObjectURL(croppedBlob);
            showCropper = false;
            imageToCrop = undefined;
        } catch (err: any) {
            alertRef.show("Failed to crop image", "error");
        }
    }

    function onCropComplete(details: {
        pixels: { x: number; y: number; width: number; height: number };
    }) {
        croppedAreaPixels = details.pixels;
    }

    async function uploadAvatar() {
        if (!avatarFile) return;

        loading = true;
        try {
            const formData = new FormData();
            formData.append("file", avatarFile);

            const response = await fetch(
                `${env.PUBLIC_API_URL}/api/auth/avatar`,
                {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                },
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to upload image");
            }

            await authClient.getSession();

            alertRef.show("Profile photo updated", "success");
            avatarFile = null;
            avatarPreview = null;
        } catch (err: any) {
            alertRef.show(err.message, "error");
        } finally {
            loading = false;
        }
    }

    async function handleUpdateProfile() {
        loading = true;
        try {
            const { error } = await authClient.updateUser({
                name,
            });

            if (error) {
                alertRef.show(
                    error.message || "Failed to update profile",
                    "error",
                );
            } else {
                alertRef.show("Profile updated successfully", "success");
            }
        } catch (err: any) {
            alertRef.show(err.message, "error");
        } finally {
            loading = false;
        }
    }

    async function handleChangePassword() {
        if (newPassword !== confirmPassword) {
            alertRef.show("Passwords do not match", "error");
            return;
        }

        loading = true;
        try {
            const { error } = await authClient.changePassword({
                newPassword,
                currentPassword,
                revokeOtherSessions: true,
            });

            if (error) {
                alertRef.show(
                    error.message || "Failed to change password",
                    "error",
                );
            } else {
                alertRef.show("Password changed successfully", "success");
                currentPassword = "";
                newPassword = "";
                confirmPassword = "";
            }
        } catch (err: any) {
            alertRef.show(err.message, "error");
        } finally {
            loading = false;
        }
    }

    import { api as apiClient, handleResponse } from "$lib/api";

    let watermarkType = $state<"TEXT" | "IMAGE">("TEXT");
    let watermarkText = $state("Kirim Karya");
    let watermarkOpacity = $state(30);
    let watermarkImageUrl = $state<string | null>(null);
    let previewLogoBase64 = $state<string | null>(null);
    let logoUploading = $state(false);
    let watermarkSaving = $state(false);

    $effect(() => {
        const fetchWatermark = async () => {
            try {
                const res = (await handleResponse(apiClient.api.watermark.$get())) as any;
                if (res.data) {
                    watermarkType = res.data.watermarkType as any;
                    watermarkText = res.data.watermarkText;
                    watermarkOpacity = res.data.watermarkOpacity;
                    watermarkImageUrl = res.data.watermarkImageUrl;

                    if (watermarkImageUrl) {
                        try {
                            const imgRes = await fetch(watermarkImageUrl, { credentials: "include" });
                            if (imgRes.ok) {
                                const blob = await imgRes.blob();
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    previewLogoBase64 = reader.result as string;
                                };
                                reader.readAsDataURL(blob);
                            }
                        } catch (err: any) {
                            console.error("Failed to load watermark logo base64 preview:", err);
                        }
                    }
                }
            } catch (err: any) {
                console.error("Failed to fetch watermark settings:", err);
            }
        };
        fetchWatermark();
    });

    async function handleWatermarkLogoChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.type !== "image/png") {
                alertRef.show("Only transparent PNG images are supported for logos", "error");
                return;
            }
            if (file.size > 2 * 1024 * 1024) {
                alertRef.show("Logo file size must be under 2MB", "error");
                return;
            }

            // Read locally for immediate, high-fidelity offline live preview!
            const reader = new FileReader();
            reader.onload = (evt) => {
                previewLogoBase64 = evt.target?.result as string;
            };
            reader.readAsDataURL(file);

            logoUploading = true;
            try {
                const formData = new FormData();
                formData.append("file", file);

                const url = apiClient.api.watermark.image.$url();
                const res = await fetch(url.toString(), {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                });

                const result = await res.json();
                if (!res.ok) {
                    throw new Error(result.message || "Upload failed");
                }

                watermarkImageUrl = result.data.url;
                alertRef.show("Watermark logo uploaded successfully!", "success");
            } catch (err: any) {
                alertRef.show(err.message, "error");
            } finally {
                logoUploading = false;
            }
        }
    }

    async function handleSaveWatermarkSettings() {
        watermarkSaving = true;
        try {
            const res = await apiClient.api.watermark.$put({
                json: {
                    watermarkType,
                    watermarkText,
                    watermarkOpacity,
                },
            });

            if (!res.ok) {
                const result = await res.json() as any;
                throw new Error(result.message || "Failed to update settings");
            }

            alertRef.show("Watermark settings updated successfully!", "success");
        } catch (err: any) {
            alertRef.show(err.message, "error");
        } finally {
            watermarkSaving = false;
        }
    }

    let watermarkRegenerating = $state(false);

    async function handleRegenerateWatermarks() {
        watermarkRegenerating = true;
        try {
            const res = await fetch(`${env.PUBLIC_API_URL}/api/watermark/regenerate`, {
                method: "POST",
                credentials: "include",
            });

            const result = await res.json() as any;
            if (!res.ok) {
                throw new Error(result.message || "Failed to start regeneration");
            }

            alertRef.show(
                `Successfully queued ${result.data.queuedCount} photo(s) for watermark regeneration in the background!`,
                "success"
            );
        } catch (err: any) {
            alertRef.show(err.message, "error");
        } finally {
            watermarkRegenerating = false;
        }
    }

    const previewSvgUrl = $derived(
        watermarkType === "IMAGE" && previewLogoBase64
            ? `url("data:image/svg+xml,${encodeURIComponent(
                [
                    "<" + "svg xmlns=\"http://www.w3.org/2000/svg\" width=\"150\" height=\"150\">",
                    "<" + "style>.wm { transform: rotate(-30deg); transform-origin: center; opacity: " + (watermarkOpacity / 100) + "; }</style>",
                    "<" + "image href=\"" + previewLogoBase64 + "\" x=\"25\" y=\"25\" width=\"100\" height=\"100\" class=\"wm\" />",
                    "</" + "svg>"
                ].join("")
              )}")`
            : `url("data:image/svg+xml,${encodeURIComponent(
                [
                    "<" + "svg xmlns=\"http://www.w3.org/2000/svg\" width=\"180\" height=\"180\">",
                    "<" + "style>.wm { font-family: sans-serif; font-weight: 900; font-size: 14px; fill: white; opacity: " + (watermarkOpacity / 100) + "; text-anchor: middle; transform: rotate(-30deg); transform-origin: center; }</style>",
                    "<" + "text x=\"90\" y=\"90\" class=\"wm\">" + watermarkText + "</text>",
                    "</" + "svg>"
                ].join("")
              )}")`
    );
</script>

<div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div>
        <h1 class="text-4xl font-black tracking-tight mb-2">Settings</h1>
        <p class="text-base-content/60 font-medium">
            Manage your personal information and security.
        </p>
    </div>

    <Alert bind:this={alertRef} />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Profile Settings -->
        <div
            class="card bg-base-100 shadow-sm border border-base-content/5 overflow-hidden"
        >
            <div class="card-body">
                <h2 class="card-title text-xl font-bold mb-4">
                    Profile Information
                </h2>

                <div class="flex flex-col items-center gap-4 mb-6">
                    <div class="relative group">
                        <div
                            class="size-24 rounded-full ring-4 ring-primary/10 overflow-hidden bg-base-300 relative"
                        >
                            {#if avatarPreview}
                                <img
                                    src={avatarPreview}
                                    alt="Preview"
                                    class="size-full object-cover"
                                />
                            {:else if $session.data?.user?.image}
                                <img
                                    src={$session.data.user.image}
                                    alt="Profile"
                                    class="size-full object-cover"
                                />
                            {:else}
                                <div
                                    class="size-full flex items-center justify-center text-4xl font-black opacity-20"
                                >
                                    {$session.data?.user?.name?.charAt(0) ||
                                        "U"}
                                </div>
                            {/if}

                            <label
                                class="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 cursor-pointer transition-all border-none"
                                for="avatar-input"
                                aria-label="Upload profile photo"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke-width="2"
                                    stroke="currentColor"
                                    class="size-6"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                                    />
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                                    />
                                </svg>
                            </label>
                        </div>
                        <input
                            id="avatar-input"
                            type="file"
                            accept="image/*"
                            class="hidden"
                            onchange={handleFileChange}
                        />
                    </div>

                    {#if avatarPreview}
                        <div class="flex gap-2">
                            <button
                                class="btn btn-primary btn-sm rounded-lg"
                                onclick={uploadAvatar}
                                disabled={loading}
                            >
                                {#if loading}<span
                                        class="loading loading-spinner loading-xs"
                                    ></span>{/if}
                                Upload Photo
                            </button>
                            <button
                                class="btn btn-ghost btn-sm rounded-lg"
                                onclick={() => {
                                    avatarPreview = null;
                                    avatarFile = null;
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    {:else}
                        <p class="text-xs opacity-50 font-medium">
                            Click on the image to upload a new photo.
                        </p>
                    {/if}
                </div>

                <form class="space-y-4" onsubmit={handleUpdateProfile}>
                    <div class="form-control">
                        <label class="label p-1" for="name">
                            <span class="label-text font-bold opacity-70"
                                >Display Name</span
                            >
                        </label>
                        <input
                            id="name"
                            type="text"
                            bind:value={name}
                            class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                            placeholder="Your Name"
                        />
                    </div>

                    <div class="form-control">
                        <label class="label p-1" for="email">
                            <span class="label-text font-bold opacity-70"
                                >Email Address</span
                            >
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={$session.data?.user?.email}
                            disabled
                            class="input input-bordered w-full bg-base-200/20 border-base-content/5 opacity-60 cursor-not-allowed"
                        />
                        <span class="label-text-alt mt-1 px-1 opacity-50 italic"
                            >Email cannot be changed currently.</span
                        >
                    </div>

                    <div class="card-actions justify-end mt-4">
                        <button
                            class="btn btn-primary font-bold shadow-lg shadow-primary/20"
                            type="submit"
                            disabled={loading}
                        >
                            {#if loading}<span
                                    class="loading loading-spinner loading-xs"
                                ></span>{/if}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Security Settings -->
        <div
            class="card bg-base-100 shadow-sm border border-base-content/5 overflow-hidden"
        >
            <div class="card-body">
                <h2 class="card-title text-xl font-bold mb-4">
                    Change Password
                </h2>

                <form class="space-y-4" onsubmit={handleChangePassword}>
                    <div class="form-control">
                        <label class="label p-1" for="currentPassword">
                            <span class="label-text font-bold opacity-70"
                                >Current Password</span
                            >
                        </label>
                        <input
                            id="currentPassword"
                            type="password"
                            bind:value={currentPassword}
                            class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div class="form-control">
                        <label class="label p-1" for="newPassword">
                            <span class="label-text font-bold opacity-70"
                                >New Password</span
                            >
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            bind:value={newPassword}
                            class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div class="form-control">
                        <label class="label p-1" for="confirmPassword">
                            <span class="label-text font-bold opacity-70"
                                >Confirm New Password</span
                            >
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            bind:value={confirmPassword}
                            class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div class="card-actions justify-end mt-4">
                        <button
                            class="btn btn-neutral font-bold"
                            type="submit"
                            disabled={loading}
                        >
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 2FA Settings -->
        <div
            class="card bg-base-100 shadow-sm border border-base-content/5 overflow-hidden lg:col-span-2"
        >
            <div class="card-body">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <h2 class="card-title text-xl font-bold">
                            Two-Factor Authentication
                        </h2>
                        <p class="text-sm opacity-60">
                            Add an extra layer of security to your account.
                        </p>
                    </div>
                    {#if $session.data?.user}
                        {@const user = $session.data.user}
                        <div
                            class="badge {(user as any).twoFactorEnabled
                                ? 'badge-success'
                                : 'badge-ghost'} font-bold"
                        >
                            {(user as any).twoFactorEnabled
                                ? "Enabled"
                                : "Disabled"}
                        </div>
                    {/if}
                </div>

                <div
                    class="flex items-center gap-4 p-4 rounded-2xl bg-base-200/30 border border-base-content/5"
                >
                    <div
                        class="size-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="size-6"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
                            />
                        </svg>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold">Authenticator App</h3>
                        <p class="text-xs opacity-50">
                            Use an app like Google Authenticator or Authy to get
                            verification codes.
                        </p>
                    </div>
                    {#if $session.data?.user}
                        {@const user = $session.data.user}
                        {#if (user as any).twoFactorEnabled}
                            <button
                                class="btn btn-outline btn-error btn-sm"
                                onclick={() =>
                                    alertRef.show(
                                        "Disable 2FA functionality coming soon",
                                        "info",
                                    )}
                            >
                                Disable
                            </button>
                        {:else}
                            <button
                                class="btn btn-primary btn-sm"
                                onclick={() =>
                                    alertRef.show(
                                        "Enable 2FA functionality coming soon",
                                        "info",
                                    )}
                            >
                                Enable
                            </button>
                        {/if}
                    {/if}
                </div>
            </div>
        </div>

        <!-- Watermark Settings -->
        <div class="card bg-base-100 shadow-sm border border-base-content/5 overflow-hidden lg:col-span-2">
            <div class="card-body bg-base-100">
                <h2 class="card-title text-xl font-bold mb-2">Watermark Configuration</h2>
                <p class="text-sm opacity-60 mb-6">Create and configure your custom Shutterstock-style diagonal repeating grid watermark.</p>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-base-100">
                    <!-- Left: Configuration Controls -->
                    <div class="space-y-6">
                        <!-- Watermark Type selector -->
                        <div class="form-control">
                            <div class="label p-1"><span class="label-text font-bold opacity-70">Watermark Mode</span></div>
                            <div class="flex gap-4">
                                <button
                                    type="button"
                                    class="flex-1 btn btn-outline rounded-2xl font-black {watermarkType === 'TEXT' ? 'btn-primary' : 'opacity-65'}"
                                    onclick={() => watermarkType = "TEXT"}
                                >
                                    Text Watermark
                                </button>
                                <button
                                    type="button"
                                    class="flex-1 btn btn-outline rounded-2xl font-black {watermarkType === 'IMAGE' ? 'btn-primary' : 'opacity-65'}"
                                    onclick={() => watermarkType = "IMAGE"}
                                >
                                    Logo Image Watermark
                                </button>
                            </div>
                        </div>

                        {#if watermarkType === 'TEXT'}
                            <!-- Watermark Text Input -->
                            <div class="form-control animate-in fade-in slide-in-from-top-2 duration-300">
                                <label class="label p-1" for="wm-text"><span class="label-text font-bold opacity-70">Watermark Text</span></label>
                                <input
                                    id="wm-text"
                                    type="text"
                                    bind:value={watermarkText}
                                    class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all font-bold"
                                    placeholder="e.g. Kirim Karya"
                                />
                            </div>
                        {:else}
                            <!-- Watermark Logo Upload -->
                            <div class="form-control animate-in fade-in slide-in-from-top-2 duration-300">
                                <div class="label p-1"><span class="label-text font-bold opacity-70">Watermark PNG Logo (Transparent background)</span></div>
                                <div class="flex items-center gap-6 p-4 bg-base-200/30 border border-dashed border-base-content/10 rounded-2xl">
                                    <div class="size-20 bg-base-300/40 rounded-xl flex items-center justify-center overflow-hidden border border-base-content/5 relative group">
                                        {#if watermarkImageUrl}
                                            <img src={watermarkImageUrl} alt="Logo Watermark" class="size-full object-contain p-2" />
                                        {:else}
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-8 opacity-25">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                            </svg>
                                        {/if}
                                    </div>
                                    <div class="flex-1 space-y-2">
                                        <input
                                            id="wm-image-input"
                                            type="file"
                                            accept="image/png"
                                            class="hidden"
                                            onchange={handleWatermarkLogoChange}
                                        />
                                        <label
                                            for="wm-image-input"
                                            class="btn btn-sm btn-outline rounded-xl font-bold cursor-pointer"
                                        >
                                            {#if logoUploading}
                                                <span class="loading loading-spinner loading-xs"></span>
                                                Uploading...
                                            {:else}
                                                Upload PNG Logo
                                            {/if}
                                        </label>
                                        <p class="text-[10px] opacity-40 font-bold uppercase">Supports transparent PNG only, max 2MB.</p>
                                    </div>
                                </div>
                            </div>
                        {/if}

                        <!-- Opacity Slider -->
                        <div class="form-control">
                            <div class="flex justify-between items-center p-1">
                                <span class="label-text font-bold opacity-70">Watermark Opacity</span>
                                <span class="badge badge-primary font-black">{watermarkOpacity}%</span>
                            </div>
                            <div class="flex items-center gap-4 bg-base-200/40 p-4 rounded-2xl border border-base-content/5 mt-2">
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    step="5"
                                    bind:value={watermarkOpacity}
                                    class="range range-primary range-sm flex-1"
                                />
                            </div>
                        </div>

                        <!-- Action buttons -->
                        <div class="flex flex-col sm:flex-row gap-4 pt-2">
                            <button
                                type="button"
                                class="flex-1 btn btn-primary rounded-2xl font-black h-14 shadow-xl shadow-primary/20 cursor-pointer text-sm"
                                onclick={handleSaveWatermarkSettings}
                                disabled={watermarkSaving || logoUploading || watermarkRegenerating}
                            >
                                {#if watermarkSaving}
                                    <span class="loading loading-spinner loading-xs"></span>
                                    Updating...
                                {:else}
                                    Save Watermark Settings
                                {/if}
                            </button>
                            <button
                                type="button"
                                class="flex-1 btn btn-outline btn-secondary rounded-2xl font-black h-14 cursor-pointer text-sm"
                                onclick={handleRegenerateWatermarks}
                                disabled={watermarkSaving || logoUploading || watermarkRegenerating}
                            >
                                {#if watermarkRegenerating}
                                    <span class="loading loading-spinner loading-xs"></span>
                                    Processing...
                                {:else}
                                    Apply to Existing Photos
                                {/if}
                            </button>
                        </div>
                    </div>

                    <!-- Right: Live Preview Panel -->
                    <div class="flex flex-col justify-between">
                                <div class="label p-1"><span class="label-text font-bold opacity-70">Interactive Real-Time Preview</span></div>
                        
                        <div class="relative w-full aspect-video rounded-3xl overflow-hidden border border-base-content/10 shadow-lg bg-base-300">
                            <!-- Premium generated photography background -->
                            <img
                                src="/images/watermark_preview_bg.png"
                                alt="Photography Preview Background"
                                class="size-full object-cover"
                            />

                            <!-- Real-time SVG Tiled Repeating Grid Watermark Overlay -->
                            <div
                                style="background-image: {previewSvgUrl};"
                                class="absolute inset-0 pointer-events-none transition-all duration-200"
                            ></div>

                            <!-- Live Tag -->
                            <div class="absolute top-4 left-4 badge badge-primary font-black uppercase text-[9px] tracking-wider py-2.5 px-3 backdrop-blur-md bg-primary/90 shadow-md">
                                Live Preview
                            </div>
                        </div>

                        <p class="text-xs opacity-50 mt-4 font-semibold text-center italic">
                            * This preview reflects how your custom Shutterstock-style watermark pattern tiles over uploaded photos in real-time.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Cropping Modal -->
{#if showCropper}
    <div class="modal modal-open px-4" transition:fade={{ duration: 200 }}>
        <div
            class="modal-box p-0 max-w-xl max-h-[90vh] flex flex-col overflow-hidden bg-base-100 border border-base-content/10 shadow-2xl rounded-3xl"
            transition:scale={{ duration: 200, start: 0.95 }}
        >
            <!-- Modal Header -->
            <div
                class="p-5 border-b border-base-content/5 flex items-center justify-between bg-base-100 mt-2"
            >
                <div>
                    <h3 class="font-black text-xl tracking-tight">
                        Crop Photo
                    </h3>
                    <p class="text-xs opacity-50 font-medium">
                        Adjust your photo to fit the square area.
                    </p>
                </div>
                <button
                    class="btn btn-sm btn-circle btn-ghost opacity-50 hover:opacity-100"
                    onclick={() => {
                        showCropper = false;
                        imageToCrop = undefined;
                    }}
                    aria-label="Close cropping modal"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="2.5"
                        stroke="currentColor"
                        class="size-5"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <!-- Cropper Area -->
            <div
                class="relative w-full aspect-square bg-neutral/80 overflow-hidden"
            >
                {#if imageToCrop}
                    <Cropper
                        image={imageToCrop}
                        bind:crop
                        bind:zoom
                        aspect={1}
                        oncropcomplete={onCropComplete}
                        restrictPosition={true}
                    />
                {/if}
            </div>

            <!-- Controls Area -->
            <div class="p-6 space-y-6">
                <!-- Zoom Control -->
                <div
                    class="flex items-center gap-4 bg-base-200/50 p-4 rounded-2xl border border-base-content/5"
                >
                    <button
                        class="btn btn-sm btn-ghost btn-circle btn-active"
                        onclick={() => (zoom = Math.max(1, zoom - 0.1))}
                        aria-label="Zoom out"
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
                                d="M19.5 12h-15"
                            />
                        </svg>
                    </button>

                    <div class="flex-1 flex flex-col gap-1">
                        <input
                            type="range"
                            min="1"
                            max="3"
                            step="0.01"
                            bind:value={zoom}
                            class="range range-primary range-xs"
                        />
                        <div
                            class="flex justify-between px-1 text-[10px] font-bold opacity-30 uppercase tracking-widest"
                        >
                            <span>Zoom Out</span>
                            <span>Zoom In</span>
                        </div>
                    </div>

                    <button
                        class="btn btn-sm btn-ghost btn-circle btn-active"
                        onclick={() => (zoom = Math.min(3, zoom + 0.1))}
                        aria-label="Zoom in"
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
                                d="M12 4.5v15m7.5-7.5h-15"
                            />
                        </svg>
                    </button>
                </div>

                <!-- Footer Action Buttons -->
                <div class="flex gap-3 pt-2">
                    <button
                        class="btn flex-1 bg-base-200 hover:bg-base-300 border-none font-bold rounded-2xl h-12"
                        onclick={() => {
                            showCropper = false;
                            imageToCrop = undefined;
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        class="btn flex-2 btn-primary font-bold shadow-lg shadow-primary/25 rounded-2xl h-12 text-base"
                        onclick={handleCropConfirm}
                    >
                        Save Selection
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
