<script lang="ts">
    import { getLocale, localizeUrl } from "../paraglide/runtime";
    import * as m from "../paraglide/messages";
    import { page } from "$app/state";

    const languages = [
        { code: "en", label: "English", flag: "🇺🇸", short: "EN" },
        { code: "id", label: "Indonesia", flag: "🇮🇩", short: "ID" },
    ] as const;

    function getLocalizedHref(lang: string) {
        return localizeUrl(page.url.href, { locale: lang as any }).toString();
    }

    const currentLang = $derived(
        languages.find((l) => l.code === getLocale()) || languages[0],
    );
</script>

<div class="dropdown dropdown-top dropdown-end w-full">
    <div
        tabindex="0"
        role="button"
        class="flex items-center justify-between w-full px-4 py-2 bg-base-100 border border-base-content/5 rounded-xl hover:border-primary/20 transition-all group"
    >
        <div class="flex items-center gap-3">
            <span class="text-base">{currentLang.flag}</span>
            <span
                class="text-xs font-black group-hover:text-primary transition-colors"
            >
                {currentLang.label}
            </span>
        </div>
        <svg
            xmlns="http://www.w3.org/2000/svg"
            class="size-3.5 opacity-40 group-hover:opacity-100 group-hover:text-primary transition-all"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
        </svg>
    </div>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <ul
        tabindex="0"
        class="dropdown-content z-20 menu p-2 shadow-2xl bg-base-100 border border-base-content/5 rounded-2xl w-full mb-2 animate-in slide-in-from-bottom-2 duration-200"
    >
        {#each languages as lang}
            <li>
                <a
                    href={getLocalizedHref(lang.code)}
                    data-sveltekit-reload
                    class="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-primary/5 hover:text-primary transition-all
                    {getLocale() === lang.code
                        ? 'bg-primary/10 text-primary font-bold'
                        : ''}"
                >
                    <div class="flex items-center gap-3">
                        <span class="text-base">{lang.flag}</span>
                        <span class="text-xs">{lang.label}</span>
                    </div>
                    {#if getLocale() === lang.code}
                        <div
                            class="size-1.5 rounded-full bg-primary animate-pulse"
                        ></div>
                    {/if}
                </a>
            </li>
        {/each}
    </ul>
</div>
