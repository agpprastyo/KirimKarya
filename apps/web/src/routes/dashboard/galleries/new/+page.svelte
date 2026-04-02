<script lang="ts">
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";
    import { createMutation, useQueryClient } from "@tanstack/svelte-query";

    const queryClient = useQueryClient();

    let title = $state("");
    let clientEmail = $state("");
    let error = $state("");

    const createGalleryMutation = createMutation(() => ({
        mutationFn: async () => {
            const res = await api.api.galleries.$post({
                json: {
                    title,
                    clientEmail: clientEmail || undefined,
                },
            });

            if (!res.ok) {
                const err = (await res.json()) as any;
                throw new Error(err.message || "Failed to create gallery");
            }
            const json = await res.json();
            return json.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["galleries", "list"] });
            goto(`/dashboard/galleries/${data.id}`);
        },
        onError: (e: Error) => {
            error = e.message;
        }
    }));

    function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        error = "";
        createGalleryMutation.mutate();
    }
</script>

<div class="max-w-2xl mx-auto py-12">
    <div class="mb-12">
        <a
            href="/dashboard/galleries"
            class="inline-flex items-center gap-2 text-sm font-bold text-base-content/50 hover:text-primary transition-colors mb-4 group"
        >
            <svg
                class="w-4 h-4 group-hover:-translate-x-1 transition-transform"
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
            Back to Galleries
        </a>
        <h1 class="text-4xl font-black tracking-tight">Create New Gallery</h1>
        <p class="text-base-content/60 mt-2">
            Start a new project by defining its basic information.
        </p>
    </div>

    <form
        onsubmit={handleSubmit}
        class="card bg-base-100 shadow-xl border border-base-content/5 p-8 space-y-6"
    >
        {#if error}
            <div class="alert alert-error font-bold text-sm rounded-2xl">
                {error}
            </div>
        {/if}

        <div class="form-control w-full">
            <label class="label" for="title">
                <span class="label-text font-bold">Gallery Title</span>
            </label>
            <input
                type="text"
                id="title"
                bind:value={title}
                placeholder="e.g. Wedding of Sarah & James"
                class="input input-bordered w-full rounded-2xl bg-base-200/50 border-none font-medium h-14"
                required
            />
        </div>

        <div class="form-control w-full">
            <label class="label" for="email">
                <span class="label-text font-bold">Client Email (Optional)</span
                >
            </label>
            <input
                type="email"
                id="email"
                bind:value={clientEmail}
                placeholder="client@example.com"
                aria-describedby="email-description"
                class="input input-bordered w-full rounded-2xl bg-base-200/50 border-none font-medium h-14"
            />
            <div id="email-description" class="label">
                <span class="label-text-alt opacity-50 font-medium"
                    >We'll use this to notify your client when the gallery is
                    ready.</span
                >
            </div>
        </div>

        <div class="pt-6">
            <button
                type="submit"
                disabled={createGalleryMutation.isPending}
                class="btn btn-primary w-full rounded-2xl h-14 font-black shadow-lg shadow-primary/20"
            >
                {#if createGalleryMutation.isPending}
                    <span class="loading loading-spinner"></span>
                    Creating...
                {:else}
                    Create Gallery
                {/if}
            </button>
        </div>
    </form>
</div>
