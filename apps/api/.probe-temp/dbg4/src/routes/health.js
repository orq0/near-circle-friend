export async function healthRoutes(app) {
    app.get('/health', async () => {
        return {
            status: 'ok',
            service: 'near-circle-api',
            version: '0.1.0',
            phase: 1,
        };
    });
}
