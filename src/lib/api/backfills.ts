import { apiData, apiRequest, toQuery } from "./client";
import type {
  BackfillDraftInput,
  BackfillFinalizeResult,
  BackfillPreview,
  BackfillSession,
} from "./backfill-types";

export const backfillApi = {
  async list(
    params: {
      status?: "draft" | "finalized" | "cancelled";
      page?: number;
      limit?: number;
    } = {},
  ) {
    const response = await apiRequest<BackfillSession[]>(
      `/backfills${toQuery(params)}`,
    );
    return { items: response.data, pagination: response.pagination };
  },
  detail: (id: string) => apiData<BackfillSession>(`/backfills/${id}`),
  create: (input: BackfillDraftInput) =>
    apiData<{ backfill: BackfillSession; preview: BackfillPreview }>(
      "/backfills",
      { method: "POST", body: input },
    ),
  update: (id: string, input: Partial<BackfillDraftInput>) =>
    apiData<{ backfill: BackfillSession; preview: BackfillPreview }>(
      `/backfills/${id}`,
      { method: "PATCH", body: input },
    ),
  preview: (id: string) =>
    apiData<BackfillPreview>(`/backfills/${id}/preview`, { method: "POST" }),
  finalize: (id: string, key: string) =>
    apiData<BackfillFinalizeResult>(`/backfills/${id}/finalize`, {
      method: "POST",
      headers: { "Idempotency-Key": key },
    }),
  cancel: (id: string) =>
    apiData<BackfillSession>(`/backfills/${id}/cancel`, { method: "POST" }),
};
