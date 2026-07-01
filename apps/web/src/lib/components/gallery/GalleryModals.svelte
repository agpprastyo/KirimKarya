<script lang="ts">
    interface Gallery {
        title?: string;
        selectionLimit?: number;
        pricePerExtraPhoto?: number;
    }

    interface Props {
        gallery: Gallery | null;
        shortlistedCount: number;
        extraQuotaUnlocked: boolean;
        isFinalizeOpen: boolean;
        isPaywallOpen: boolean;
        isSubmitting: boolean;
        onConfirmFinalize: () => void;
        onCancelFinalize: () => void;
        onUnlockQuota: () => void;
        onClosePaywall: () => void;
    }

    let {
        gallery,
        shortlistedCount,
        extraQuotaUnlocked,
        isFinalizeOpen,
        isPaywallOpen,
        isSubmitting,
        onConfirmFinalize,
        onCancelFinalize,
        onUnlockQuota,
        onClosePaywall,
    }: Props = $props();

    const priceFormatted = $derived(
        new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
        }).format(gallery?.pricePerExtraPhoto || 0)
    );
</script>

{#if isFinalizeOpen}
    <div class="modal modal-open z-50">
        <div class="modal-box rounded-3xl max-w-md p-8 border border-base-content/5 bg-base-100 shadow-2xl animate-in zoom-in-95">
            <h3 class="text-2xl font-black mb-4">Send Selection?</h3>
            <p class="text-sm opacity-75 mb-6 leading-relaxed">
                Are you ready to submit your shortlisted selection of <strong class="text-primary">{shortlistedCount}</strong> photos
                to your photographer? This will notify them to start packaging your high-resolution original copies.
            </p>
            <div class="modal-action flex justify-end gap-3 mt-8">
                <button class="btn btn-ghost rounded-2xl font-black cursor-pointer" onclick={onCancelFinalize} disabled={isSubmitting}>
                    Cancel
                </button>
                <button class="btn btn-primary rounded-2xl font-black px-6 shadow-lg shadow-primary/20 cursor-pointer" onclick={onConfirmFinalize} disabled={isSubmitting}>
                    {#if isSubmitting}<span class="loading loading-spinner loading-xs"></span>
                    {:else}Submit Selection{/if}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if isPaywallOpen}
    <div class="modal modal-open z-50">
        <div class="modal-box rounded-3xl max-w-md p-8 border border-base-content/5 bg-base-100 shadow-2xl space-y-6 animate-in zoom-in-95">
            <div class="flex items-center justify-between">
                <span class="badge badge-secondary font-black text-[9px] tracking-widest uppercase px-2.5 py-1">Premium Upgrade</span>
                <button class="btn btn-sm btn-circle btn-ghost" onclick={onClosePaywall}>✕</button>
            </div>

            <div class="text-center space-y-2">
                <h3 class="text-3xl font-black tracking-tight leading-none">Extend Your Limit</h3>
                <p class="text-xs opacity-60 font-bold uppercase">Unlock selections beyond free limit</p>
            </div>

            <div class="bg-base-200/50 p-6 rounded-2xl text-center space-y-1">
                <span class="text-xs opacity-50 uppercase font-black">Price Per Extra Photo</span>
                <h4 class="text-2xl font-black text-primary">{priceFormatted}</h4>
                <p class="text-[10px] opacity-40 font-bold">Set by your photographer: {gallery?.title}</p>
            </div>

            <div class="space-y-4">
                <div class="form-control w-full space-y-1">
                    <span class="label-text font-black uppercase text-[9px] opacity-40 ml-1">Cardholder Name</span>
                    <input type="text" placeholder="John Doe" class="input input-bordered rounded-2xl font-bold bg-base-200/50" />
                </div>
                <div class="form-control w-full space-y-1">
                    <span class="label-text font-black uppercase text-[9px] opacity-40 ml-1">Card Details (Mockup)</span>
                    <div class="relative">
                        <input type="text" placeholder="4242 4242 4242 4242" class="input input-bordered w-full rounded-2xl font-bold bg-base-200/50 pr-20" />
                        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30 tracking-widest">MM/YY CVC</span>
                    </div>
                </div>
            </div>

            <div class="alert alert-info text-[10px] font-black rounded-2xl p-4 bg-info/10 text-info border-none">
                <span>🔒 Secure checkout powered by Stripe. You will be billed only for the excess selections you approve.</span>
            </div>

            <button onclick={onUnlockQuota} class="btn btn-primary btn-lg w-full rounded-2xl font-black shadow-xl shadow-primary/20 h-14">
                Pay & Unlock Extra Quota
            </button>
        </div>
    </div>
{/if}
