<script lang="ts">
    import { useSession } from "$lib/auth-client";
    const session = useSession();
</script>

<section
    class="container mx-auto px-4 pt-18 pb-32 min-h-[85vh] flex flex-col lg:flex-row items-center gap-16 max-w-7xl"
>
    <!-- Left Content -->
    <div class="flex-1 text-left">
        <h1
            class="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-8 text-base-content"
        >
            Redefine <span class="text-primary italic">Gallery</span>
            <br />
            Management.
        </h1>
        <p
            class="text-xl opacity-60 max-w-lg mb-12 leading-relaxed font-medium"
        >
            The all-in-one studio platform that simplifies your workflow, from
            instant uploads to pixel-perfect client proofing.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 mb-16">
            {#if $session.data}
                <a
                    href={$session.data.user.role === "admin"
                        ? "/admin"
                        : "/dashboard"}
                    class="btn btn-primary btn-lg rounded-xl px-10 font-black h-16 shadow-xl shadow-primary/30 hover:scale-105 transition-all"
                >
                    Open Dashboard
                </a>
            {:else}
                <a
                    href="/register"
                    class="btn btn-primary btn-lg rounded-xl px-10 font-black h-16 shadow-xl shadow-primary/30 hover:scale-105 transition-all"
                >
                    Get Started
                </a>
            {/if}
            <a
                href="#how-it-works"
                class="btn btn-ghost btn-lg rounded-xl px-10 font-bold h-16 border border-base-content/10"
            >
                View Demo
            </a>
            <div class="flex items-center gap-3 px-4">
                <div class="avatar-group -space-x-4 rtl:space-x-reverse">
                    <div class="avatar border-2 border-base-100 w-10">
                        <div class="bg-neutral text-neutral-content">
                            <img
                                src="https://i.pravatar.cc/100?u=1"
                                alt="user"
                            />
                        </div>
                    </div>
                    <div class="avatar border-2 border-base-100 w-10">
                        <div class="bg-neutral text-neutral-content">
                            <img
                                src="https://i.pravatar.cc/100?u=2"
                                alt="user"
                            />
                        </div>
                    </div>
                    <div class="avatar border-2 border-base-100 w-10">
                        <div class="bg-neutral text-neutral-content">
                            <img
                                src="https://i.pravatar.cc/100?u=3"
                                alt="user"
                            />
                        </div>
                    </div>
                </div>
                <span class="text-sm font-bold opacity-60"
                    >Loved by 1k+ Studios</span
                >
            </div>
        </div>
    </div>

    <!-- Right Content: Orbital Visual -->
    <div
        class="flex-1 relative w-full max-w-[600px] aspect-square flex items-center justify-center mt-12 lg:mt-0"
    >
        <!-- Orbital Rings -->
        <div
            class="absolute inset-0 border border-base-content/5 rounded-xl animate-[spin_60s_linear_infinite]"
        ></div>
        <div
            class="absolute inset-[15%] border border-base-content/10 rounded-xl animate-[spin_40s_linear_infinite_reverse]"
        ></div>
        <div
            class="absolute inset-[30%] border border-base-content/5 rounded-xl animate-[spin_30s_linear_infinite]"
        ></div>

        <!-- Central Node -->
        <div
            class="relative z-10 w-48 h-48 rounded-xl bg-base-100/40 backdrop-blur-2xl border border-white/20 dark:border-white/5 flex flex-col items-center justify-center shadow-[0_0_50px_-12px_rgba(var(--p),0.3)] group hover:scale-110 transition-transform"
        >
            <span class="text-5xl font-black text-base-content mb-1">10k+</span>
            <span class="text-xs font-bold uppercase tracking-widest opacity-50"
                >Artworks</span
            >
        </div>

        <!-- Orbiting Elements (Nodes) -->
        <!-- Top Left -->
        <div
            class="absolute top-[10%] left-[15%] w-14 h-14 rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/20 animate-bounce"
            style="animation-duration: 4s;"
        >
            <img
                src="https://i.pravatar.cc/150?u=4"
                alt="user"
                class="w-full h-full object-cover"
            />
        </div>
        <!-- Bottom Right -->
        <div
            class="absolute bottom-[10%] right-[15%] w-16 h-16 rounded-xl overflow-hidden border-2 border-secondary/50 shadow-lg shadow-secondary/20 animate-bounce"
            style="animation-duration: 5s; animation-delay: 1s;"
        >
            <img
                src="https://i.pravatar.cc/150?u=5"
                alt="user"
                class="w-full h-full object-cover"
            />
        </div>
        <!-- Top Right -->
        <div
            class="absolute top-[20%] right-[5%] w-12 h-12 rounded-xl bg-black/80 flex items-center justify-center text-white border border-white/20 shadow-2xl rotate-12 animate-pulse"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-6 h-6"
                ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                /></svg
            >
        </div>
        <!-- Left -->
        <div
            class="absolute left-[5%] top-1/2 -translate-y-1/2 w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-content border border-white/20 shadow-2xl -rotate-12 animate-pulse"
            style="animation-delay: 1.5s;"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="w-8 h-8"
                ><path
                    d="M11.644 1.59a.75.75 0 01.712 0l9.75 5.25a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.712 0l-9.75-5.25a.75.75 0 010-1.32l9.75-5.25z"
                /><path
                    d="M3.265 10.602l7.668 4.129a1.25 1.25 0 001.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.712 0l-9.75-5.25a.75.75 0 010-1.32l1.372-.738z"
                /><path
                    d="M3.265 14.352l7.668 4.129 a1.25 1.25 0 001.134 0l7.668-4.13 1.37.739a.75.75 0 010 1.32l-9.75 5.25a.75.75 0 01-.712 0l-9.75-5.25a.75.75 0 010-1.32l1.372-.738z"
                /></svg
            >
        </div>
    </div>
</section>
