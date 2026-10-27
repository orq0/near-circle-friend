import { DEMO_NOTICE } from '../demoData.js';
import { ApiError } from '../errors.js';
import { parseRadiusM } from '../geo.js';
import { DEFAULT_RADIUS_M, DEMO_USER_ID, getFriendDetail, listFriends, } from '../services/proximity.js';
export async function friendsRoutes(app, db) {
    app.get('/friends', async () => {
        return { demo: true, notice: DEMO_NOTICE, friends: await listFriends(db, DEMO_USER_ID) };
    });
    app.get('/friends/:id', async (req) => {
        const params = req.params;
        const query = req.query;
        if (typeof params.id !== 'string' || params.id.trim() === '') {
            throw new ApiError(400, 'friend id is required');
        }
        const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
        const detail = await getFriendDetail(db, DEMO_USER_ID, params.id, radiusM);
        return { demo: true, radius_m: radiusM, ...detail };
    });
}
