import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// All app routes are protected — unauthenticated users are redirected to sign-in.
// Add any future public routes (landing page, marketing, etc.) to this matcher
// to exclude them from protection.
const isPublicRoute = createRouteMatcher([
  "/",                 // Public landing page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)", // External services POST here — must bypass Clerk auth
  "/api/cron(.*)",     // Vercel Cron triggers this — bypass Clerk auth, uses CRON_SECRET guard
  "/api/auth/callback/figma", // Figma OAuth callback — handled manually
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
