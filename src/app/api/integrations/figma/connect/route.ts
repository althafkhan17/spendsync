import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ensureUserAndWorkspace } from "@/lib/auth-sync";

/**
 * GET /api/integrations/figma/connect
 *
 * Initiates the Figma OAuth 2.0 flow by redirecting the user to
 * Figma's authorization endpoint with the correct scopes and state.
 */
export async function GET() {
  try {
    // 1. Verify the user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(
        new URL("/sign-in", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      );
    }

    // 2. Resolve the user's active workspace
    const { workspaceId } = await ensureUserAndWorkspace();

    // 3. Validate required environment variables
    const clientId = process.env.FIGMA_CLIENT_ID;
    const redirectUri = process.env.FIGMA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("❌ Missing FIGMA_CLIENT_ID or FIGMA_REDIRECT_URI in environment");
      return NextResponse.redirect(
        new URL("/dashboard/integrations?error=config_missing", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      );
    }

    // 4. Construct the Figma OAuth authorization URL
    const figmaAuthUrl = new URL("https://www.figma.com/oauth");
    figmaAuthUrl.searchParams.set("client_id", clientId);
    figmaAuthUrl.searchParams.set("redirect_uri", redirectUri);
    figmaAuthUrl.searchParams.set("scope", "file_content:read,current_user:read");
    figmaAuthUrl.searchParams.set("response_type", "code");
    figmaAuthUrl.searchParams.set("state", workspaceId);

    console.log("═══════════════════════════════════════════");
    console.log("🔗 FIGMA OAUTH INITIATION");
    console.log("═══════════════════════════════════════════");
    console.log(`  Workspace ID: ${workspaceId}`);
    console.log(`  Redirect URI: ${redirectUri}`);
    console.log(`  Scopes:       files:read`);
    console.log("───────────────────────────────────────────");

    // 5. Redirect the user to Figma
    return NextResponse.redirect(figmaAuthUrl.toString());
  } catch (error) {
    console.error("❌ Failed to initiate Figma OAuth:", error);
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=oauth_init_failed", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    );
  }
}
