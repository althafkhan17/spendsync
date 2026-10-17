import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { encryptSecret } from "@/lib/crypto";
import { getAppUrl, isDevelopment } from "@/lib/env";
import { runSeatAudit } from "@/lib/engines/seat-audit";
import { FIGMA_STATE_COOKIE } from "@/lib/providers/figma";

/**
 * GET /api/auth/callback/figma
 *
 * Handles the OAuth 2.0 callback from Figma after the user grants consent.
 * Verifies the CSRF `state` nonce, exchanges the authorization code for
 * tokens, stores them encrypted on the caller's own workspace and runs the
 * first seat audit so the card is populated immediately.
 */
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();

  const redirectWithError = (code: string) => {
    const res = NextResponse.redirect(new URL(`/dashboard/integrations?error=${code}`, appUrl));
    res.cookies.delete(FIGMA_STATE_COOKIE);
    return res;
  };

  try {
    // 0. Ngrok local development bridge: Figma redirects to the public ngrok
    //    host, but the Clerk session and state cookie live on localhost.
    const host = request.headers.get("host") || "";
    const isNgrok = host.includes("ngrok-free.dev") || host.includes("ngrok.io");
    if (isNgrok && isDevelopment()) {
      const localhostUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, "http://localhost:3000");
      console.log(`🔄 [Ngrok Bridge] Redirecting callback from ${host} to localhost:3000`);
      return NextResponse.redirect(localhostUrl);
    }

    // 1. Extract query parameters from Figma's redirect
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("❌ Figma OAuth error:", error);
      return redirectWithError("oauth_denied");
    }

    if (!code || !state) {
      console.error("❌ Missing code or state in Figma callback");
      return redirectWithError("invalid_callback");
    }

    // 2. CSRF check: the state must match the nonce we set when starting the flow
    const expectedState = request.cookies.get(FIGMA_STATE_COOKIE)?.value;
    if (!expectedState || expectedState !== state) {
      console.error("❌ Figma OAuth state mismatch; possible CSRF or expired flow");
      return redirectWithError("state_mismatch");
    }

    // 3. The integration is attached to the signed-in user's own workspace
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.redirect(new URL("/sign-in", appUrl));
    }
    const { workspaceId } = await ensureUserAndWorkspace();

    // 4. Exchange the authorization code for tokens
    const clientId = process.env.FIGMA_CLIENT_ID;
    const clientSecret = process.env.FIGMA_CLIENT_SECRET;
    const redirectUri = process.env.FIGMA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("❌ Missing Figma OAuth environment variables");
      return redirectWithError("config_missing");
    }

    const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(`❌ Figma token exchange failed (${tokenResponse.status}):`, errorBody);
      return redirectWithError("token_exchange_failed");
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    // 5. Upsert the integration with credentials encrypted at rest
    const accessToken = encryptSecret(tokenData.access_token);
    const refreshToken = tokenData.refresh_token ? encryptSecret(tokenData.refresh_token) : null;

    const integration = await prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: "FIGMA" } },
      create: { workspaceId, provider: "FIGMA", accessToken, refreshToken, tokenExpiresAt, isActive: true },
      update: { accessToken, refreshToken, tokenExpiresAt, isActive: true },
    });

    console.log(`✅ Figma integration saved for workspace ${workspaceId}`);

    // 6. Run the first audit so the card is populated when the user lands back
    try {
      await runSeatAudit({ integrationId: integration.id });
    } catch (auditError) {
      console.error("⚠️ Initial Figma audit failed (integration still saved):", auditError);
    }

    const res = NextResponse.redirect(new URL("/dashboard/integrations?success=figma", appUrl));
    res.cookies.delete(FIGMA_STATE_COOKIE);
    return res;
  } catch (error) {
    console.error("❌ Figma OAuth callback error:", error);
    return redirectWithError("oauth_failed");
  }
}
