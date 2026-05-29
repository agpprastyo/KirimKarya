<script lang="ts">
    import { api } from "$lib/api";
    import { goto } from "$app/navigation";
    import { createMutation, useQueryClient } from "@tanstack/svelte-query";

    const queryClient = useQueryClient();

    let title = $state("");
    let emails = $state<string[]>([""]);
    let error = $state("");

    const createGalleryMutation = createMutation(() => ({
        mutationFn: async () => {
            const cleanEmails = emails.map(e => e.trim()).filter(e => e.length > 0).join(", ");
            if (!cleanEmails) {
                throw new Error("At least one client email is required");
            }

            const res = await api.api.galleries.$post({
                json: {
                    title,
                    clientEmail: cleanEmails,
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
            <div role="alert" class="alert alert-error alert-soft font-bold text-sm rounded-2xl flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
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

        <div class="form-control w-full space-y-3">
            <label class="label pb-0" for="email-0">
                <span class="label-text font-bold">Client Email(s) <span class="text-error">*</span></span>
            </label>
            
            <div class="space-y-3">
                {#each emails as email, i}
                    <div class="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div class="relative flex-1">
                            <input
                                type="email"
                                id="email-{i}"
                                bind:value={emails[i]}
                                placeholder="client-{i + 1}@example.com"
                                class="input input-bordered w-full rounded-2xl bg-base-200/50 border-none font-medium h-14 pl-12"
                                required
                            />
                            <div class="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                </svg>
                            </div>
                        </div>

                        {#if emails.length > 1}
                            <button
                                type="button"
                                onclick={() => {
                                    emails = emails.filter((_, idx) => idx !== i);
                                }}
                                class="btn btn-error btn-circle btn-soft shrink-0"
                                aria-label="Delete email field"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>

            <button
                type="button"
                onclick={() => {
                    emails = [...emails, ""];
                }}
                class="btn btn-ghost btn-sm text-primary font-bold hover:bg-primary/10 rounded-xl gap-2 mt-2 w-fit justify-start pl-3"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="size-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Another Client Email
            </button>

            <p class="text-xs opacity-50 font-medium leading-relaxed mt-2 block select-none">
                Enter emails of all clients who will access this gallery. Each client will receive their own secure access code via OTP magic link.
            </p>
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
