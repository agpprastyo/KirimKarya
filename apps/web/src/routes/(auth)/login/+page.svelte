<script lang="ts">
    import { signIn } from "$lib/auth-client";
    import Alert from "$lib/components/Alert.svelte";

    let email = $state("");
    let password = $state("");
    let loading = $state(false);

    let alertRef: any;

    async function handleLogin(e: SubmitEvent) {
        e.preventDefault();
        loading = true;
        try {
            const { data, error } = await signIn.email({
                email,
                password,
            });

            if (error) {
                alertRef.show("Login failed: " + error.message, "error");
            } else {
                alertRef.show("Login successful! Welcome back.", "success");
                setTimeout(() => {
                    window.location.href = "/dashboard";
                }, 1000);
            }
        } finally {
            loading = false;
        }
    }

    async function loginWithGoogle() {
        loading = true;
        try {
            await signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
            });
        } catch (err: any) {
            console.error("Login with Google failed:", err);
            alertRef.show("Login with Google failed: " + err.message, "error");
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
                Welcome back.
            </h1>
            <p class="text-base-content/60 font-medium">
                Log in to manage your studio.
            </p>
        </div>

        <form class="space-y-6" onsubmit={handleLogin}>
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

            <div class="form-control">
                <label class="label p-1" for="password">
                    <span class="label-text font-bold opacity-70">Password</span
                    >
                </label>
                <input
                    id="password"
                    type="password"
                    bind:value={password}
                    placeholder="••••••••"
                    class="input input-bordered w-full bg-base-200/50 border-base-content/10 focus:border-primary transition-all"
                    required
                />
                <div class="flex justify-end mt-1 px-1">
                    <a
                        href="/forgot-password"
                        class="text-xs link link-hover opacity-50 font-bold"
                        >Forgot Password?</a
                    >
                </div>
            </div>

            <button
                class="btn btn-primary btn-block rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                type="submit"
                disabled={loading}
            >
                {#if loading}
                    <span class="loading loading-spinner"></span>
                {/if}
                {loading ? "Logging in..." : "Login"}
            </button>

            <div
                class="divider text-xs opacity-30 font-bold uppercase tracking-widest"
            >
                OR
            </div>

            <button
                type="button"
                class="btn btn-outline btn-block rounded-xl border-base-content/10 hover:bg-base-content/5 hover:border-base-content/20 transition-all font-bold"
                onclick={loginWithGoogle}
                disabled={loading}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    class="w-5 h-5 mr-3"
                >
                    <path
                        d="M22.56 12.251c0-.78-.07-1.53-.2-2.251H12v4.25h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.08z"
                        fill="#4285F4"
                    />
                    <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                    />
                    <path
                        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                        fill="#FBBC05"
                    />
                    <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        fill="#EA4335"
                    />
                </svg>
                Continue with Google
            </button>

            <p class="text-sm text-center opacity-60 font-medium">
                Don't have an account? <a
                    href="/register"
                    class="text-primary font-bold hover:underline">Create one</a
                >
            </p>
        </form>
    </div>
</div>
