.PHONY: install dev dev-stop api web worker db-generate db-migrate db-studio infra-up infra-down infra-reset auth-generate prod-build prod-up prod-down prod-migrate prod-logs

# Infrastructure management
infra-up:
	docker compose up -d

infra-down:
	docker compose down

infra-reset:
	docker compose down -v
	@echo "Infrastructure reset. All data has been removed."


seed:
	cd packages/db && bun run db:migrate
	cd apps/e2e && bun run db:seed

seed-admin:
	cd apps/api && bun --env-file=../../.env run seed:admin

# Install all dependencies globally across workspaces
install:
	bun install

# Start all applications in development mode (parallel execution)
dev:
	@make infra-up
	@echo "Starting API Server and Web Client (and Worker)..."
	make -j4 api web worker db-studio

# Stop all applications by killing processes on known ports
dev-stop:
	@echo "Stopping processes on ports 3000, 3001, 5173, and 4983..."
	@for port in 3000 3001 5173 4983; do \
		pid=$$(lsof -ti :$$port); \
		if [ -n "$$pid" ]; then \
			echo "Killing process on port $$port (PID: $$pid)"; \
			kill -9 $$pid 2>/dev/null || true; \
		fi \
	done
	@pkill -9 -f "bun run" 2>/dev/null || true
	@pkill -9 -f "vite" 2>/dev/null || true
	docker compose down
	@echo "Done."


# Run Hono API Server
api:
	cd apps/api && bun --env-file=../../.env run dev

# Run SvelteKit Web UI
web:
	cd apps/web && bun --env-file=../../.env run dev

# Run Background Worker (if implemented later)
worker:
	cd apps/worker && bun --env-file=../../.env run dev

# Database Utility Commands (running from packages/db)
db-generate:
	cd packages/db && bun run db:generate

db-migrate:
	cd packages/db && bun run db:migrate

db-studio:
	cd packages/db && bun run db:studio

# Better Auth Schema Generation
auth-generate:
	cd apps/api && bun x auth@latest generate --output ../../packages/db/src/auth-schema.ts --y

# ── Production targets ────────────────────────────────────────────────────────

# Build all production Docker images
prod-build:
	docker compose -f docker-compose.prod.yml build --no-cache

# Run DB migrations in production (one-shot container)
prod-migrate:
	docker compose -f docker-compose.prod.yml run --rm migrate

# Start all production services (infra + apps + caddy)
prod-up:
	@if [ ! -f .env.production ]; then \
		echo "❌ .env.production not found. Copy .env.production.example and fill in values."; \
		exit 1; \
	fi
	docker compose -f docker-compose.prod.yml up -d --remove-orphans
	@echo "✅ Production stack is up."

# Stop all production services
prod-down:
	docker compose -f docker-compose.prod.yml down

# Tail logs for all production services
prod-logs:
	docker compose -f docker-compose.prod.yml logs -f --tail=100

