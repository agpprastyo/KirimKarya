<script lang="ts">
    import { api as apiClient } from "$lib/api";
    import { onMount } from "svelte";

    interface QueueStat {
        name: string;
        active: number;
        waiting: number;
        delayed: number;
        failed: number;
        completed: number;
    }

    interface FailedJob {
        id: string;
        name: string;
        queueName: string;
        data: any;
        failedReason: string | null;
        stacktrace: string[] | null;
        timestamp: number;
    }

    let queues = $state<QueueStat[]>([]);
    let failedJobs = $state<FailedJob[]>([]);
    let loading = $state(true);

    // Toast Alert
    let toastMessage = $state("");
    let toastType = $state<"success" | "error" | "info">("info");
    let showToast = $state(false);

    // Filter failed jobs by queue
    let selectedQueueFilter = $state("ALL");

    // Modal state for viewing full stack trace
    let activeTraceJob = $state<FailedJob | null>(null);
    let isTraceModalOpen = $state(false);

    function triggerToast(message: string, type: "success" | "error" | "info" = "success") {
        toastMessage = message;
        toastType = type;
        showToast = true;
        setTimeout(() => {
            showToast = false;
        }, 3000);
    }

    async function fetchJobsOverview() {
        loading = true;
        try {
            const res = await apiClient.api.admin.jobs.status.$get();
            if (res.ok) {
                const responseData = await res.json();
                if (responseData.data) {
                    queues = responseData.data.queues;
                    failedJobs = responseData.data.failedJobs;
                }
            } else {
                triggerToast("Failed to fetch BullMQ queue metrics.", "error");
            }
        } catch (error) {
            console.error("Failed to load background job statuses:", error);
            triggerToast("Network error fetching background workers status.", "error");
        } finally {
            loading = false;
        }
    }

    async function retrySingleJob(queueName: string, jobId: string) {
        try {
            const res = await apiClient.api.admin.jobs[":queue"][":id"].retry.$post({
                param: { queue: queueName, id: jobId },
            });

            if (res.ok) {
                triggerToast(`Job #${jobId} successfully re-queued for execution!`, "success");
                await fetchJobsOverview();
            } else {
                triggerToast("Failed to schedule job retry.", "error");
            }
        } catch (error) {
            console.error("Job retry failed:", error);
            triggerToast("Error triggering job retry.", "error");
        }
    }

    async function retryAllFailed(queueName: string) {
        try {
            const res = await apiClient.api.admin.jobs[":queue"]["retry-all"].$post({
                param: { queue: queueName },
            });

            if (res.ok) {
                const resJson = await res.json();
                const count = resJson.data?.count || 0;
                triggerToast(`Successfully re-queued ${count} failed jobs in "${queueName}"!`, "success");
                await fetchJobsOverview();
            } else {
                triggerToast("Failed to retry all jobs in queue.", "error");
            }
        } catch (error) {
            console.error("Batch retry failed:", error);
            triggerToast("Error rescheduling queue jobs.", "error");
        }
    }

    async function removeSingleJob(queueName: string, jobId: string) {
        try {
            const res = await apiClient.api.admin.jobs[":queue"][":id"].$delete({
                param: { queue: queueName, id: jobId },
            });

            if (res.ok) {
                triggerToast(`Job #${jobId} successfully removed from queue.`, "success");
                await fetchJobsOverview();
            } else {
                triggerToast("Failed to discard job.", "error");
            }
        } catch (error) {
            console.error("Job removal failed:", error);
            triggerToast("Error purging specific job record.", "error");
        }
    }

    async function purgeAllFailed(queueName: string) {
        try {
            const res = await apiClient.api.admin.jobs[":queue"]["purge-failed"].$delete({
                param: { queue: queueName },
            });

            if (res.ok) {
                const resJson = await res.json();
                const count = resJson.data?.count || 0;
                triggerToast(`Successfully purged all ${count} failed jobs from "${queueName}"!`, "success");
                await fetchJobsOverview();
            } else {
                triggerToast("Failed to clear queue errors.", "error");
            }
        } catch (error) {
            console.error("Batch purge failed:", error);
            triggerToast("Error clearing failed queue lists.", "error");
        }
    }

    onMount(fetchJobsOverview);

    // Derived statistics calculations
    let totalActive = $derived(queues.reduce((sum, q) => sum + q.active, 0));
    let totalFailed = $derived(queues.reduce((sum, q) => sum + q.failed, 0));
    let totalWaiting = $derived(queues.reduce((sum, q) => sum + q.waiting, 0));

    // Filtered failed jobs list
    let filteredFailedJobs = $derived(
        selectedQueueFilter === "ALL"
            ? failedJobs
            : failedJobs.filter(j => j.queueName === selectedQueueFilter)
    );

    function formatTime(timestamp: number) {
        const d = new Date(timestamp);
        return d.toLocaleTimeString("en-US", { hour12: false }) + " (" + d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ")";
    }

    function viewStackTrace(job: FailedJob) {
        activeTraceJob = job;
        isTraceModalOpen = true;
    }
</script>

<div class="space-y-8 pb-12">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-base-content/5 pb-6">
        <div class="space-y-1">
            <h1 class="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Background Task Diagnostics
            </h1>
            <p class="text-sm text-base-content/60 font-medium">
                Monitor asynchronous BullMQ queues, inspect resizing/watermarking failures, audit stack traces, and manage retry pipelines.
            </p>
        </div>
        
        <button
            class="btn btn-outline hover:btn-primary gap-2 rounded-xl font-bold shadow-sm relative z-10"
            onclick={fetchJobsOverview}
            disabled={loading}
        >
            {#if loading}
                <span class="loading loading-spinner loading-xs"></span>
            {:else}
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
            {/if}
            Refresh System Status
        </button>
    </div>

    <!-- Overview Counters -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Active Workers Counter -->
        <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden shadow-sm">
            <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-widest opacity-50">Active Processes</span>
                <span class="relative flex h-2 w-2">
                    {#if totalActive > 0}
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    {:else}
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-base-content/30"></span>
                    {/if}
                </span>
            </div>
            <div class="text-3xl font-black mt-2 tabular-nums {totalActive > 0 ? 'text-primary' : 'text-base-content'}">
                {totalActive}
            </div>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-1">Jobs currently running in workers</p>
        </div>

        <!-- Waiting Queue Counter -->
        <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden shadow-sm">
            <span class="text-xs font-black uppercase tracking-widest opacity-50">Waiting in Line</span>
            <div class="text-3xl font-black mt-2 text-secondary tabular-nums">
                {totalWaiting}
            </div>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-1">Pending resources waiting in queue</p>
        </div>

        <!-- Failed Pipeline Counter -->
        <div class="card bg-base-100 border border-base-content/5 p-6 rounded-3xl relative overflow-hidden shadow-sm">
            <span class="text-xs font-black uppercase tracking-widest opacity-50">Failures Logged</span>
            <div class="text-3xl font-black mt-2 {totalFailed > 0 ? 'text-error animate-pulse' : 'text-success'} tabular-nums">
                {totalFailed}
            </div>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-1">Failed watermark/processing tasks</p>
        </div>
    </div>

    <!-- BullMQ Queues Inspector Cards -->
    <div class="space-y-4">
        <h2 class="text-lg font-black tracking-tight text-base-content/75 uppercase tracking-wider">Queue Health Grid</h2>
        
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {#if loading && queues.length === 0}
                {#each Array(4) as _}
                    <div class="h-44 bg-base-200 animate-pulse rounded-3xl"></div>
                {/each}
            {:else}
                {#each queues as q}
                    <div class="card bg-base-100 border border-base-content/5 rounded-3xl p-6 relative overflow-hidden z-10 shadow-sm flex flex-col justify-between">
                        <!-- Card Header -->
                        <div class="flex items-center justify-between border-b border-base-content/5 pb-4 mb-4">
                            <div>
                                <h3 class="font-black text-md text-base-content tracking-tight">{q.name}</h3>
                                <p class="text-[10px] text-base-content/40 font-mono">Queue Name: {q.name}</p>
                            </div>

                            <div class="flex gap-2">
                                <button
                                    class="btn btn-xs btn-ghost hover:btn-primary font-extrabold uppercase text-[9px]"
                                    onclick={() => retryAllFailed(q.name)}
                                    disabled={q.failed === 0}
                                >
                                    Retry All Failed
                                </button>
                                <button
                                    class="btn btn-xs btn-ghost hover:btn-error text-error/70 hover:text-error font-extrabold uppercase text-[9px]"
                                    onclick={() => purgeAllFailed(q.name)}
                                    disabled={q.failed === 0}
                                >
                                    Purge Failed
                                </button>
                            </div>
                        </div>

                        <!-- Statistics Indicators -->
                        <div class="grid grid-cols-5 gap-2 text-center">
                            <!-- Active -->
                            <div class="p-2.5 rounded-2xl bg-primary/5 border border-primary/10">
                                <span class="text-[9px] font-bold tracking-widest uppercase opacity-40 block">Active</span>
                                <span class="text-lg font-black text-primary tabular-nums block mt-1">{q.active}</span>
                            </div>
                            <!-- Waiting -->
                            <div class="p-2.5 rounded-2xl bg-secondary/5 border border-secondary/10">
                                <span class="text-[9px] font-bold tracking-widest uppercase opacity-40 block">Wait</span>
                                <span class="text-lg font-black text-secondary tabular-nums block mt-1">{q.waiting}</span>
                            </div>
                            <!-- Delayed -->
                            <div class="p-2.5 rounded-2xl bg-warning/5 border border-warning/10">
                                <span class="text-[9px] font-bold tracking-widest uppercase opacity-40 block">Delay</span>
                                <span class="text-lg font-black text-warning tabular-nums block mt-1">{q.delayed}</span>
                            </div>
                            <!-- Failed -->
                            <div class="p-2.5 rounded-2xl bg-error/5 border border-error/10">
                                <span class="text-[9px] font-bold tracking-widest uppercase opacity-40 block">Fail</span>
                                <span class="text-lg font-black text-error tabular-nums block mt-1">{q.failed}</span>
                            </div>
                            <!-- Completed -->
                            <div class="p-2.5 rounded-2xl bg-success/5 border border-success/10">
                                <span class="text-[9px] font-bold tracking-widest uppercase opacity-40 block">Done</span>
                                <span class="text-lg font-black text-success tabular-nums block mt-1">{q.completed}</span>
                            </div>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    </div>

    <!-- Failed Jobs Diagnostics Table -->
    <div class="card bg-base-100 border border-base-content/5 rounded-3xl overflow-hidden relative z-10 shadow-sm">
        <!-- Section Title and Filtering controls -->
        <div class="p-6 border-b border-base-content/5 bg-base-200/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h3 class="text-lg font-black">Failed Jobs Diagnostics Log</h3>
                <p class="text-xs text-base-content/50">Inspect specific job inputs, failure root causes, and stack traces.</p>
            </div>
            
            <div class="flex items-center gap-3">
                <span class="text-[10px] font-extrabold uppercase tracking-widest opacity-40">Filter Queue:</span>
                <select
                    class="select select-sm select-bordered font-bold text-xs rounded-xl focus:ring-0"
                    bind:value={selectedQueueFilter}
                >
                    <option value="ALL">ALL QUEUES</option>
                    <option value="photo-processing">photo-processing</option>
                    <option value="notifications">notifications</option>
                    <option value="cleanup">cleanup</option>
                    <option value="delivery">delivery</option>
                </select>
            </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="table table-lg">
                <thead class="bg-base-200/40">
                    <tr class="text-base-content/50 font-bold uppercase text-[10px] tracking-widest border-none">
                        <th>Job Info</th>
                        <th>Queue Name</th>
                        <th>Job Payload</th>
                        <th>Failure Reason</th>
                        <th class="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {#if loading}
                        {#each Array(3) as _}
                            <tr class="animate-pulse border-b border-base-content/5">
                                <td>
                                    <div class="space-y-2">
                                        <div class="h-4 w-32 bg-base-300 rounded"></div>
                                        <div class="h-3 w-40 bg-base-300 rounded"></div>
                                    </div>
                                </td>
                                <td>
                                    <div class="h-6 w-28 bg-base-300 rounded-xl"></div>
                                </td>
                                <td>
                                    <div class="h-10 w-44 bg-base-300 rounded-xl"></div>
                                </td>
                                <td>
                                    <div class="h-4 w-48 bg-base-300 rounded"></div>
                                </td>
                                <td class="text-right">
                                    <div class="h-8 w-24 bg-base-300 rounded-xl ml-auto"></div>
                                </td>
                            </tr>
                        {/each}
                    {:else if filteredFailedJobs.length === 0}
                        <tr>
                            <td colspan="5" class="text-center py-20 opacity-50 font-bold text-sm">
                                No failed jobs found matching your filters. Background worker pipeline is clean!
                            </td>
                        </tr>
                    {:else}
                        {#each filteredFailedJobs as job}
                            <tr class="hover:bg-base-200/20 transition-all border-b border-base-content/5 align-top">
                                <td>
                                    <div class="space-y-1">
                                        <span class="font-black text-sm block">{job.name}</span>
                                        <span class="font-mono text-[9px] text-base-content/40 block">ID: {job.id}</span>
                                        <span class="text-[10px] font-bold text-base-content/40 uppercase tracking-wider block">
                                            Failed: {formatTime(job.timestamp)}
                                        </span>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge badge-sm badge-outline font-extrabold uppercase text-[8px] tracking-wider py-0.5 px-2">
                                        {job.queueName}
                                    </span>
                                </td>
                                <td>
                                    <!-- Payload Pre -->
                                    <div class="max-h-24 max-w-xs overflow-y-auto bg-base-200/50 p-2 rounded-xl text-[10px] font-mono border border-base-content/5 leading-relaxed text-base-content/70">
                                        <pre>{JSON.stringify(job.data, null, 2)}</pre>
                                    </div>
                                </td>
                                <td>
                                    <div class="space-y-1.5 max-w-sm">
                                        <span class="text-error font-black text-xs block leading-relaxed">
                                            {job.failedReason || "Unknown pipeline error"}
                                        </span>
                                        
                                        {#if job.stacktrace && job.stacktrace.length > 0}
                                            <button
                                                class="btn btn-xs btn-error btn-soft rounded-md font-bold uppercase text-[9px]"
                                                onclick={() => viewStackTrace(job)}
                                            >
                                                Inspect Stack Trace
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                                <td class="text-right">
                                    <div class="flex justify-end gap-1.5">
                                        <button
                                            class="btn btn-sm btn-ghost hover:btn-primary text-primary rounded-xl font-bold gap-1 transition-all"
                                            onclick={() => retrySingleJob(job.queueName, job.id)}
                                            title="Retry Job"
                                        >
                                            Retry
                                        </button>
                                        <button
                                            class="btn btn-sm btn-ghost hover:btn-error text-error/60 hover:text-error rounded-xl font-bold gap-1 transition-all"
                                            onclick={() => removeSingleJob(job.queueName, job.id)}
                                            title="Remove from queue"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Diagnostics Stack Trace Inspection Modal -->
{#if isTraceModalOpen && activeTraceJob}
    <div class="modal modal-open z-70">
        <div class="modal-box rounded-3xl border border-error/15 bg-base-100 shadow-xl max-w-3xl">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-base-content/5 pb-4 mb-4">
                <div class="flex items-center gap-3 text-error">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    <h3 class="text-lg font-black uppercase tracking-tight">Stack Trace Diagnostics</h3>
                </div>
                
                <button
                    class="btn btn-ghost btn-circle"
                    onclick={() => { isTraceModalOpen = false; activeTraceJob = null; }}
                    title="Close"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Job details and reason -->
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4 text-xs font-bold bg-base-200/30 p-4 rounded-2xl border border-base-content/5">
                    <div>
                        <span class="opacity-45 block uppercase text-[9px] tracking-wider">Job Name & ID</span>
                        <span class="text-base-content font-black block mt-0.5">{activeTraceJob.name} (#{activeTraceJob.id})</span>
                    </div>
                    <div>
                        <span class="opacity-45 block uppercase text-[9px] tracking-wider">Queue Channel</span>
                        <span class="text-base-content font-black block mt-0.5">{activeTraceJob.queueName}</span>
                    </div>
                </div>

                <div>
                    <span class="text-xs font-black uppercase tracking-widest opacity-45 block mb-2">Failure Root Reason</span>
                    <div class="alert alert-error alert-soft rounded-2xl text-xs font-extrabold leading-relaxed">
                        {activeTraceJob.failedReason || "Unknown failure reason"}
                    </div>
                </div>

                <!-- Code block stack trace -->
                <div>
                    <span class="text-xs font-black uppercase tracking-widest opacity-45 block mb-2">Diagnostics Trace Logs</span>
                    <div class="max-h-72 overflow-auto bg-neutral text-neutral-content p-5 rounded-2xl font-mono text-[10px] leading-relaxed border border-base-content/10 shadow-inner">
                        {#each activeTraceJob.stacktrace || [] as line}
                            <span class="block border-b border-neutral-content/5 py-1 whitespace-pre-wrap">{line}</span>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="modal-action border-t border-base-content/5 pt-4 mt-6">
                <button
                    class="btn btn-ghost rounded-2xl font-bold"
                    onclick={() => { isTraceModalOpen = false; activeTraceJob = null; }}
                >
                    Dismiss
                </button>
                <button
                    class="btn btn-primary rounded-2xl font-black px-6 shadow-md shadow-primary/20"
                    onclick={() => {
                        const q = activeTraceJob!.queueName;
                        const id = activeTraceJob!.id;
                        isTraceModalOpen = false;
                        activeTraceJob = null;
                        retrySingleJob(q, id);
                    }}
                >
                    Reschedule Job
                </button>
            </div>
        </div>
        <button type="button" class="modal-backdrop text-left" onclick={() => { isTraceModalOpen = false; activeTraceJob = null; }}>close</button>
    </div>
{/if}

<!-- Toast Alerts -->
{#if showToast}
    <div class="toast toast-bottom toast-end z-80">
        <div class="alert font-semibold shadow-lg rounded-2xl
            {toastType === 'success' ? 'alert-success' : ''}
            {toastType === 'error' ? 'alert-error' : ''}
            {toastType === 'info' ? 'alert-info' : ''}">
            <span>{toastMessage}</span>
        </div>
    </div>
{/if}
