<script lang="ts">
    interface Props {
        isOpen: boolean;
        editForm: {
            title: string;
            clientEmail: string;
            status: "DRAFT" | "PUBLISHED";
            isPrivate: boolean;
            accessMode: "OTP" | "PASSWORD";
            allowedEmails: string;
            password?: string;
            expiresAt: string;
            selectionLimit: number;
            pricePerExtraPhoto: number;
        };
        settingsError: string;
        savingPending: boolean;
        onSave: (notify: boolean) => void;
        onClose: () => void;
        onDelete?: () => void;
    }

    let { isOpen, editForm = $bindable(), settingsError, savingPending, onSave, onClose, onDelete }: Props = $props();
</script>

{#if isOpen}
    <div class="modal modal-open">
        <div
            class="modal-box max-w-2xl rounded-4xl p-8 border border-base-content/5 bg-base-100"
        >
            <h3 class="text-2xl font-black mb-6">Gallery Settings</h3>

            {#if settingsError}
                <div
                    class="alert alert-error mb-6 rounded-2xl text-xs font-bold"
                >
                    {settingsError}
                </div>
            {/if}

            <div class="space-y-6">
                <!-- Basic Info -->
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="form-control w-full">
                        <label class="label" for="gallery-title"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Gallery Title</span
                            ></label
                        >
                        <input
                            id="gallery-title"
                            type="text"
                            bind:value={editForm.title}
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                    <div class="form-control w-full">
                        <label class="label" for="client-email"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Client Emails (Comma separated)</span
                            ></label
                        >
                        <input
                            id="client-email"
                            type="text"
                            bind:value={editForm.clientEmail}
                            placeholder="client1@mail.com, client2@mail.com"
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                </div>

                <!-- Gallery Status -->
                <div class="bg-base-200/50 p-6 rounded-3xl space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-black text-sm">
                                Gallery Visibility
                            </div>
                            <div
                                class="text-[10px] opacity-40 font-bold uppercase"
                            >
                                {editForm.status === "PUBLISHED"
                                    ? "Visible to clients"
                                    : "Only you can see this"}
                            </div>
                        </div>
                        <div
                            class="join bg-base-100 p-1 rounded-2xl border border-base-content/5"
                        >
                            <button
                                class="join-item btn btn-sm rounded-xl font-black {editForm.status ===
                                'DRAFT'
                                    ? 'btn-primary'
                                    : 'btn-ghost'}"
                                onclick={() => (editForm.status = "DRAFT")}
                                >Draft</button
                            >
                            <button
                                class="join-item btn btn-sm rounded-xl font-black {editForm.status ===
                                'PUBLISHED'
                                    ? 'btn-primary'
                                    : 'btn-ghost'}"
                                onclick={() => (editForm.status = "PUBLISHED")}
                                >Publish</button
                            >
                        </div>
                    </div>
                </div>

                <div class="bg-base-200/50 p-6 rounded-3xl space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-black text-sm">
                                Private Access Protection
                            </div>
                            <div
                                class="text-[10px] opacity-40 font-bold uppercase"
                            >
                                Require identification to view gallery
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            bind:checked={editForm.isPrivate}
                            class="toggle toggle-primary"
                        />
                    </div>

                    {#if editForm.isPrivate}
                        <div
                            class="space-y-4 animate-in fade-in slide-in-from-top-2"
                        >
                            <div class="form-control w-full">
                                <div class="px-1 py-2">
                                    <span
                                        class="label-text font-black uppercase text-[10px] opacity-40"
                                        >Access Mode</span
                                    >
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <button
                                        class="btn btn-outline rounded-2xl font-black {editForm.accessMode ===
                                        'OTP'
                                            ? 'btn-primary'
                                            : 'opacity-50'}"
                                        onclick={() =>
                                            (editForm.accessMode = "OTP")}
                                    >
                                        One-Time Password (Email)
                                    </button>
                                    <button
                                        class="btn btn-outline rounded-2xl font-black {editForm.accessMode ===
                                        'PASSWORD'
                                            ? 'btn-primary'
                                            : 'opacity-50'}"
                                        onclick={() =>
                                            (editForm.accessMode = "PASSWORD")}
                                    >
                                        Shared Password
                                    </button>
                                </div>
                            </div>

                            {#if editForm.accessMode === "OTP"}
                                <div class="form-control w-full">
                                    <label class="label" for="allowed-emails"
                                        ><span
                                            class="label-text font-black uppercase text-[10px] opacity-40"
                                            >Allowed Guest Emails (Comma
                                            separated)</span
                                        ></label
                                    >
                                    <textarea
                                        id="allowed-emails"
                                        bind:value={editForm.allowedEmails}
                                        class="textarea textarea-bordered rounded-2xl font-bold h-24"
                                        placeholder="friend@mail.com, mom@mail.com"
                                    ></textarea>
                                </div>
                            {:else}
                                <div class="form-control w-full">
                                    <label class="label" for="access-password"
                                        ><span
                                            class="label-text font-black uppercase text-[10px] opacity-40"
                                            >Guest Password (Min 4 chars)</span
                                        ></label
                                    >
                                    <input
                                        id="access-password"
                                        type="password"
                                        bind:value={editForm.password}
                                        placeholder="Keep empty to leave unchanged"
                                        class="input input-bordered rounded-2xl font-bold"
                                    />
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <div class="form-control w-full">
                        <label class="label" for="expiry-date"
                            ><span
                                class="label-text font-black uppercase text-[10px] opacity-40"
                                >Expiry Date (Optional)</span
                            ></label
                        >
                        <input
                            id="expiry-date"
                            type="date"
                            bind:value={editForm.expiresAt}
                            class="input input-bordered rounded-2xl font-bold"
                        />
                    </div>
                </div>

                <!-- Selection Quota & Price Settings -->
                <div class="bg-base-200/50 p-6 rounded-3xl space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-black text-sm">
                                Limit Client Selections
                            </div>
                            <div class="text-[10px] opacity-40 font-bold uppercase">
                                Enforce selection count limits for client shortlists
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={editForm.selectionLimit > 0}
                            onchange={(e) => {
                                const target = e.target as HTMLInputElement;
                                editForm.selectionLimit = target.checked ? 30 : 0;
                            }}
                            class="toggle toggle-secondary"
                        />
                    </div>

                    {#if editForm.selectionLimit > 0}
                        <div class="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div class="form-control w-full">
                                <label class="label" for="selection-limit">
                                    <span class="label-text font-black uppercase text-[10px] opacity-40">
                                        Free Selection Quota (Photos)
                                    </span>
                                </label>
                                <input
                                    id="selection-limit"
                                    type="number"
                                    min="1"
                                    bind:value={editForm.selectionLimit}
                                    class="input input-bordered rounded-2xl font-bold"
                                />
                            </div>
                            <div class="form-control w-full">
                                <label class="label" for="price-per-extra">
                                    <span class="label-text font-black uppercase text-[10px] opacity-40">
                                        Price Per Extra Photo (IDR)
                                    </span>
                                </label>
                                <input
                                    id="price-per-extra"
                                    type="number"
                                    min="0"
                                    bind:value={editForm.pricePerExtraPhoto}
                                    class="input input-bordered rounded-2xl font-bold"
                                    placeholder="e.g. 25000"
                                />
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="modal-action flex justify-between mt-10">
                <div class="flex gap-2">
                    <button
                        class="btn btn-ghost rounded-2xl font-black hover:bg-base-content/10 cursor-pointer"
                        onclick={onClose}>Cancel</button
                    >
                    {#if onDelete}
                        <button
                            class="btn btn-ghost rounded-2xl font-black text-error hover:bg-error/10 cursor-pointer"
                            onclick={onDelete}>Delete Gallery</button
                        >
                    {/if}
                </div>
                <div class="flex gap-3">
                    <button
                        onclick={() => onSave(false)}
                        disabled={savingPending}
                        class="btn btn-ghost border border-base-content/10 rounded-2xl font-black px-6 cursor-pointer"
                    >
                        {#if savingPending}
                            <span class="loading loading-spinner loading-xs"
                            ></span>
                        {:else}
                            Save Only
                        {/if}
                    </button>
                    <button
                        onclick={() => onSave(true)}
                        disabled={savingPending}
                        class="btn btn-primary rounded-2xl font-black px-10 shadow-xl shadow-primary/20 cursor-pointer"
                    >
                        {#if savingPending}
                            <span class="loading loading-spinner loading-xs"
                            ></span>
                        {:else}
                            Save & Notify Clients
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
