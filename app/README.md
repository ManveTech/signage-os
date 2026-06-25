# SignageOS Mobile Console

This React Native Expo application serves as the mobile CMS controller console.

## URL Configuration

The endpoints for the backend server and PocketBase are centralized inside the following file:

- [app/src/config.ts](file:///home/manve/projects/signage-os/app/src/config.ts)

```typescript
export const BACKEND_URL = 'https://dem1.manve.co';
export const API_BASE = `${BACKEND_URL}/api/v1`;
export const POCKETBASE_URL = 'https://demo.manve.co';
```

If you need to redeploy the server or migrate the PocketBase instance, update these values, and the application will synchronize with the new addresses.
