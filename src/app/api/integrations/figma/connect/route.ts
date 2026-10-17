import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";
import { getAppUrl, isDevelopment } from "@/lib/env";
import { FIGMA_STATE_COOKIE } from "@/lib/providers/figma";

const STATE_TTL_SECONDS = 10 * 60;

/**
 * GET /api/integrations/figma/connect
 *
 * Initiates the Figma OAuth 2.0 flow. A random nonce is stored in an
 * httpOnly cookie and sent as `state`; the callback refuses any response
 * whose `state` does not match, which blocks login-CSRF attacks that would
 * bind an attacker's Figma account to the victim's workspace.
 */
export async function GET() {
  const appUrl = getAppUrl();
  try {
    // 1. Verify the user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", appUrl));
    }

    // 2. Make sure the user has a workspace to attach the integration to
    const { workspaceId } = await ensureUserAndWorkspace();

    // 3. Validate required environment variables
    const clientId = process.env.FIGMA_CLIENT_ID;
    const redirectUri = process.env.FIGMA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("❌ Missing FIGMA_CLIENT_ID or FIGMA_REDIRECT_URI in environment");
      return NextResponse.redirect(new URL("/dashboard/integrations?error=config_missing", appUrl));
    }

    // 4. Construct the Figma OAuth authorization URL with a CSRF nonce
    const state = randomBytes(16).toString("hex");
    const scope = "file_content:read,current_user:read";
    const figmaAuthUrl = new URL("https://www.figma.com/oauth");
    figmaAuthUrl.searchParams.set("client_id", clientId);
    figmaAuthUrl.searchParams.set("redirect_uri", redirectUri);
    figmaAuthUrl.searchParams.set("scope", scope);
    figmaAuthUrl.searchParams.set("response_type", "code");
    figmaAuthUrl.searchParams.set("state", state);

    console.log(`🔗 Figma OAuth initiated for workspace ${workspaceId} (scopes: ${scope})`);

    // 5. Redirect the user to Figma, remembering the nonce in a short-lived cookie
    const response = NextResponse.redirect(figmaAuthUrl.toString());
    response.cookies.set({
      name: FIGMA_STATE_COOKIE,
      value: state,
      httpOnly: true,
      sameSite: "lax",
      secure: !isDevelopment(),
      path: "/",
      maxAge: STATE_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.error("❌ Failed to initiate Figma OAuth:", error);
    return NextResponse.redirect(new URL("/dashboard/integrations?error=oauth_init_failed", appUrl));
  }
}
