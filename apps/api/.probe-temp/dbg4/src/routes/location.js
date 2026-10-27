import { parseLatLon } from '../geo.js';
import { DEMO_USER_ID, updateLocation, } from '../services/proximity.js';
export async function locationRoutes(app, db) {
    app.put('/location', async (req) => {
        const point = parseLatLon(req.body);
        return updateLocation(db, DEMO_USER_ID, point);
    });
}
