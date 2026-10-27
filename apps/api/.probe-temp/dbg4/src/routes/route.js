import { DEMO_NOTICE } from '../demoData.js';
import { ApiError } from '../errors.js';
import { parseRadiusM } from '../geo.js';
import { defaultStrideM, parseStrideM } from '../routing/steps.js';
import { DEFAULT_RADIUS_M, DEMO_USER_ID, getFriendRoute, } from '../services/proximity.js';
export async function routeRoutes(app, db, provider) {
    app.get('/friends/:id/route', async (req) => {
        const params = req.params;
        const query = req.query;
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new ApiError(400, 'friend id is required');
        }
        const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
        const strideM = parseStrideM(query.stride_m, defaultStrideM());
        const route = await getFriendRoute(db, provider, DEMO_USER_ID, params.id, radiusM, strideM);
        return { demo: true, notice: DEMO_NOTICE, radius_m: radiusM, route };
    });
}
