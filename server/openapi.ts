/**
 * OpenAPI 3.1 specification for Home Buddy API.
 *
 * Served at GET /api/docs/openapi.json
 * A Swagger-UI page can be wired on top in the future.
 */
import type { Express } from "express";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "Home Buddy API",
    version: "2.0.0",
    description: "AI-powered home maintenance planner & tracker.",
  },
  servers: [{ url: "/", description: "Current host" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        operationId: "healthCheck",
        tags: ["System"],
        responses: {
          200: { description: "Healthy", content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } } },
          503: { description: "Unhealthy" },
        },
      },
    },
    "/api/csrf-token": {
      get: {
        summary: "Get CSRF token",
        operationId: "getCsrfToken",
        tags: ["Auth"],
        responses: { 200: { description: "CSRF token", content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" } } } } } } },
      },
    },
    "/api/auth/test-login": {
      post: {
        summary: "Development-only test login",
        operationId: "testLogin",
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["username", "password"], properties: { username: { type: "string" }, password: { type: "string" } } } } } },
        responses: { 200: { description: "Login successful" }, 401: { description: "Invalid credentials" } },
      },
    },
    "/api/home": {
      get: {
        summary: "Get current user's home",
        operationId: "getHome",
        tags: ["Homes"],
        security: [{ session: [] }],
        responses: { 200: { description: "Home object" }, 401: { description: "Unauthorized" } },
      },
      post: {
        summary: "Create a home",
        operationId: "createHome",
        tags: ["Homes"],
        security: [{ session: [] }],
        responses: { 201: { description: "Home created" }, 400: { description: "Validation error" } },
      },
    },
    "/api/home/{homeId}/systems": {
      get: {
        summary: "List systems for a home",
        operationId: "listSystems",
        tags: ["Systems"],
        security: [{ session: [] }],
        parameters: [{ name: "homeId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Array of systems" } },
      },
      post: {
        summary: "Create a system",
        operationId: "createSystem",
        tags: ["Systems"],
        security: [{ session: [] }],
        parameters: [{ name: "homeId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 201: { description: "System created" } },
      },
    },
    "/api/home/{homeId}/tasks": {
      get: {
        summary: "List maintenance tasks for a home",
        operationId: "listTasks",
        tags: ["Tasks"],
        security: [{ session: [] }],
        parameters: [{ name: "homeId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Array of tasks" } },
      },
      post: {
        summary: "Create a maintenance task",
        operationId: "createTask",
        tags: ["Tasks"],
        security: [{ session: [] }],
        parameters: [{ name: "homeId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 201: { description: "Task created" } },
      },
    },
    "/v2/homes": {
      post: {
        summary: "Create home (event-sourced)",
        operationId: "v2CreateHome",
        tags: ["V2 Homes"],
        security: [{ session: [] }],
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
        responses: { 201: { description: "Home created" }, 409: { description: "Conflict" } },
      },
    },
    "/v2/home": {
      get: {
        summary: "Get current user's home (event-sourced)",
        operationId: "v2GetHome",
        tags: ["V2 Homes"],
        security: [{ session: [] }],
        responses: { 200: { description: "Home projection" } },
      },
    },
    "/v2/homes/{homeId}/systems": {
      get: {
        summary: "List systems (event-sourced)",
        operationId: "v2ListSystems",
        tags: ["V2 Systems"],
        security: [{ session: [] }],
        parameters: [{ name: "homeId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Array of system projections" } },
      },
    },
    "/v2/homes/{homeId}/tasks": {
      get: {
        summary: "List tasks (event-sourced)",
        operationId: "v2ListTasks",
        tags: ["V2 Tasks"],
        security: [{ session: [] }],
        parameters: [{ name: "homeId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Array of task projections" } },
      },
    },
    "/v2/events": {
      get: {
        summary: "Read event stream",
        operationId: "v2ReadEvents",
        tags: ["V2 Events"],
        security: [{ session: [] }],
        parameters: [{ name: "after", in: "query", schema: { type: "integer" } }],
        responses: { 200: { description: "Array of events" } },
      },
    },
  },
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "connect.sid" },
    },
    schemas: {
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["healthy", "unhealthy"] },
          db: { type: "string" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

export function registerOpenApiRoute(app: Express): void {
  app.get("/api/docs/openapi.json", (_req, res) => {
    res.json(spec);
  });
}
