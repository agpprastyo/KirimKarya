<script lang="ts">
    import { requestPasswordReset } from "$lib/auth-client";
    import Alert from "$lib/components/Alert.svelte";

    let email = $state("");
    let loading = $state(false);
    let alertRef: any;

    async function handleForgot(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        try {
            const { data, error } = await requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) {
                alertRef.show("Gagal mengirim link: " + error.message, "error");
            } else {
                alertRef.show(
                    "Link reset password telah dikirim ke email Anda. Silakan cek inbox atau spam.",
                    "success",
                );
            }
        } finally {
            loading = false;
        }
    }
</script>

<div
    class="card bg-base-100/40 backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-2xl p-4"
>
    <div class="card-body">
        <div class="mb-8 text-center">
            <h1
                class="text-4xl font-black tracking-tight mb-2 text-base-content"
            >
                Lupa Password?
            </h1>
            <p class="text-base-content/60 font-medium">
                Masukkan email untuk reset password Anda.
            </p>
        </div>

        <form class="space-y-6" onsubmit={handleForgot}>
            <Alert bind:this={alertRef} />

            <div class="form-control">
                <label class="label p-1" for="email">
                    <span class="label-text font-bold opacity-70"
                        >Email Address</span
                    >
                </label>
                <input
                    id="email"
                    type="email"
                    bind:value={email}
                    placeholder="studio@example.com"
                    class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                    required
                />
            </div>

            <button
                class="btn btn-primary btn-block rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                type="submit"
                disabled={loading}
            >
                {#if loading}
                    <span class="loading loading-spinner"></span>
                {/if}
                {loading ? "Mengirim..." : "Kirim Link Reset"}
            </button>

            <a
                href="/login"
                class="btn btn-ghost btn-block rounded-xl border-base-content/5 transition-all font-bold opacity-60"
            >
                Kembali ke Login
            </a>
        </form>
    </div>
</div>
