<script lang="ts">
    interface Props {
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        onCancel: () => void;
    }

    let { isOpen, title, message, onConfirm, onCancel }: Props = $props();
</script>

{#if isOpen}
    <div class="modal modal-open z-[9999] backdrop-blur-md">
        <div class="modal-box max-w-md rounded-3xl p-6 border border-base-content/5 shadow-2xl bg-base-100 animate-in fade-in zoom-in-95 duration-200">
            <h3 class="text-xl font-black text-base-content mb-2">{title}</h3>
            <p class="text-sm font-medium text-base-content/75 mb-6">{message}</p>
            <div class="modal-action flex justify-end gap-3">
                <button 
                    onclick={onCancel} 
                    class="btn btn-ghost rounded-2xl font-black px-6 border border-base-content/10 cursor-pointer"
                >
                    Cancel
                </button>
                <button 
                    onclick={onConfirm} 
                    class="btn btn-error rounded-2xl font-black px-6 shadow-lg shadow-error/20 cursor-pointer"
                >
                    Delete
                </button>
            </div>
        </div>
    </div>
{/if}
