<script lang="ts">
    export let stats = {
        users: 0,
        admins: 0,
        banned: 0,
    };
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div
        class="card bg-base-100 border border-base-content/5 p-6 relative z-10"
    >
        <div class="space-y-2">
            <span
                class="badge badge-sm badge-outline opacity-50 font-bold uppercase tracking-widest text-[10px]"
            >
                Total Users
            </span>
            <div class="text-3xl font-bold tabular-nums">
                {stats.users}
            </div>
            <p class="text-xs font-medium opacity-50">Registered accounts</p>
        </div>
    </div>

    <div
        class="card bg-base-100 border border-base-content/5 p-6 relative z-10"
    >
        <div class="space-y-2">
            <span
                class="badge badge-sm badge-outline opacity-50 font-bold uppercase tracking-widest text-[10px]"
            >
                Admins
            </span>
            <div class="text-3xl font-bold tabular-nums text-secondary">
                {stats.admins}
            </div>
            <p class="text-xs font-medium opacity-50">Privileged users</p>
        </div>
    </div>

    <div
        class="card bg-base-100 border border-base-content/5 p-6 relative z-10"
    >
        <div class="space-y-2">
            <span
                class="badge badge-sm badge-outline opacity-50 font-bold uppercase tracking-widest text-[10px]"
            >
                Banned
            </span>
            <div class="text-3xl font-bold tabular-nums text-error">
                {stats.banned}
            </div>
            <p class="text-xs font-medium opacity-50">Restricted accounts</p>
        </div>
    </div>
</div>
