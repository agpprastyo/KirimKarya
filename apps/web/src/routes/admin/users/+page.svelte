<script lang="ts">
    import { authClient } from "$lib/auth-client";
    import { onMount } from "svelte";
    import Avatar from "$lib/components/Avatar.svelte";

    let users: any[] = [];
    let totalUsers = 0;
    let loading = true;
    let searchValue = "";
    let limit = 10;
    let offset = 0;

    async function fetchUsers() {
        loading = true;
        try {
            const res = await authClient.admin.listUsers({
                query: {
                    limit,
                    offset,
                    searchValue,
                    searchField: "name",
                },
            });
            if (res.data) {
                users = res.data.users;
                totalUsers = res.data.total;
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            loading = false;
        }
    }

    async function toggleBan(userId: string, isBanned: boolean) {
        try {
            if (isBanned) {
                await authClient.admin.unbanUser({ userId });
            } else {
                await authClient.admin.banUser({ userId });
            }
            await fetchUsers();
        } catch (error) {
            console.error("Error toggling ban:", error);
        }
    }

    onMount(fetchUsers);

    function handleSearch() {
        offset = 0;
        fetchUsers();
    }
</script>

<div class="space-y-4">
    <div
        class="flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
        <div class="space-y-1">
            <h1 class="text-2xl font-bold tracking-tight">User Management</h1>
            <p class="text-base text-base-content/60">
                Manage your platform users, roles, and access.
            </p>
        </div>

        <div class="join">
            <input
                type="text"
                placeholder="Search users..."
                class="input input-bordered join-item w-full md:w-64 font-medium"
                bind:value={searchValue}
                on:keydown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
                class="btn btn-primary join-item px-6"
                on:click={handleSearch}
                aria-label="Search users"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.5"
                    stroke="currentColor"
                    class="w-5 h-5"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                </svg>
            </button>
        </div>
    </div>

    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
            class="stats bg-base-100 shadow-md border border-base-content/5 relative z-10"
        >
            <div class="stat">
                <div class="stat-title font-bold text-xs uppercase opacity-50">
                    Total Users
                </div>
                <div class="stat-value text-primary">{totalUsers}</div>
            </div>
        </div>
        <div
            class="stats bg-base-100 shadow-md border border-base-content/5 relative z-10"
        >
            <div class="stat">
                <div class="stat-title font-bold text-xs uppercase opacity-50">
                    Active Now
                </div>
                <div class="stat-value text-secondary">--</div>
            </div>
        </div>
        <div
            class="stats bg-base-100 shadow-md border border-base-content/5 relative z-10"
        >
            <div class="stat">
                <div class="stat-title font-bold text-xs uppercase opacity-50">
                    New Signups
                </div>
                <div class="stat-value text-accent">--</div>
            </div>
        </div>
    </div>

    <!-- Users Table -->
    <div
        class="card bg-base-100 shadow-md border border-base-content/5 overflow-hidden relative z-10"
    >
        <div class="overflow-x-auto">
            <table class="table table-lg">
                <thead class="bg-base-200">
                    <tr
                        class="text-base-content/50 font-bold uppercase text-xs border-none"
                    >
                        <th>User</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#if loading}
                        {#each Array(5) as _}
                            <tr class="animate-pulse">
                                <td class="flex items-center gap-4">
                                    <div
                                        class="w-12 h-12 rounded-xl bg-base-300"
                                    ></div>
                                    <div class="space-y-2">
                                        <div
                                            class="h-4 w-32 bg-base-300 rounded"
                                        ></div>
                                        <div
                                            class="h-3 w-24 bg-base-300 rounded"
                                        ></div>
                                    </div>
                                </td>
                                <td
                                    ><div
                                        class="h-6 w-16 bg-base-300 rounded-xl"
                                    ></div></td
                                >
                                <td
                                    ><div
                                        class="h-6 w-16 bg-base-300 rounded-xl"
                                    ></div></td
                                >
                                <td
                                    ><div
                                        class="h-4 w-24 bg-base-300 rounded"
                                    ></div></td
                                >
                                <td class="text-right"
                                    ><div
                                        class="h-10 w-24 bg-base-300 rounded-xl ml-auto"
                                    ></div></td
                                >
                            </tr>
                        {/each}
                    {:else if users.length === 0}
                        <tr>
                            <td
                                colspan="5"
                                class="text-center py-20 opacity-50 font-medium"
                                >No users found.</td
                            >
                        </tr>
                    {:else}
                        {#each users as user}
                            <tr class="hover:bg-base-200/30 transition-colors">
                                <td>
                                    <div class="flex items-center gap-4">
                                        <Avatar
                                            src={user.image}
                                            name={user.name}
                                            size="lg"
                                            ring={true}
                                        />
                                        <div>
                                            <div
                                                class="font-bold text-base-content"
                                            >
                                                {user.name}
                                            </div>
                                            <div
                                                class="text-xs opacity-50 font-medium"
                                            >
                                                {user.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <div
                                        class="badge {user.role === 'admin'
                                            ? 'badge-primary'
                                            : 'badge-ghost'} font-bold"
                                    >
                                        {user.role || "user"}
                                    </div>
                                </td>
                                <td>
                                    <div
                                        class="badge {user.banned
                                            ? 'badge-error'
                                            : 'badge-success'} badge-outline font-bold"
                                    >
                                        {user.banned ? "Banned" : "Active"}
                                    </div>
                                </td>
                                <td class="text-sm font-medium opacity-60">
                                    {new Date(
                                        user.createdAt,
                                    ).toLocaleDateString()}
                                </td>
                                <td class="text-right">
                                    <div class="dropdown dropdown-end">
                                        <div
                                            tabindex="0"
                                            role="button"
                                            class="btn btn-ghost btn-sm rounded-xl"
                                            aria-label="Open user actions menu"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke-width="2"
                                                stroke="currentColor"
                                                class="w-5 h-5"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"
                                                />
                                            </svg>
                                        </div>
                                        <ul
                                            class="dropdown-content z-1 menu p-2 shadow bg-base-100 rounded-xl w-52 border border-base-content/5 mt-2"
                                        >
                                            <li>
                                                <button
                                                    on:click={() =>
                                                        toggleBan(
                                                            user.id,
                                                            user.banned ||
                                                                false,
                                                        )}
                                                >
                                                    {user.banned
                                                        ? "Unban User"
                                                        : "Ban User"}
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    class="text-error"
                                                    on:click={() =>
                                                        alert(
                                                            "Delete feature soon...",
                                                        )}>Delete User</button
                                                >
                                            </li>
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div
            class="p-4 border-t border-base-content/5 flex items-center justify-between bg-base-200/20"
        >
            <span
                class="text-xs font-bold opacity-50 uppercase tracking-widest"
            >
                Showing {Math.min(offset + 1, totalUsers)} to {Math.min(
                    offset + limit,
                    totalUsers,
                )} of {totalUsers} users
            </span>
            <div class="join">
                <button
                    class="join-item btn btn-sm bg-base-100"
                    disabled={offset === 0}
                    on:click={() => {
                        offset -= limit;
                        fetchUsers();
                    }}>«</button
                >
                <button class="join-item btn btn-sm bg-base-100"
                    >Page {Math.floor(offset / limit) + 1}</button
                >
                <button
                    class="join-item btn btn-sm bg-base-100"
                    disabled={offset + limit >= totalUsers}
                    on:click={() => {
                        offset += limit;
                        fetchUsers();
                    }}>»</button
                >
            </div>
        </div>
    </div>
</div>
