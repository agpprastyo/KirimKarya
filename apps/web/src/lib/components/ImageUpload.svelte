<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Cropper from "svelte-easy-crop";
    import type { OnCropCompleteEvent } from "svelte-easy-crop";

    export let value = "";
    export let label = "Avatar Source";
    export let placeholder = "https://images.unsplash.com/...";
    export let disabled = false;

    const dispatch = createEventDispatcher<{
        change: string;
        uploading: boolean;
    }>();

    let fileInput: HTMLInputElement;
    let uploading = false;
    let error = "";

    // Cropping state
    let imageFile: string | null = null;
    let crop = { x: 0, y: 0 };
    let zoom = 1;
    let pixelCrop: any = null;
    let showCropper = false;

    // Portal action to move modal to body
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            },
        };
    }

    function onFileSelected(e: CustomEvent | Event) {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageFile = e.target?.result as string;
                showCropper = true;
            };
            reader.readAsDataURL(file);
        }
    }

    // Fixed signature for svelte-easy-crop v5
    function onCropComplete(event: OnCropCompleteEvent) {
        if (event && event.pixels) {
            pixelCrop = event.pixels;
        }
    }

    async function handleUpload() {
        if (!imageFile || !pixelCrop) {
            error = "Please adjust the crop first";
            return;
        }

        uploading = true;
        error = "";
        showCropper = false;
        dispatch("uploading", true);

        try {
            const croppedImage = await getCroppedImg(imageFile, pixelCrop);
            const formData = new FormData();
            formData.append("file", croppedImage, "avatar.webp");

            const response = await fetch("/api/auth/upload-avatar", {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            const result = await response.json();

            if (response.ok && result.data?.url) {
                value = result.data.url;
                dispatch("change", value);
            } else {
                error = result.message || "Upload failed";
            }
        } catch (e) {
            console.error("Upload error:", e);
            error = "Connection error";
        } finally {
            uploading = false;
            dispatch("uploading", false);
            imageFile = null;
        }
    }

    async function getCroppedImg(
        imageSrc: string,
        pixelCrop: any,
    ): Promise<Blob> {
        const image = new Image();
        image.src = imageSrc;
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });

        const canvas = document.createElement("canvas");
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) throw new Error("Could not get canvas context");

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height,
        );

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                },
                "image/webp",
                0.9,
            );
        });
    }
</script>

<div class="form-control w-full group">
    <label class="label px-1 py-3" for="image-upload">
        <span
            class="label-text font-black text-[10px] uppercase tracking-[0.2em] opacity-30 group-focus-within:opacity-100 transition-opacity"
        >
            {label}
        </span>
    </label>

    <div class="flex items-center gap-4">
        <div class="relative flex-1 min-w-0">
            <input
                type="url"
                {placeholder}
                class="w-full h-16 px-6 font-bold bg-base-200/40 border-2 border-transparent rounded-xl transition-all outline-hidden focus:bg-base-100 focus:border-primary focus:shadow-[0_0_0_6px_rgba(var(--p),0.1)] {error
                    ? 'border-error/50'
                    : ''}"
                bind:value
                {disabled}
                on:input={() => dispatch("change", value)}
            />
        </div>

        <button
            type="button"
            class="h-16 px-8 min-w-[140px] rounded-xl bg-primary text-primary-content font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-primary/20"
            on:click={() => fileInput.click()}
            disabled={uploading || disabled}
        >
            {#if uploading}
                <span class="loading loading-spinner loading-xs"></span>
                <span>UPLOADING</span>
            {:else}
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
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                </svg>
                <span>UPLOAD</span>
            {/if}
        </button>
    </div>

    {#if error}
        <p
            class="mt-2 px-4 text-[10px] font-bold text-error uppercase tracking-wider"
        >
            {error}
        </p>
    {/if}

    <input
        type="file"
        class="hidden"
        accept="image/*"
        bind:this={fileInput}
        on:change={onFileSelected}
    />
</div>

<!-- Cropper Modal with Portal Fix -->
{#if showCropper && imageFile}
    <div
        use:portal
        class="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
    >
        <div
            class="bg-base-100 w-full max-w-xl rounded-xl overflow-hidden flex flex-col items-center shadow-2xl relative"
        >
            <!-- Header -->
            <div
                class="p-8 border-b border-base-content/5 w-full flex justify-between items-center bg-base-100 z-10"
            >
                <h3 class="text-xl font-black tracking-tight uppercase">
                    Crop Avatar
                </h3>
                <button
                    class="btn btn-ghost btn-circle"
                    on:click={() => (showCropper = false)}
                    title="Close"
                    aria-label="Close"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <!-- Cropper Area -->
            <div
                class="relative w-full aspect-square bg-base-300 overflow-hidden"
            >
                <Cropper
                    image={imageFile}
                    bind:crop
                    bind:zoom
                    aspect={1}
                    oncropcomplete={onCropComplete}
                />
            </div>

            <!-- Footer Controls -->
            <div class="p-8 w-full space-y-6 bg-base-100 z-10">
                <div class="flex items-center gap-4">
                    <span
                        class="text-xs font-black uppercase tracking-widest opacity-40"
                        >Zoom</span
                    >
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        bind:value={zoom}
                        class="range range-primary range-sm"
                    />
                </div>

                <div class="flex gap-4">
                    <button
                        class="btn btn-ghost flex-1 rounded-xl font-black h-14"
                        on:click={() => (showCropper = false)}>Cancel</button
                    >
                    <button
                        class="btn btn-primary flex-1 rounded-xl font-black h-14 shadow-lg shadow-primary/20"
                        on:click={handleUpload}>Confirm & Upload</button
                    >
                </div>
            </div>
        </div>
    </div>
{/if}
