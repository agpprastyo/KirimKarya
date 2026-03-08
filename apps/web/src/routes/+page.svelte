<script lang="ts">
    import MeshBackground from "$lib/components/MeshBackground.svelte";
    import Navbar from "$lib/components/Navbar.svelte";
    import Hero from "$lib/components/Hero.svelte";
    import Partners from "$lib/components/Partners.svelte";
    import Features from "$lib/components/Features.svelte";
    import Pricing from "$lib/components/Pricing.svelte";
    import CTA from "$lib/components/CTA.svelte";
    import Footer from "$lib/components/Footer.svelte";
</script>

<div
    class="min-h-screen relative flex flex-col font-sans selection:bg-primary selection:text-primary-content overflow-x-hidden bg-base-100"
>
    <MeshBackground />

    <Navbar />

    <main class="relative z-10 grow">
        <Hero />
        <Partners />
        <Features />
        <Pricing />
        <CTA />
    </main>

    <Footer />
</div>

<style>
    :global(html) {
        scroll-behavior: smooth;
    }
</style>
