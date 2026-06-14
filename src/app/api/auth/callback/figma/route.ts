import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/callback/figma
 *
 * Handles the OAuth 2.0 callback from Figma after the user grants consent.
 * Exchanges the authorization code for access/refresh tokens and stores
 * them in the Integration table via Prisma upsert.
 */
export async function GET(request: NextRequest) {
  try {
    // 0. Ngrok Local Development Bridge:
    // If we receive the request on the ngrok domain, redirect to localhost:3000 to preserve the Clerk session cookies.
    const host = request.headers.get("host") || "";
    const isNgrok = host.includes("ngrok-free.dev") || host.includes("ngrok.io");
    if (isNgrok && process.env.NODE_ENV === "development") {
      const localhostUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, "http://localhost:3000");
      console.log(`🔄 [Ngrok Bridge] Redirecting callback from ngrok (${host}) to localhost:3000 to preserve Clerk session...`);
      return NextResponse.redirect(localhostUrl);
    }

    // 1. Extract query parameters from Figma's redirect
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // workspaceId we passed during init
    const error = searchParams.get("error");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Handle Figma-side errors (user denied access, etc.)
    if (error) {
      console.error("❌ Figma OAuth error:", error);
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=oauth_denied`, appUrl)
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error("❌ Missing code or state in Figma callback");
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=invalid_callback`, appUrl)
      );
    }

    const workspaceId = state;

    // 2. Verify the logged-in user has access to this workspace
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.redirect(new URL("/sign-in", appUrl));
    }

    // IDOR guard: verify the clerkId owns/belongs to this workspace
    const membershipCheck = await prisma.workspace.count({
      where: {
        id: workspaceId,
        members: {
          some: {
            user: { clerkId },
          },
        },
      },
    });

    if (membershipCheck === 0) {
      console.error(
        `❌ IDOR block: Clerk user ${clerkId} attempted to connect Figma to workspace ${workspaceId} without membership`
      );
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=unauthorized`, appUrl)
      );
    }

    // 3. Exchange the authorization code for tokens
    const clientId = process.env.FIGMA_CLIENT_ID;
    const clientSecret = process.env.FIGMA_CLIENT_SECRET;
    const redirectUri = process.env.FIGMA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("❌ Missing Figma OAuth environment variables");
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=config_missing`, appUrl)
      );
    }

    console.log("═══════════════════════════════════════════");
    console.log("🔄 FIGMA TOKEN EXCHANGE");
    console.log("═══════════════════════════════════════════");
    console.log(`  Workspace ID: ${workspaceId}`);
    console.log(`  Code:         ${code.substring(0, 10)}...`);
    console.log("───────────────────────────────────────────");

    const tokenResponse = await fetch("https://api.figma.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
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
      console.error(
        `❌ Figma token exchange failed (${tokenResponse.status}):`,
        errorBody
      );
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=token_exchange_failed`, appUrl)
      );
    }

    const tokenData = await tokenResponse.json();

    console.log("✅ Figma token exchange successful");
    console.log(`  Token type:   ${tokenData.token_type || "bearer"}`);
    console.log(`  Expires in:   ${tokenData.expires_in || "N/A"} seconds`);
    console.log(`  Has refresh:  ${!!tokenData.refresh_token}`);

    // 4. Calculate token expiry timestamp
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;

    // 5. Upsert the integration record in the database
    await prisma.integration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: "FIGMA",
        },
      },
      create: {
        workspaceId,
        provider: "FIGMA",
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt,
        isActive: true,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        tokenExpiresAt,
        isActive: true,
      },
    });

    console.log(
      `✅ Figma integration saved for workspace ${workspaceId}`
    );

    // 6. Redirect back to integrations page with success indicator
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?success=figma`, appUrl)
    );
  } catch (error) {
    console.error("❌ Figma OAuth callback error:", error);
    return NextResponse.redirect(
      new URL(
        `/dashboard/integrations?error=oauth_failed`,
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      )
    );
  }
}
