.PHONY: install dev dev-stop api web worker db-generate db-migrate db-studio infra-up infra-down auth-generate

# Infrastructure management
infra-up:
	docker compose up -d

infra-down:
	docker compose down


# Install all dependencies globally across workspaces
install:
	bun install

# Start all applications in development mode (parallel execution)
dev:
	@echo "Starting API Server and Web Client (and Worker)..."
	make -j4 api web worker db-studio

# Stop all applications by killing processes on known ports
dev-stop:
	@echo "Stopping processes on ports 3000, 3001, 5173, and 4983..."
	@lsof -ti :3000,3001,5173,4983 | xargs kill -9 2>/dev/null || true
	@echo "Done."


# Run Hono API Server
api:
	cd apps/api && bun --env-file=../../.env run dev

# Run SvelteKit Web UI
web:
	cd apps/web && bun --env-file=../../.env run dev

# Run Background Worker (if implemented later)
worker:
	cd apps/worker && bun run dev




# Database Utility Commands (running from packages/db)
db-generate:
	cd packages/db && bun x --bun drizzle-kit generate

db-migrate:
	cd packages/db && bun x --bun drizzle-kit migrate

db-studio:
	cd packages/db && bun x --bun drizzle-kit studio

# Better Auth Schema Generation
auth-generate:
	cd apps/api && bun x auth@latest generate --output ../../packages/db/src/auth-schema.ts --y
