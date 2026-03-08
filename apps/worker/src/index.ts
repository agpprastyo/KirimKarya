const port = process.env.WORKER_PORT || 3001;

console.log(`Worker booting up...`);

const server = Bun.serve({
    port,
    fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/health") {
            return new Response("OK", { status: 200 });
        }
        return new Response("Kirim Karya Worker is running", { status: 200 });
    },
});

console.log(`Worker listening on http://localhost:${server.port}`);

// Future: Initialize Redis/BullMQ listeners here
