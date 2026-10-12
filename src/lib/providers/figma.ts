/**
 * Figma REST client.
 *
 * Figma's public API exposes the authenticated user (`/v1/me`) and file data,
 * but not organisation seat activity. Seat-level telemetry is only available
 * to Enterprise customers through SCIM / the Activity Logs API. We therefore
 * verify the OAuth token live and label seat activity as simulated.
 */

const FIGMA_API = "https://api.figma.com";

export interface FigmaUser {
  id: string;
  handle: string;
  email: string;
  img_url?: string;
}

export class FigmaApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "FigmaApiError";
  }
}

export function isMockFigmaToken(token: string): boolean {
  return token.startsWith("mock_");
}

export async function fetchFigmaMe(accessToken: string): Promise<FigmaUser> {
  const res = await fetch(`${FIGMA_API}/v1/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new FigmaApiError(res.status, `Figma API v1/me failed (${res.status})`);
  }
  return (await res.json()) as FigmaUser;
}

export interface FigmaTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function refreshFigmaToken(refreshToken: string): Promise<FigmaTokenResponse> {
  const clientId = process.env.FIGMA_CLIENT_ID;
  const clientSecret = process.env.FIGMA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing FIGMA_CLIENT_ID or FIGMA_CLIENT_SECRET in env");
  }
  if (isMockFigmaToken(refreshToken)) {
    return {
      access_token: "mock_figma_refreshed_" + Math.random().toString(36).slice(2, 10),
      refresh_token: refreshToken,
      expires_in: 3600,
    };
  }
  const res = await fetch(`${FIGMA_API}/v1/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new FigmaApiError(res.status, `Figma token refresh failed (${res.status}): ${errBody}`);
  }
  return (await res.json()) as FigmaTokenResponse;
}

export const FIGMA_SIMULATION_REASON =
  "Figma's REST API does not expose per-seat activity. Live seat telemetry requires Figma Enterprise (SCIM / Activity Logs). Billed seats come from your latest invoice; activity is simulated.";
