import { ApiError } from '../errors.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function parseRouteGeometry(value) {
    if (!isRecord(value) || value['type'] !== 'LineString' || !Array.isArray(value['coordinates'])) {
        throw new ApiError(502, 'routing provider returned an invalid geometry');
    }
    const coordinates = value['coordinates'];
    if (coordinates.length < 2 ||
        !coordinates.every((point) => Array.isArray(point) &&
            point.length === 2 &&
            typeof point[0] === 'number' &&
            Number.isFinite(point[0]) &&
            typeof point[1] === 'number' &&
            Number.isFinite(point[1]))) {
        throw new ApiError(502, 'routing provider returned an invalid geometry');
    }
    return { type: 'LineString', coordinates: coordinates };
}
export function createOsrmProvider(options) {
    const baseUrl = options.baseUrl.replace(/\/$/, '');
    const fetchFn = options.fetchFn ??
        (globalThis.fetch ??
            (() => {
                throw new ApiError(503, 'routing provider unreachable');
            }));
    const timeoutMs = options.timeoutMs ?? 10000;
    return {
        name: 'osrm',
        async route(from, to) {
            // NOTE: the `driving` path segment is OSRM's legacy service name. The
            // effective profile comes from the prepared graph (foot.lua), not the URL.
            const url = `${baseUrl}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}` +
                '?overview=full&geometries=geojson&steps=false';
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            let payload;
            try {
                const res = await fetchFn(url, { signal: controller.signal });
                if (!res.ok) {
                    throw new ApiError(503, 'routing provider unreachable');
                }
                payload = await res.json();
            }
            catch (err) {
                if (err instanceof ApiError)
                    throw err;
                if (err instanceof Error && err.name === 'AbortError') {
                    throw new ApiError(504, 'routing provider timed out');
                }
                throw new ApiError(503, 'routing provider unreachable');
            }
            finally {
                clearTimeout(timer);
            }
            if (!isRecord(payload) || typeof payload['code'] !== 'string') {
                throw new ApiError(502, 'routing provider returned an invalid response');
            }
            if (payload['code'] === 'NoRoute') {
                throw new ApiError(404, 'no walking route found');
            }
            if (payload['code'] !== 'Ok' || !Array.isArray(payload['routes']) || payload['routes'].length === 0) {
                throw new ApiError(502, 'routing provider returned an invalid response');
            }
            const first = payload['routes'][0];
            if (!isRecord(first) ||
                typeof first['distance'] !== 'number' ||
                !Number.isFinite(first['distance']) ||
                typeof first['duration'] !== 'number' ||
                !Number.isFinite(first['duration'])) {
                throw new ApiError(502, 'routing provider returned an invalid response');
            }
            return {
                geometry: parseRouteGeometry(first['geometry']),
                distance_m: first['distance'],
                duration_s: first['duration'],
            };
        },
    };
}
