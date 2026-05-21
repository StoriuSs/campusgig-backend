/**
 * Checks if a request URL is for the Prometheus metrics endpoint.
 *
 * Use this instead of hard-coding '/api/v1/metrics' so the check
 * remains correct regardless of the global route prefix or API version.
 *
 * Matches:
 * - `/metrics` (internal Prometheus module path)
 * - `/api/v1/metrics`, `/api/v2/metrics`, etc. (versioned routes)
 */
export function isMetricsRequest(url: string): boolean {
    return url === '/metrics' || /^\/api\/v\d+\/metrics/.test(url)
}

/**
 * Checks if a request URL is for a healthcheck endpoint (`/health`,
 * `/health/live`, `/health/ready`).
 *
 * Docker hits `/health/live` every 30s for container liveness probing,
 * which would otherwise dominate request metrics (inflating 2xx counts,
 * pulling median latency toward the trivial healthcheck handler) and
 * pollute logs with ~3000 lines/day per service. Interceptors use this
 * to skip recording / logging routine successful healthchecks while
 * still capturing failures.
 *
 * Matches both the internal route (`/health/...`) and the versioned
 * external route (`/api/v1/health/...`).
 */
export function isHealthCheckRequest(url: string): boolean {
    return /^\/health(\/|$)/.test(url) || /^\/api\/v\d+\/health(\/|$)/.test(url)
}
