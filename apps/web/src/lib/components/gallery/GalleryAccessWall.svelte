<script lang="ts">
    import { Motion } from "svelte-motion";
    import Icon from "../icons/Icon.svelte";


    interface Props {
        gallery: { accessMode: "OTP" | "PASSWORD"; title?: string } | null;
        onOTPSuccess: () => void;
        onPasswordSuccess: () => void;
        requestAccessFn: (email: string) => Promise<{ success: boolean; error?: string }>;
        verifyOTPFn: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
        verifyPasswordFn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    }

    let { gallery, requestAccessFn, verifyOTPFn, verifyPasswordFn, onOTPSuccess, onPasswordSuccess }: Props = $props();

    let email = $state("");
    let otp = $state("");
    let password = $state("");
    let step = $state<"email" | "otp" | "password">("email");
    let error = $state("");
    let isVerifying = $state(false);

    async function requestAccess() {
        error = "";
        isVerifying = true;
        try {
            if (gallery?.accessMode === "PASSWORD") {
                if (email.includes("@")) {
                    step = "password";
                } else {
                    error = "Please enter a valid email address.";
                }
            } else {
                const result = await requestAccessFn(email);
                if (result.success) {
                    step = "otp";
                } else {
                    error = result.error || "Email not authorized for this gallery.";
                }
            }
        } catch {
            error = "Something went wrong. Please try again.";
        } finally {
            isVerifying = false;
        }
    }

    async function verifyOTP() {
        error = "";
        isVerifying = true;
        try {
            const result = await verifyOTPFn(email, otp);
            if (result.success) {
                onOTPSuccess();
            } else {
                error = result.error || "Invalid or expired code";
            }
        } catch {
            error = "Verification failed. Please try again.";
        } finally {
            isVerifying = false;
        }
    }

    async function verifyPassword() {
        error = "";
        isVerifying = true;
        try {
            const result = await verifyPasswordFn(email, password);
            if (result.success) {
                onPasswordSuccess();
            } else {
                error = result.error || "Incorrect password or unauthorized email";
            }
        } catch {
            error = "Verification failed. Please try again.";
        } finally {
            isVerifying = false;
        }
    }
</script>

<div class="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center">
    <Motion initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div class="max-w-md w-full space-y-8">
            <div class="space-y-2">
                <div class="inline-flex items-center justify-center p-4 bg-primary/10 text-primary rounded-3xl mb-4">
                    <Icon name="lock" class="size-8" />
                </div>
                <h2 class="text-4xl font-black tracking-tight">Private Gallery</h2>
                <p class="text-base-content/40 font-medium italic">This gallery is protected. Please verify your email to continue.</p>
            </div>

            <div class="bg-base-200/50 p-8 rounded-4xl border border-base-content/5 space-y-6">
                {#if error}
                    <div class="alert alert-error text-xs font-bold rounded-2xl">{error}</div>
                {/if}

                {#if step === "email"}
                    <div class="form-control w-full space-y-2">
                        <label class="label p-0" for="access-email">
                            <span class="label-text font-black uppercase text-[10px] opacity-40 ml-1">Your Email Address</span>
                        </label>
                        <input id="access-email" type="email" bind:value={email} placeholder="your@email.com"
                            class="input input-lg bg-base-100 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        <button class="btn btn-primary btn-lg w-full rounded-2xl font-black h-16 shadow-xl shadow-primary/20"
                            onclick={requestAccess} disabled={isVerifying || !email.includes("@")}>
                            {#if isVerifying}<span class="loading loading-spinner"></span>
                            {:else}{gallery?.accessMode === "PASSWORD" ? "Continue" : "Request Access"}{/if}
                        </button>
                    </div>
                {:else if step === "otp"}
                    <div class="form-control w-full space-y-4">
                        <div class="space-y-1">
                            <label class="label p-0" for="access-otp">
                                <span class="label-text font-black uppercase text-[10px] opacity-40 ml-1">Verification Code</span>
                            </label>
                            <input id="access-otp" type="text" bind:value={otp} placeholder="------" maxlength="6"
                                class="input input-lg bg-base-100 rounded-2xl font-black text-center tracking-[0.5em] text-2xl border-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <p class="text-[10px] font-bold opacity-40 uppercase">Code sent to {email}</p>
                        <button class="btn btn-primary btn-lg w-full rounded-2xl font-black h-16 shadow-xl shadow-primary/20"
                            onclick={verifyOTP} disabled={isVerifying || otp.length < 6}>
                            {#if isVerifying}<span class="loading loading-spinner"></span>
                            {:else}Verify & Enter{/if}
                        </button>
                        <button class="btn btn-ghost btn-sm font-black opacity-40 hover:opacity-100" onclick={() => (step = "email")}>Change Email</button>
                    </div>
                {:else if step === "password"}
                    <div class="form-control w-full space-y-4">
                        <div class="space-y-1">
                            <label class="label p-0" for="access-password">
                                <span class="label-text font-black uppercase text-[10px] opacity-40 ml-1">Gallery Password</span>
                            </label>
                            <input id="access-password" type="password" bind:value={password} placeholder="••••••••"
                                class="input input-lg bg-base-100 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary/20 transition-all" />
                        </div>
                        <p class="text-[10px] font-bold opacity-40 uppercase">Access for {email}</p>
                        <button class="btn btn-primary btn-lg w-full rounded-2xl font-black h-16 shadow-xl shadow-primary/20"
                            onclick={verifyPassword} disabled={isVerifying || password.length < 1}>
                            {#if isVerifying}<span class="loading loading-spinner"></span>
                            {:else}Unlock Gallery{/if}
                        </button>
                        <button class="btn btn-ghost btn-sm font-black opacity-40 hover:opacity-100" onclick={() => (step = "email")}>Change Email</button>
                    </div>
                {/if}
            </div>
            <a href="/" class="btn btn-ghost btn-sm font-bold opacity-30">Back Home</a>
        </div>
    </Motion>
</div>
