import { DEMO_FRIENDS, DEMO_NOTICE } from '../demoData.js';
export async function demoRoutes(app) {
    app.get('/demo/friends', async () => {
        return {
            demo: true,
            notice: DEMO_NOTICE,
            friends: DEMO_FRIENDS,
        };
    });
}
