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
