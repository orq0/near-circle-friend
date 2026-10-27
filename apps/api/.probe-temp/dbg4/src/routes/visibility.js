import { ApiError } from '../errors.js';
import { MAX_RADIUS_M, MIN_RADIUS_M, parseEnabled } from '../geo.js';
import { DEMO_USER_ID, getVisibility, setVisibility, } from '../services/proximity.js';
function parseOptionalRadius(body) {
    if (typeof body !== 'object' || body === null) {
        throw new ApiError(400, 'body must be an object');
    }
    const { radius_m: radiusM } = body;
    if (radiusM === undefined || radiusM === null)
        return null;
    if (typeof radiusM !== 'number' ||
        !Number.isInteger(radiusM) ||
        radiusM < MIN_RADIUS_M ||
        radiusM > MAX_RADIUS_M) {
        throw new ApiError(400, `radius_m must be an integer between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}`);
    }
    return radiusM;
}
export async function visibilityRoutes(app, db) {
    app.get('/near-circle/visibility', async () => {
        return getVisibility(db, DEMO_USER_ID);
    });
    // Canonical visibility update (dev-plan contract).
    app.put('/near-circle/visibility', async (req) => {
        const enabled = parseEnabled(req.body);
        const radiusM = parseOptionalRadius(req.body);
        return setVisibility(db, DEMO_USER_ID, enabled, radiusM);
    });
    // Thin alias for the enable/disable action; shares the same service.
    app.post('/near-circle/toggle', async (req) => {
        const enabled = parseEnabled(req.body);
        return setVisibility(db, DEMO_USER_ID, enabled, null);
    });
}
