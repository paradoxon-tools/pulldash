import { Hono } from "hono";

// Authentication uses a user-provided token directly with GitHub.
// No shared OAuth application or authentication proxy is required.
const api = new Hono().basePath("/api");
export default api;
export type AppType = typeof api;
