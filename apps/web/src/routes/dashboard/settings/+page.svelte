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
                            class="size-24 rounded-full ring-4 ring-primary/10 overflow-hidden bg-base-300"
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
                        </div>

                        <label
                            class="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all border-none"
                            for="avatar-input"
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
                    <div
                        class="badge {$session.data?.user?.twoFactorEnabled
                            ? 'badge-success'
                            : 'badge-ghost'} font-bold"
                    >
                        {$session.data?.user?.twoFactorEnabled
                            ? "Enabled"
                            : "Disabled"}
                    </div>
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
                    {#if $session.data?.user?.twoFactorEnabled}
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
