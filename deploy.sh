#!/usr/bin/env bash
# ============================================================================
# CampusGig Backend — Production Deploy
# ============================================================================
# Usage:
#   cd /opt/campusgig-backend
#   ./deploy.sh                  # deploy current branch
#   ./deploy.sh --skip-build     # skip docker build (faster, only restarts)
#   ./deploy.sh --skip-migrate   # skip prisma migrate deploy (use with care)
#   ./deploy.sh --no-pull        # skip git pull (deploy whatever's checked out)
#
# Requires: docker, docker compose plugin, git, sudo (for nginx reload).
# Exit codes: 0 = success, non-zero = failure (script aborts on first error).
# ============================================================================

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.prod.yaml"
ENV_FILE=".env.production"
SERVICES_TO_HEALTHCHECK=(
	"campusgig-db-prod"
	"campusgig-redis-prod"
	"campusgig-keycloak-prod"
	"campusgig-app-prod"
)
HEALTH_TIMEOUT=180   # seconds to wait for all services to become healthy
HEALTH_INTERVAL=5    # seconds between healthcheck polls
NGINX_RELOAD=true    # reload host nginx after deploy

# ─── Flags ───────────────────────────────────────────────────────────────────
SKIP_BUILD=false
SKIP_MIGRATE=false
NO_PULL=false
for arg in "$@"; do
	case "$arg" in
		--skip-build)   SKIP_BUILD=true ;;
		--skip-migrate) SKIP_MIGRATE=true ;;
		--no-pull)      NO_PULL=true ;;
		-h|--help)
			grep -E '^# ' "$0" | sed -E 's/^# ?//'
			exit 0
			;;
		*)
			echo "Unknown flag: $arg" >&2
			echo "Run with --help for usage." >&2
			exit 2
			;;
	esac
done

# ─── Logging helpers ─────────────────────────────────────────────────────────
log()  { printf '\033[36m▶\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m⚠\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ─── Preflight ───────────────────────────────────────────────────────────────
log "Preflight checks…"

command -v docker >/dev/null    || die "docker not found in PATH"
command -v git >/dev/null       || die "git not found in PATH"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not installed"

[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE (are you in the repo root?)"
[[ -f "$ENV_FILE" ]]     || die "Env file not found: $ENV_FILE (copy .env.example and fill in)"

# Refuse to deploy with uncommitted changes — usually a footgun
if [[ -n "$(git status --porcelain)" ]]; then
	warn "Working tree is dirty. Uncommitted changes will be lost on git pull."
	read -r -p "Continue anyway? [y/N] " response
	[[ "$response" =~ ^[Yy]$ ]] || die "Aborted by user"
fi

ok "Preflight passed"

# ─── Pull latest code ────────────────────────────────────────────────────────
if [[ "$NO_PULL" == "true" ]]; then
	warn "Skipping git pull (--no-pull)"
	COMMIT_BEFORE=""
	COMMIT_AFTER=$(git rev-parse --short HEAD)
else
	log "Pulling latest code…"
	COMMIT_BEFORE=$(git rev-parse --short HEAD)
	git fetch --all --prune
	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
	git pull --ff-only origin "$CURRENT_BRANCH" \
		|| die "git pull failed (non-fast-forward — resolve manually)"
	COMMIT_AFTER=$(git rev-parse --short HEAD)

	if [[ "$COMMIT_BEFORE" == "$COMMIT_AFTER" ]]; then
		ok "Already at latest commit ${COMMIT_AFTER} on ${CURRENT_BRANCH}"
	else
		ok "Updated from ${COMMIT_BEFORE} → ${COMMIT_AFTER} on ${CURRENT_BRANCH}"
	fi
fi

# ─── Build images ────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == "true" ]]; then
	warn "Skipping image build (--skip-build)"
else
	log "Building images (no-cache, parallel)…"
	docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull --parallel app \
		|| die "Image build failed"
	ok "Images built"
fi

# ─── Database migrations ─────────────────────────────────────────────────────
# Run BEFORE bringing up the new app, against the existing db container.
# If db isn't running yet, we'll bring it up first.
if [[ "$SKIP_MIGRATE" == "true" ]]; then
	warn "Skipping migrations (--skip-migrate)"
else
	log "Ensuring database is up before running migrations…"
	docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d db
	# Wait for db healthcheck
	for i in $(seq 1 30); do
		status=$(docker inspect --format='{{.State.Health.Status}}' campusgig-db-prod 2>/dev/null || echo "missing")
		[[ "$status" == "healthy" ]] && break
		sleep 2
	done
	[[ "$status" == "healthy" ]] || die "Database did not become healthy in 60s"

	log "Running Prisma migrations…"
	docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm \
		--no-deps \
		--entrypoint "" \
		app \
		npx prisma migrate deploy \
		|| die "Prisma migrate deploy failed"
	ok "Migrations applied"
fi

# ─── Bring up all services ───────────────────────────────────────────────────
log "Bringing up services (detached, remove orphans)…"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans \
	|| die "docker compose up failed"
ok "docker compose up complete"

# ─── Healthcheck loop ────────────────────────────────────────────────────────
log "Waiting for services to become healthy (timeout=${HEALTH_TIMEOUT}s)…"

for container in "${SERVICES_TO_HEALTHCHECK[@]}"; do
	elapsed=0
	while true; do
		# {{if .State.Health}} returns 'healthy' / 'starting' / 'unhealthy'.
		# If no healthcheck defined, fall back to .State.Status (running).
		status=$(docker inspect \
			--format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
			"$container" 2>/dev/null || echo "missing")

		case "$status" in
			healthy|running)
				ok "${container}: ${status}"
				break
				;;
			unhealthy|exited|dead|restarting)
				warn "${container} is ${status} — dumping last 50 lines of logs:"
				docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=50 "${container#campusgig-}" 2>/dev/null \
					|| docker logs --tail=50 "$container" 2>/dev/null \
					|| true
				die "Deployment failed: ${container} is ${status}"
				;;
			starting|missing)
				if (( elapsed >= HEALTH_TIMEOUT )); then
					warn "${container} did not become healthy within ${HEALTH_TIMEOUT}s (last status: ${status})"
					docker logs --tail=50 "$container" 2>/dev/null || true
					die "Healthcheck timeout"
				fi
				printf '\r  %s: %s (waiting %ds/%ds)…   ' "$container" "$status" "$elapsed" "$HEALTH_TIMEOUT"
				sleep "$HEALTH_INTERVAL"
				elapsed=$(( elapsed + HEALTH_INTERVAL ))
				;;
			*)
				warn "${container}: unknown status '${status}', retrying…"
				sleep "$HEALTH_INTERVAL"
				elapsed=$(( elapsed + HEALTH_INTERVAL ))
				;;
		esac
	done
done
printf '\n'

# ─── Reload nginx (zero-downtime) ────────────────────────────────────────────
if [[ "$NGINX_RELOAD" == "true" ]] && command -v nginx >/dev/null && systemctl is-active --quiet nginx 2>/dev/null; then
	log "Validating Nginx config and reloading…"
	sudo nginx -t   || die "Nginx config invalid — NOT reloading. Fix /etc/nginx/ and run 'sudo systemctl reload nginx' manually."
	sudo systemctl reload nginx
	ok "Nginx reloaded"
else
	warn "Nginx not detected or not running on host — skipping reload"
fi

# ─── Prune dangling images ───────────────────────────────────────────────────
# Keeps disk usage in check; only removes images with no tag and no container.
log "Pruning dangling images…"
docker image prune -f >/dev/null
ok "Prune done"

# ─── Summary ─────────────────────────────────────────────────────────────────
printf '\n'
ok "Deploy complete"
[[ -n "$COMMIT_BEFORE" ]] && printf '   commit: %s → %s\n' "$COMMIT_BEFORE" "$COMMIT_AFTER" \
                          || printf '   commit: %s\n' "$COMMIT_AFTER"
printf '   services: %d healthy\n' "${#SERVICES_TO_HEALTHCHECK[@]}"
