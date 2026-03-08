<script lang="ts">
    import { useSession, authClient } from "$lib/auth-client";
    import Avatar from "$lib/components/Avatar.svelte";
    import ImageUpload from "$lib/components/ImageUpload.svelte";
    import * as m from "$lib/paraglide/messages.js";
    import { onMount } from "svelte";

    const session = useSession();

    let name = "";
    let email = "";
    let image = "";

    let currentPassword = "";
    let newPassword = "";
    let confirmPassword = "";

    let isUpdatingProfile = false;
    let isChangingPassword = false;

    let profileMessage = { type: "" as "success" | "error" | "", text: "" };
    let passwordMessage = { type: "" as "success" | "error" | "", text: "" };

    $: if ($session.data?.user) {
        name = $session.data.user.name || "";
        email = $session.data.user.email || "";
        image = $session.data.user.image || "";
    }

    async function handleUpdateProfile() {
        isUpdatingProfile = true;
        profileMessage = { type: "", text: "" };

        const { error } = await authClient.updateUser({
            name,
            image,
        });

        if (error) {
            profileMessage = {
                type: "error",
                text: error.message || m.failed_update_profile(),
            };
        } else {
            profileMessage = {
                type: "success",
                text: m.profile_updated(),
            };
        }
        isUpdatingProfile = false;
    }

    async function handleChangePassword() {
        if (newPassword !== confirmPassword) {
            passwordMessage = { type: "error", text: m.passwords_not_match() };
            return;
        }

        isChangingPassword = true;
        passwordMessage = { type: "", text: "" };

        const { error } = await authClient.changePassword({
            newPassword,
            currentPassword,
            revokeOtherSessions: true,
        });

        if (error) {
            passwordMessage = {
                type: "error",
                text: error.message || m.failed_change_password(),
            };
        } else {
            passwordMessage = {
                type: "success",
                text: m.password_changed(),
            };
            currentPassword = "";
            newPassword = "";
            confirmPassword = "";
        }
        isChangingPassword = false;
    }
</script>

<div class=" space-y-12 animate-in fade-in duration-1000">
    <!-- Clean Header -->
    <div class="space-y-1">
        <h1 class="text-2xl font-bold tracking-tight">
            {m.account_settings()}
        </h1>
        <p class="text-base text-base-content/60">
            {m.account_settings_desc()}
        </p>
    </div>

    <!-- Bento Grid Container -->
    <div class="bento-grid">
        <!-- Profile Card (Span 2x2) -->
        <div
            class="bg-base-100 border border-base-content/5 rounded-xl relative overflow-hidden transition-all duration-500 hover:border-primary/20 hover:-translate-y-1 hover:shadow md:col-span-2 md:row-span-1 group"
        >
            <div
                class="absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            ></div>

            <div
                class="relative z-10 flex flex-col items-center text-center space-y-8 h-full justify-center p-10"
            >
                <div class="relative">
                    <div
                        class="relative bg-base-100 rounded-xl border border-base-content/5"
                    >
                        <Avatar
                            src={image}
                            {name}
                            size="xxl"
                            ring={false}
                            shape="square"
                        />
                    </div>
                </div>

                <div class="space-y-2">
                    <h2 class="text-3xl font-black tracking-tight">
                        {$session.data?.user?.name || "Admin"}
                    </h2>
                    <p
                        class="text-base-content/40 font-bold uppercase tracking-[0.2em] text-xs"
                    >
                        Security Clearance: {$session.data?.user?.role ||
                            "Admin"}
                    </p>
                </div>

                <div class="flex gap-4">
                    <div
                        class="px-6 py-2 bg-success/10 text-success rounded-xl text-xs font-black uppercase tracking-widest border border-success/20"
                    >
                        Active
                    </div>
                    <div
                        class="px-6 py-2 bg-info/10 text-info rounded-xl text-xs font-black uppercase tracking-widest border border-info/20"
                    >
                        Verified
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Info Tile (Span 1x1) -->
        <div
            class="bg-base-100 border border-base-content/5 rounded-xl relative overflow-hidden transition-all duration-500 hover:border-primary/20 hover:-translate-y-1 hover:shadow p-8 flex flex-col justify-between"
        >
            <div
                class="p-3 bg-primary/10 text-primary w-fit rounded-xl shadow-inner"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
            </div>
            <div class="space-y-1">
                <p
                    class="text-[10px] font-black uppercase tracking-widest opacity-40"
                >
                    Member Since
                </p>
                <p class="text-xl font-black">
                    {new Date(
                        $session.data?.user?.createdAt || Date.now(),
                    ).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                    })}
                </p>
            </div>
        </div>

        <!-- Notification/Alert Status (Span 1x1) -->
        <div
            class="bg-base-100 border border-base-content/5 rounded-xl transition-all duration-500 hover:border-primary/20 hover:-translate-y-1 hover:shadow p-8 flex flex-col justify-between overflow-hidden relative"
        >
            <div class="absolute top-0 right-0 p-4 opacity-5">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-32 h-32"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                    /></svg
                >
            </div>
            <div class="p-3 bg-secondary/10 text-secondary w-fit rounded-xl">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2.5"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                </svg>
            </div>
            <div class="space-y-1">
                <p
                    class="text-[10px] font-black uppercase tracking-widest opacity-40"
                >
                    System Alerts
                </p>
                <p class="text-xl font-black">0 New</p>
            </div>
        </div>

        <!-- General Settings Form (Span 2x2 or 4x2 on Large) -->
        <div
            class="bg-base-100 border border-base-content/5 rounded-xl relative transition-all duration-500 hover:border-primary/20 hover:-translate-y-1 hover:shadow md:col-span-2 md:row-span-2 overflow-hidden flex flex-col"
        >
            <div
                class="p-8 border-b border-base-content/5 bg-base-200/20 flex items-center justify-between"
            >
                <div class="flex items-center gap-4">
                    <div class="p-3 bg-primary/5 text-primary rounded-xl">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2.5"
                                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                            />
                        </svg>
                    </div>
                    <h3 class="text-xl font-black tracking-tight">
                        Personal Identity
                    </h3>
                </div>
            </div>
            <div class="p-8 space-y-8 flex-1 flex flex-col">
                {#if profileMessage.text}
                    <div
                        class="alert alert-{profileMessage.type} rounded-xl border-none animate-in zoom-in duration-300"
                    >
                        <span class="font-black text-sm"
                            >{profileMessage.text}</span
                        >
                    </div>
                {/if}

                <div class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div class="form-control w-full group">
                            <label class="label px-1 py-3" for="name">
                                <span
                                    class="label-text font-black text-[10px] uppercase tracking-[0.2em] opacity-30 group-focus-within:opacity-100 transition-opacity"
                                    >Full Identity</span
                                >
                            </label>
                            <input
                                type="text"
                                id="name"
                                class="w-full h-16 px-6 font-bold bg-base-200/40 border-2 border-transparent rounded-xl transition-all outline-hidden focus:bg-base-100 focus:border-primary focus:shadow-[0_0_0_6px_rgba(var(--p),0.1)]"
                                bind:value={name}
                            />
                        </div>
                        <div class="form-control w-full group opacity-60">
                            <label class="label px-1 py-3" for="email">
                                <span
                                    class="label-text font-black text-[10px] uppercase tracking-[0.2em] opacity-30"
                                    >Email Address</span
                                >
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                disabled
                                class="w-full h-16 px-6 font-bold border-2 border-transparent rounded-xl transition-all outline-hidden focus:bg-base-100 focus:border-primary focus:shadow-[0_0_0_6px_rgba(var(--p),0.1)] opacity-60 bg-base-200/50 cursor-not-allowed"
                            />
                        </div>
                    </div>

                    <ImageUpload
                        label="Avatar Source"
                        bind:value={image}
                        on:change={(e) => (image = e.detail)}
                    />
                </div>

                <div class="pt-6 flex justify-end mt-auto">
                    <button
                        class="btn btn-primary btn-lg rounded-xl px-12 font-black shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all text-sm tracking-widest uppercase"
                        on:click={handleUpdateProfile}
                        disabled={isUpdatingProfile}
                    >
                        {#if isUpdatingProfile}
                            <span class="loading loading-spinner loading-md"
                            ></span>
                        {/if}
                        Sync Data
                    </button>
                </div>
            </div>
        </div>

        <!-- Security Credentials (Span 2x2 or 4x2 on Large) -->
        <div
            class="bg-base-100 border border-base-content/5 rounded-xl relative overflow-hidden transition-all duration-500 hover:border-primary/20 hover:-translate-y-1 hover:shadow md:col-span-2 md:row-span-2 flex flex-col"
        >
            <div
                class="p-8 border-b border-base-content/5 bg-base-200/20 flex items-center justify-between"
            >
                <div class="flex items-center gap-4">
                    <div class="p-3 bg-secondary/5 text-secondary rounded-xl">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="w-6 h-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2.5"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                        </svg>
                    </div>
                    <h3 class="text-xl font-black tracking-tight">
                        Cryptographic Security
                    </h3>
                </div>
            </div>
            <div class="p-8 space-y-8 flex-1 flex flex-col">
                {#if passwordMessage.text}
                    <div
                        class="alert alert-{passwordMessage.type} rounded-xl border-none animate-in zoom-in duration-300"
                    >
                        <span class="font-black text-sm"
                            >{passwordMessage.text}</span
                        >
                    </div>
                {/if}

                <div class="space-y-6">
                    <div class="form-control w-full group">
                        <label class="label px-1 py-3" for="current-password">
                            <span
                                class="label-text font-black text-[10px] uppercase tracking-[0.2em] opacity-30 group-focus-within:opacity-100 transition-opacity"
                                >Current Protocol</span
                            >
                        </label>
                        <input
                            type="password"
                            id="current-password"
                            placeholder="Current Password"
                            class="w-full h-16 px-6 font-bold bg-base-200/40 border-2 border-transparent rounded-xl transition-all outline-hidden focus:bg-base-100 focus:border-primary focus:shadow-[0_0_0_6px_rgba(var(--p),0.1)]"
                            bind:value={currentPassword}
                        />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="form-control w-full group">
                            <label class="label px-1 py-3" for="new-password">
                                <span
                                    class="label-text font-black text-[10px] uppercase tracking-[0.2em] opacity-30 group-focus-within:opacity-100 transition-opacity"
                                    >New Hash</span
                                >
                            </label>
                            <input
                                type="password"
                                id="new-password"
                                placeholder="New Password"
                                class="w-full h-16 px-6 font-bold bg-base-200/40 border-2 border-transparent rounded-xl transition-all outline-hidden focus:bg-base-100 focus:border-primary focus:shadow-[0_0_0_6px_rgba(var(--p),0.1)]"
                                bind:value={newPassword}
                            />
                        </div>
                        <div class="form-control w-full group">
                            <label
                                class="label px-1 py-3"
                                for="confirm-password"
                            >
                                <span
                                    class="label-text font-black text-[10px] uppercase tracking-[0.2em] opacity-30 group-focus-within:opacity-100 transition-opacity"
                                    >Confirm Hash</span
                                >
                            </label>
                            <input
                                type="password"
                                id="confirm-password"
                                placeholder="Repeat Password"
                                class="w-full h-16 px-6 font-bold bg-base-200/40 border-2 border-transparent rounded-xl transition-all outline-hidden focus:bg-base-100 focus:border-primary focus:shadow-[0_0_0_6px_rgba(var(--p),0.1)]"
                                bind:value={confirmPassword}
                            />
                        </div>
                    </div>
                </div>

                <div class="pt-6 flex justify-end mt-auto">
                    <button
                        class="btn btn-secondary btn-lg rounded-xl px-12 font-black shadow-secondary/20 hover:scale-[1.05] active:scale-95 transition-all text-sm tracking-widest uppercase"
                        on:click={handleChangePassword}
                        disabled={isChangingPassword}
                    >
                        {#if isChangingPassword}
                            <span class="loading loading-spinner loading-md"
                            ></span>
                        {/if}
                        Hardening
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    /* Bento Grid Core */
    .bento-grid {
        display: grid;
        grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 1rem;
    }

    @media (min-width: 768px) {
        .bento-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
        }
    }

    @media (min-width: 1280px) {
        .bento-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 1rem;
        }
    }
</style>
