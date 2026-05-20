#!/usr/bin/env bash
# ============================================================================
# CampusGig — One-time Nginx Bootstrap
# ============================================================================
# Runs on a fresh VPS (Ubuntu/Debian assumed). Installs Nginx + Certbot,
# renders the site config from the template, validates, reloads.
#
# Run ONCE per VPS, not on every deploy.
#
# Usage:
#   sudo ./bootstrap-nginx.sh \
#       --frontend-domain campusgig.example.com \
#       --api-domain      api.campusgig.example.com \
#       --auth-domain     auth.campusgig.example.com \
#       --frontend-port   8080 \
#       --api-port        3000 \
#       --keycloak-port   8090 \
#       --email           admin@example.com    # for Let's Encrypt expiry warnings
#
# After it succeeds:
#   - Nginx is serving HTTP on all three domains
#   - Certbot has obtained certs and switched everything to HTTPS
#   - Auto-renewal is configured via systemd timer
# ============================================================================

set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────
# These defaults reflect the canonical host-port topology decided after the
# initial deploy. If you change any of these, also update:
#   - .env.production (FRONTEND_PORT for the frontend repo)
#   - docker-compose.prod.yaml (the host-side port mapping for that service)
# Frontend runs on 8081 (not 8080) so Keycloak can use its conventional 8080.
FRONTEND_PORT="8081"
API_PORT="3000"
KEYCLOAK_PORT="8080"
FRONTEND_DOMAIN=""
API_DOMAIN=""
AUTH_DOMAIN=""
EMAIL=""
SKIP_CERTBOT=false
TEMPLATE="$(dirname "$0")/campusgig.conf.template"

# ─── Parse args ──────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
	case "$1" in
		--frontend-domain) FRONTEND_DOMAIN="$2"; shift 2 ;;
		--api-domain)      API_DOMAIN="$2";      shift 2 ;;
		--auth-domain)     AUTH_DOMAIN="$2";     shift 2 ;;
		--frontend-port)   FRONTEND_PORT="$2";   shift 2 ;;
		--api-port)        API_PORT="$2";        shift 2 ;;
		--keycloak-port)   KEYCLOAK_PORT="$2";   shift 2 ;;
		--email)           EMAIL="$2";           shift 2 ;;
		--skip-certbot)    SKIP_CERTBOT=true;    shift ;;
		-h|--help)
			grep -E '^# ' "$0" | sed -E 's/^# ?//'
			exit 0
			;;
		*)
			echo "Unknown flag: $1" >&2
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
[[ $EUID -eq 0 ]] || die "Must run as root (use sudo)"

[[ -n "$FRONTEND_DOMAIN" ]] || die "--frontend-domain is required"
[[ -n "$API_DOMAIN" ]]      || die "--api-domain is required"
[[ -n "$AUTH_DOMAIN" ]]     || die "--auth-domain is required"
if [[ "$SKIP_CERTBOT" == "false" ]]; then
	[[ -n "$EMAIL" ]] || die "--email is required (or pass --skip-certbot to defer)"
fi
[[ -f "$TEMPLATE" ]] || die "Template not found: $TEMPLATE"

# ─── Install Nginx + Certbot ─────────────────────────────────────────────────
log "Installing Nginx and Certbot…"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx certbot python3-certbot-nginx
ok "Nginx + Certbot installed"

# ─── UFW (if enabled, open HTTP/HTTPS) ───────────────────────────────────────
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
	log "Configuring UFW to allow HTTP/HTTPS…"
	ufw allow "Nginx Full" >/dev/null
	ok "UFW updated"
fi

# ─── Render template ─────────────────────────────────────────────────────────
log "Rendering Nginx config for ${FRONTEND_DOMAIN} / ${API_DOMAIN} / ${AUTH_DOMAIN}…"

TARGET="/etc/nginx/sites-available/campusgig"
sed \
	-e "s|FRONTEND_DOMAIN|${FRONTEND_DOMAIN}|g" \
	-e "s|API_DOMAIN|${API_DOMAIN}|g" \
	-e "s|AUTH_DOMAIN|${AUTH_DOMAIN}|g" \
	-e "s|FRONTEND_PORT|${FRONTEND_PORT}|g" \
	-e "s|API_PORT|${API_PORT}|g" \
	-e "s|KEYCLOAK_PORT|${KEYCLOAK_PORT}|g" \
	"$TEMPLATE" > "$TARGET"

ln -sf "$TARGET" /etc/nginx/sites-enabled/campusgig

# Remove default site to avoid name collisions on bare server_name "_"
[[ -L /etc/nginx/sites-enabled/default ]] && rm /etc/nginx/sites-enabled/default

ok "Config written to $TARGET"

# ─── Validate + reload ───────────────────────────────────────────────────────
log "Validating Nginx config…"
nginx -t || die "nginx -t failed — fix /etc/nginx/sites-available/campusgig"
ok "Config valid"

log "Reloading Nginx…"
systemctl reload nginx
systemctl enable --now nginx >/dev/null
ok "Nginx reloaded and enabled at boot"

# ─── Certbot (HTTPS) ─────────────────────────────────────────────────────────
# Three possible paths:
#   1. --skip-certbot     → skip entirely, warn user to run later
#   2. Certs already exist → reinstall (no new cert issuance, just rewires
#                            Nginx config — needed because re-running this
#                            script rewrites Nginx from the template and
#                            loses certbot's previously-injected 443 blocks)
#   3. Fresh deploy       → certonly + install, full first-time setup
CERT_DIR="/etc/letsencrypt/live/${FRONTEND_DOMAIN}"

if [[ "$SKIP_CERTBOT" == "true" ]]; then
	warn "Skipping certbot (--skip-certbot)"
	warn "Run manually when DNS resolves:"
	warn "  sudo certbot --nginx -d ${FRONTEND_DOMAIN} -d ${API_DOMAIN} -d ${AUTH_DOMAIN} --email ${EMAIL:-YOUR_EMAIL} --agree-tos --redirect --non-interactive"
elif [[ -d "$CERT_DIR" ]]; then
	log "Certificates already exist at ${CERT_DIR} — reinstalling (no new cert issuance)…"
	# certbot install rewires the Nginx config to use the existing certs.
	# --reinstall avoids the interactive "do you want to reinstall?" prompt
	# that newer certbot versions show. --cert-name targets the existing
	# certificate by its lineage name (typically the first domain).
	certbot install --nginx \
		--cert-name "$FRONTEND_DOMAIN" \
		--redirect \
		--non-interactive \
		|| die "Certbot install failed — try 'sudo certbot --nginx -d ${FRONTEND_DOMAIN} -d ${API_DOMAIN} -d ${AUTH_DOMAIN} --redirect' manually"
	ok "Certificates rewired; HTTP→HTTPS redirect re-applied"
else
	log "Obtaining Let's Encrypt certificates (certbot)…"
	certbot --nginx \
		-d "$FRONTEND_DOMAIN" \
		-d "$API_DOMAIN" \
		-d "$AUTH_DOMAIN" \
		--email "$EMAIL" \
		--agree-tos \
		--redirect \
		--non-interactive \
		|| die "Certbot failed — check that DNS A-records for all three domains point to this VPS"
	ok "Certificates installed; HTTP→HTTPS redirect configured"
fi

# Confirm renewal timer is active (regardless of which path above ran)
if [[ "$SKIP_CERTBOT" != "true" ]]; then
	if systemctl is-active --quiet certbot.timer; then
		ok "certbot.timer is active (auto-renewal enabled)"
	else
		warn "certbot.timer is not active — enabling it"
		systemctl enable --now certbot.timer
	fi
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
printf '\n'
ok "Nginx bootstrap complete"
printf '   Frontend:  https://%s  →  127.0.0.1:%s\n' "$FRONTEND_DOMAIN" "$FRONTEND_PORT"
printf '   API:       https://%s  →  127.0.0.1:%s\n' "$API_DOMAIN"      "$API_PORT"
printf '   Keycloak:  https://%s  →  127.0.0.1:%s\n' "$AUTH_DOMAIN"     "$KEYCLOAK_PORT"
printf '\n'
printf '   Validate: curl -I https://%s\n' "$FRONTEND_DOMAIN"
printf '   Renew:    sudo certbot renew --dry-run\n'
printf '   Reload:   sudo systemctl reload nginx\n'
