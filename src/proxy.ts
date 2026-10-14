import { clerkMiddleware } from "@clerk/nextjs/server";

// Sign-in is checked where data is read: the app layout, server actions and
// the file route. The proxy only keeps the Clerk session fresh.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
