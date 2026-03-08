<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import Alert from "$lib/components/Alert.svelte";
    import { page } from "$app/stores";
    import { onMount } from "svelte";

    let password = $state("");
    let confirmPassword = $state("");
    let loading = $state(false);
    let alertRef: any;

    let token = $state("");

    onMount(() => {
        token = $page.url.searchParams.get("token") || "";
        if (!token) {
            alertRef?.show(
                "Token reset password tidak valid atau tidak ditemukan.",
                "error",
            );
        }
    });

    async function handleReset(e: SubmitEvent) {
        e.preventDefault();

        if (!token) {
            alertRef.show(
                "Token tidak valid. Silakan ulangi proses lupa password.",
                "error",
            );
            return;
        }

        if (password !== confirmPassword) {
            alertRef.show("Password konfirmasi tidak cocok.", "error");
            return;
        }

        loading = true;
        try {
            const { data, error } = await authClient.resetPassword({
                newPassword: password,
                token,
            });

            if (error) {
                alertRef.show(
                    "Gagal mengubah password: " + error.message,
                    "error",
                );
            } else {
                alertRef.show(
                    "Password berhasil diubah! Anda bisa login sekarang.",
                    "success",
                );
                setTimeout(() => {
                    window.location.href = "/login";
                }, 1500);
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
                Ubah Password
            </h1>
            <p class="text-base-content/60 font-medium">
                Silakan masukkan password baru untuk akun Anda.
            </p>
        </div>

        <form class="space-y-6" onsubmit={handleReset}>
            <Alert bind:this={alertRef} />

            <div class="form-control">
                <label class="label p-1" for="password">
                    <span class="label-text font-bold opacity-70"
                        >Password Baru</span
                    >
                </label>
                <input
                    id="password"
                    type="password"
                    bind:value={password}
                    placeholder="••••••••"
                    class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                    required
                    disabled={!token}
                />
            </div>

            <div class="form-control">
                <label class="label p-1" for="confirmPassword">
                    <span class="label-text font-bold opacity-70"
                        >Konfirmasi Password</span
                    >
                </label>
                <input
                    id="confirmPassword"
                    type="password"
                    bind:value={confirmPassword}
                    placeholder="••••••••"
                    class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                    required
                    disabled={!token}
                />
            </div>

            <button
                class="btn btn-primary btn-block rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                type="submit"
                disabled={loading || !token}
            >
                {#if loading}
                    <span class="loading loading-spinner"></span>
                {/if}
                {loading ? "Menyimpan..." : "Simpan Password Baru"}
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
