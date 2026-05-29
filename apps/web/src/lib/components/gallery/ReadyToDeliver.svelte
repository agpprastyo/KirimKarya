<script lang="ts">
    interface Props {
        gallery: {
            selectionCount: number;
            deliveryStatus?: string | null;
        };
        deliverPending: boolean;
        onDeliver: () => void;
    }

    let { gallery, deliverPending, onDeliver }: Props = $props();
</script>

<div
    class="card bg-primary text-primary-content p-8 rounded-4xl shadow-2xl shadow-primary/30"
>
    <h3 class="text-xl font-black mb-2">Ready to Deliver?</h3>
    <p class="text-sm font-medium opacity-80 mb-6">
        Once the client has finished selecting ({gallery.selectionCount}
        photos), you can generate high-res downloads.
    </p>

    {#if gallery.deliveryStatus === "COMPLETED"}
        <div class="space-y-3">
            <div
                class="bg-white/10 p-4 rounded-2xl flex items-center justify-between"
            >
                <span
                    class="font-bold text-xs uppercase opacity-70"
                    >Status</span
                >
                <span
                    class="badge badge-success font-black text-[10px] uppercase"
                    >Ready</span
                >
            </div>
            <button
                onclick={onDeliver}
                class="btn btn-white w-full rounded-2xl font-black h-14 cursor-pointer"
                disabled={deliverPending}
            >
                {#if deliverPending}
                    <span
                        class="loading loading-spinner loading-xs"
                    ></span>
                {:else}
                    Regenerate ZIP
                {/if}
            </button>
            <p
                class="text-[10px] text-center opacity-70 font-bold uppercase italic"
            >
                * Regeneration will overwrite the previous ZIP.
            </p>
        </div>
    {:else if gallery.deliveryStatus === "QUEUED" || gallery.deliveryStatus === "PROCESSING"}
        <div
            class="bg-white/10 p-6 rounded-3xl text-center space-y-4"
        >
            <span class="loading loading-spinner loading-lg"
            ></span>
            <p
                class="font-black text-sm uppercase tracking-widest"
            >
                {gallery.deliveryStatus === "QUEUED"
                    ? "Waiting in Queue..."
                    : "Creating ZIP..."}
            </p>
            <p class="text-[10px] opacity-70">
                Please stay on this page or wait for the email
                notification.
            </p>
        </div>
    {:else}
        <button
            onclick={onDeliver}
            class="btn btn-white w-full rounded-2xl font-black h-14 cursor-pointer"
            disabled={deliverPending || gallery.selectionCount === 0}
        >
            {#if deliverPending}
                <span class="loading loading-spinner loading-xs"
                ></span>
            {:else}
                Start Delivery ({gallery.selectionCount} Selected)
            {/if}
        </button>
        {#if gallery.deliveryStatus === "FAILED"}
            <p
                class="text-xs text-error-content font-bold mt-2 text-center bg-error/20 py-2 rounded-lg"
            >
                Last attempt failed. Please try again.
            </p>
        {/if}
    {/if}
</div>
