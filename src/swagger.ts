import { OpenAPIV3 } from "openapi-types";

const childParam: OpenAPIV3.ParameterObject = {
  name: "child",
  in: "path",
  required: true,
  description: "Child name (substring match against session keys)",
  schema: { type: "string" },
};

const periodQueryParam: OpenAPIV3.ParameterObject = {
  name: "period",
  in: "query",
  required: false,
  description: "Period selection: omit = all periods, 0 = current period, 1..N = 1-based index",
  schema: { type: "integer" },
};

const daysQueryParam: OpenAPIV3.ParameterObject = {
  name: "days",
  in: "query",
  required: false,
  description: "Number of days to fetch (overrides config default)",
  schema: { type: "integer" },
};

// Shared response schema: object keyed by child name
function childMapResponse(description: string, itemSchema: OpenAPIV3.SchemaObject): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: itemSchema,
          description: "Keys are child names",
        },
      },
    },
  };
}

const errorResponse: OpenAPIV3.ResponseObject = {
  description: "Error",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "integer" },
              type: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
};

const arrayResponse = childMapResponse("List of items per child", { type: "array", items: {} });

export const swaggerSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "pronote-rest",
    version: "2.0.0",
    description: "REST API exposing PRONOTE school data (lessons, homework, grades, …) via pawnote.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Auth", description: "Authentication" },
    { name: "Lessons", description: "Timetable / lessons" },
    { name: "Homework", description: "Assignments / homework" },
    { name: "Grades", description: "Grades and averages" },
    { name: "Evaluations", description: "Evaluations (competences)" },
    { name: "Notebook", description: "Absences, delays, punishments, observations" },
    { name: "Periods", description: "Grade periods" },
    { name: "Discussions", description: "Messaging / discussions" },
    { name: "Menus", description: "Canteen menus" },
    { name: "News", description: "Information and surveys" },
  ],
  paths: {
    "/login": {
      get: {
        tags: ["Auth"],
        summary: "Force re-login for all accounts",
        description: "Triggers a browser-based ENT/EduConnect re-authentication for all configured accounts.",
        responses: {
          "200": { description: "Login succeeded", content: { "text/plain": { schema: { type: "string", example: "OK" } } } },
          "500": errorResponse,
        },
      },
    },

    // ── Lessons ──────────────────────────────────────────────────────────────
    "/lessons": {
      get: {
        tags: ["Lessons"],
        summary: "Get timetable for all children",
        parameters: [daysQueryParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/lessons/{child}": {
      get: {
        tags: ["Lessons"],
        summary: "Get timetable for a specific child",
        parameters: [childParam, daysQueryParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },

    // ── Homework ─────────────────────────────────────────────────────────────
    "/homework": {
      get: {
        tags: ["Homework"],
        summary: "Get all homework for all children",
        parameters: [daysQueryParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/homework/{child}": {
      get: {
        tags: ["Homework"],
        summary: "Get all homework for a specific child",
        parameters: [childParam, daysQueryParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/homework-todo": {
      get: {
        tags: ["Homework"],
        summary: "Get undone homework starting from next working day (all children)",
        parameters: [daysQueryParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/homework-todo/{child}": {
      get: {
        tags: ["Homework"],
        summary: "Get undone homework starting from next working day (specific child)",
        parameters: [childParam, daysQueryParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },

    // ── Grades ───────────────────────────────────────────────────────────────
    "/grades": {
      get: {
        tags: ["Grades"],
        summary: "Get grades for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/grades/{child}": {
      get: {
        tags: ["Grades"],
        summary: "Get grades for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/averages": {
      get: {
        tags: ["Grades"],
        summary: "Get subject averages for all children",
        description: "Returns a map of period → subject averages.",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/averages/{child}": {
      get: {
        tags: ["Grades"],
        summary: "Get subject averages for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/overall_average": {
      get: {
        tags: ["Grades"],
        summary: "Get overall average for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/overall_average/{child}": {
      get: {
        tags: ["Grades"],
        summary: "Get overall average for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },

    // ── Evaluations ──────────────────────────────────────────────────────────
    "/evaluations": {
      get: {
        tags: ["Evaluations"],
        summary: "Get evaluations for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/evaluations/{child}": {
      get: {
        tags: ["Evaluations"],
        summary: "Get evaluations for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },

    // ── Notebook ─────────────────────────────────────────────────────────────
    "/absences": {
      get: {
        tags: ["Notebook"],
        summary: "Get absences for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/absences/{child}": {
      get: {
        tags: ["Notebook"],
        summary: "Get absences for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/delays": {
      get: {
        tags: ["Notebook"],
        summary: "Get delays for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/delays/{child}": {
      get: {
        tags: ["Notebook"],
        summary: "Get delays for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/punishments": {
      get: {
        tags: ["Notebook"],
        summary: "Get punishments for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/punishments/{child}": {
      get: {
        tags: ["Notebook"],
        summary: "Get punishments for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/observations": {
      get: {
        tags: ["Notebook"],
        summary: "Get observations for all children",
        parameters: [periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },
    "/observations/{child}": {
      get: {
        tags: ["Notebook"],
        summary: "Get observations for a specific child",
        parameters: [childParam, periodQueryParam],
        responses: { "200": arrayResponse, "404": errorResponse, "500": errorResponse },
      },
    },

    // ── Periods ──────────────────────────────────────────────────────────────
    "/period": {
      get: {
        tags: ["Periods"],
        summary: "Get current grade period for all children",
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/period/{child}": {
      get: {
        tags: ["Periods"],
        summary: "Get current grade period for a specific child",
        parameters: [childParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/periods": {
      get: {
        tags: ["Periods"],
        summary: "Get all grade periods for all children",
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/periods/{child}": {
      get: {
        tags: ["Periods"],
        summary: "Get all grade periods for a specific child",
        parameters: [childParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },

    // ── Discussions ──────────────────────────────────────────────────────────
    "/discussions": {
      get: {
        tags: ["Discussions"],
        summary: "Get discussions for all children",
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/discussions/{child}": {
      get: {
        tags: ["Discussions"],
        summary: "Get discussions for a specific child",
        parameters: [childParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },

    // ── Menus ────────────────────────────────────────────────────────────────
    "/menus": {
      get: {
        tags: ["Menus"],
        summary: "Get canteen menus for the current week (all children)",
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/menus/{child}": {
      get: {
        tags: ["Menus"],
        summary: "Get canteen menus for the current week (specific child)",
        parameters: [childParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },

    // ── News / surveys ───────────────────────────────────────────────────────
    "/information_and_surveys": {
      get: {
        tags: ["News"],
        summary: "Get news and surveys for all children",
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/information_and_surveys/{child}": {
      get: {
        tags: ["News"],
        summary: "Get news and surveys for a specific child",
        parameters: [childParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/information_and_surveys-unread": {
      get: {
        tags: ["News"],
        summary: "Get unread news and surveys for all children",
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
    "/information_and_surveys-unread/{child}": {
      get: {
        tags: ["News"],
        summary: "Get unread news and surveys for a specific child",
        parameters: [childParam],
        responses: { "200": arrayResponse, "500": errorResponse },
      },
    },
  },
};