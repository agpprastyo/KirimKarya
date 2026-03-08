<script lang="ts">
    export let src: string | null | undefined = undefined;
    export let name: string = "User";
    export let size: "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | number = "md";
    export let online: boolean = false;
    export let ring: boolean = true;
    export let shape: "circle" | "square" = "circle";

    const sizeMap: Record<string, string> = {
        xs: "w-6 h-6",
        sm: "w-8 h-8",
        md: "w-10 h-10",
        lg: "w-12 h-12",
        xl: "w-16 h-16",
        xxl: "w-24 h-24",
    };

    $: sizeClass =
        typeof size === "number"
            ? `w-${size} h-${size}`
            : sizeMap[size] || sizeMap["md"];
    $: initials = name ? name[0].toUpperCase() : "U";
    $: roundedClass = shape === "circle" ? "rounded-full" : "rounded-lg";
</script>

<div
    class="avatar {online ? 'avatar-online' : ''} {src
        ? ''
        : 'avatar-placeholder'}"
>
    <div
        class="{sizeClass} {roundedClass} {ring
            ? 'ring ring-primary/20 ring-offset-base-100 ring-offset-2'
            : ''} {src ? '' : 'bg-primary text-primary-content'}"
    >
        {#if src}
            <img {src} alt={name} />
        {:else}
            <span class="{size === 'xs' ? 'text-[10px]' : 'text-xs'} font-bold"
                >{initials}</span
            >
        {/if}
    </div>
</div>
