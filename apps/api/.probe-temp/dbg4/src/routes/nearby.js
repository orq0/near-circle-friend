import { DEMO_NOTICE } from '../demoData.js';
import { parseRadiusM } from '../geo.js';
import { DEFAULT_RADIUS_M, DEMO_USER_ID, findNearbyFriends, } from '../services/proximity.js';
export async function nearbyRoutes(app, db) {
    app.get('/friends/nearby', async (req) => {
        const query = req.query;
        const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
        const result = await findNearbyFriends(db, DEMO_USER_ID, radiusM);
        return {
            demo: true,
            notice: DEMO_NOTICE,
            center: result.center,
            radius_m: radiusM,
            count: result.friends.length,
            friends: result.friends,
        };
    });
}
