export const FUNNEL_API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";

export function buildApiHeaders(token?: string | null, includeJsonContentType = false): HeadersInit {
  return {
    Accept: "application/json",
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function readApiResponse<T = unknown>(response: Response): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
  message: string;
}> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json = (await response.json()) as { data?: T; message?: string } & T;
    const nestedData = typeof json === "object" && json !== null && "data" in json ? (json.data ?? null) : null;
    const message = (typeof json === "object" && json !== null && "message" in json && typeof json.message === "string")
      ? json.message
      : response.ok
        ? "OK"
        : response.status === 401
          ? "Unauthenticated."
          : "Request failed.";

    return {
      ok: response.ok,
      status: response.status,
      data: (nestedData ?? json ?? null) as T | null,
      message,
    };
  }

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: null,
    message: text || (response.status === 401 ? "Unauthenticated." : "Request failed."),
  };
}

export type FunnelStatus = "draft" | "published" | "archived";

export type FunnelStepType = "landing" | "checkout" | "order_bump" | "upsell" | "thank_you";

export type LandingPageBlock = {
  id: number;
  landing_page_id: number;
  block_key: string;
  block_type: string;
  parent_block_id: number | null;
  sort_order: number;
  locked: boolean;
  visibility_rules_json?: Record<string, unknown> | null;
  settings_json?: Record<string, unknown> | null;
  content_json?: Record<string, unknown> | null;
};

export type FunnelFlowStep = {
  id: number;
  funnel_flow_id: number;
  step_type: FunnelStepType;
  step_order: number;
  landing_page_id: number | null;
  slug: string | null;
  is_enabled: boolean;
  settings_json?: Record<string, unknown> | null;
  landing_page?: {
    id: number;
    title: string;
    slug: string;
    status: FunnelStatus;
    content_json?: {
      sections?: Array<Record<string, unknown>>;
    } | null;
  } | null;
};

export type FunnelFlow = {
  id: number;
  funnel_id: number;
  name: string;
  version: number;
  is_active: boolean;
  steps?: FunnelFlowStep[];
};

export type FunnelData = {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  status: FunnelStatus;
  theme_tokens_json?: Record<string, unknown> | null;
  settings_json?: Record<string, unknown> | null;
  published_at?: string | null;
  flows?: FunnelFlow[];
};

export type FunnelAnalyticsRow = {
  step_id: number;
  step_type: FunnelStepType;
  conversions: Record<string, number>;
};
