<script lang="ts">
    export let systems = {
        auth: "...",
        db: "...",
        redis: "...",
        s3: "...",
    };
</script>

<div class="space-y-4">
    <h2 class="text-lg font-bold tracking-tight opacity-70">System Status</h2>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div
            class="card bg-base-100 border border-base-content/5 p-3 flex-row items-center gap-3 relative z-10"
        >
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4 opacity-40 shrink-0"
                >
                    <path
                        fill-rule="evenodd"
                        d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.749.749 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Zm3.094 8.08a.75.75 0 0 0-1.22-.87l-3.236 4.53-1.147-1.148a.75.75 0 1 0-1.06 1.061l1.75 1.75a.75.75 0 0 0 1.14-.094l3.773-5.277Z"
                        clip-rule="evenodd"
                    />
                </svg>
                <span class="font-bold opacity-60 text-xs truncate">Auth</span>
            </div>
            <span
                class="badge {systems.auth === 'READY'
                    ? 'badge-success'
                    : 'badge-error'} badge-sm font-black shrink-0"
                >{systems.auth}</span
            >
        </div>
        <div
            class="card bg-base-100 border border-base-content/5 p-3 flex-row items-center gap-3 relative z-10"
        >
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4 opacity-40 shrink-0"
                >
                    <path
                        d="M21 6.375c0 2.623-4.03 4.75-9 4.75s-9-2.127-9-4.75S7.03 1.625 12 1.625s9 2.127 9 4.75ZM3 10.875c0 2.623 4.03 4.75 12 4.75s9-2.127 9-4.75V15c0 2.623-4.03 4.75-9 4.75s-9-2.127-9-4.75v-4.125Z"
                    />
                    <path
                        d="M3 15.375c0 2.623 4.03 4.75 9 4.75s9-2.127 9-4.75V18c0 2.623-4.03 4.75-9 4.75s-9-2.127-9-4.75v-2.625Z"
                    />
                </svg>
                <span class="font-bold opacity-60 text-xs truncate">DB</span>
            </div>
            <span
                class="badge {systems.db === 'READY'
                    ? 'badge-success'
                    : 'badge-error'} badge-sm font-black shrink-0"
                >{systems.db}</span
            >
        </div>
        <div
            class="card bg-base-100 border border-base-content/5 p-3 flex-row items-center gap-3 relative z-10"
        >
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4 opacity-40 shrink-0"
                >
                    <path
                        fill-rule="evenodd"
                        d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143Z"
                        clip-rule="evenodd"
                    />
                </svg>
                <span class="font-bold opacity-60 text-xs truncate">RDS</span>
            </div>
            <span
                class="badge {systems.redis === 'READY'
                    ? 'badge-success'
                    : 'badge-error'} badge-sm font-black shrink-0"
                >{systems.redis}</span
            >
        </div>
        <div
            class="card bg-base-100 border border-base-content/5 p-3 flex-row items-center gap-3 relative z-10"
        >
            <div class="flex items-center gap-2 flex-1 min-w-0">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="w-4 h-4 opacity-40 shrink-0"
                >
                    <path
                        fill-rule="evenodd"
                        d="M4.5 9.75a6 6 0 0 1 11.573-2.226 3.75 3.75 0 0 1 4.133 4.303A4.5 4.5 0 0 1 18 20.25H6.75a5.25 5.25 0 0 1-2.23-10.004 6.072 6.072 0 0 1-.02-.496Z"
                        clip-rule="evenodd"
                    />
                </svg>
                <span class="font-bold opacity-60 text-xs truncate">S3</span>
            </div>
            <span
                class="badge {systems.s3 === 'READY'
                    ? 'badge-success'
                    : 'badge-error'} badge-sm font-black shrink-0"
                >{systems.s3}</span
            >
        </div>
    </div>
</div>
