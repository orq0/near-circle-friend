import { ApiError } from '../errors.js';
export const DEFAULT_STRIDE_M = 0.75;
export function parseStrideM(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    const num = typeof value === 'string' ? Number(value) : value;
    if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0 || num > 3) {
        throw new ApiError(400, 'stride_m must be a number between 0 and 3 meters');
    }
    return num;
}
export function defaultStrideM(env = process.env) {
    const raw = env['DEFAULT_STRIDE_M'];
    if (raw === undefined || raw.trim() === '')
        return DEFAULT_STRIDE_M;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 3)
        return DEFAULT_STRIDE_M;
    return num;
}
/** Labeled estimate, never a measured count. */
export function estimateSteps(distanceM, strideM) {
    if (!Number.isFinite(distanceM) || distanceM < 0) {
        throw new ApiError(400, 'distance must be a non-negative number');
    }
    if (!Number.isFinite(strideM) || strideM <= 0) {
        throw new ApiError(400, 'stride must be a positive number');
    }
    return Math.round(distanceM / strideM);
}
