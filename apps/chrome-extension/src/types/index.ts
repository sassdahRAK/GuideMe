// chrome-extension/src/types/index.ts
import type { components, paths } from "./api-schema";

// Extract backend DTOs automatically
export type UserProfile = components["schemas"]["UserProfileResponse"];
export type GuideItem = components["schemas"]["GuideDetail"];
export type UpdateProgressPayload = paths["/api/user/progress"]["post"]["requestBody"]["content"]["application/json"];

export type { paths, components } from "./api-schema";
