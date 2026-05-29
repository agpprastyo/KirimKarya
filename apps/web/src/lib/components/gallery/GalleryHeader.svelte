<script lang="ts">
    import { Motion } from "svelte-motion";

    interface Props {
        gallery: {
            title: string;
            status: string;
            isPrivate: boolean;
            clientEmail?: string | null;
        };
        galleryId: string;
        copyShareLink: () => void;
        onOpenSettings: () => void;
        onPublish: () => void;
    }

    let { gallery, galleryId, copyShareLink, onOpenSettings, onPublish }: Props = $props();
</script>

<Motion
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
>
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
            <div class="flex flex-wrap items-center gap-3 mb-4">
                <a
                    href="/dashboard/galleries"
                    class="btn btn-ghost btn-sm rounded-xl px-2 opacity-50 hover:opacity-100"
                    aria-label="Back to Galleries"
                >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 19l-7-7 7-7"
                        />
                    </svg>
                </a>
                <span
                    class="badge badge-primary font-black text-[10px] tracking-widest uppercase px-2 py-0"
                    >{gallery.status}</span
                >
                {#if gallery.isPrivate}
                    <span
                        class="badge badge-secondary font-black text-[10px] tracking-widest uppercase px-2 py-0"
                        >Private</span
                    >
                {/if}
                <button
                    onclick={copyShareLink}
                    class="badge badge-outline font-black text-[10px] tracking-widest uppercase px-2 py-0 cursor-pointer hover:bg-base-content hover:text-base-100 transition-colors"
                >
                    Copy Share Link
                </button>
            </div>
            <h1
                class="text-4xl md:text-5xl font-black tracking-tight leading-tight"
            >
                {gallery.title}
            </h1>
            <p class="text-lg md:text-xl text-base-content/50 mt-2 font-medium">
                {gallery.clientEmail || "No client assigned"}
            </p>
        </div>

        <div class="flex gap-4">
            <button
                onclick={onOpenSettings}
                class="btn btn-ghost rounded-2xl font-black px-6 border border-base-content/10 cursor-pointer"
            >
                Settings
            </button>
            {#if gallery.status === "DRAFT"}
                <button
                    onclick={onPublish}
                    class="btn btn-primary rounded-2xl font-black px-8 shadow-xl shadow-primary/20 cursor-pointer"
                >
                    Publish Gallery
                </button>
            {:else}
                <a
                    href="/g/{galleryId}"
                    target="_blank"
                    class="btn btn-primary btn-outline rounded-2xl font-black px-8 cursor-pointer"
                >
                    View Live
                </a>
            {/if}
        </div>
    </div>
</Motion>
