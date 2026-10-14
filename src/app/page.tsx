import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/projects");

  return (
    <main className="mx-auto flex min-h-screen max-w-[1040px] flex-col px-8">
      <header className="flex h-14 items-center justify-between">
        <span className="serif text-xl">Rehearsal</span>
        <Link href="/sign-in" className="text-sm underline-offset-4 hover:underline">
          Sign in
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center pb-32">
        <h1 className="max-w-[18ch] text-[clamp(2.5rem,6vw,5rem)] leading-[1.02]">
          Review working prototypes <em>together</em>, edited by your own agent.
        </h1>
        <p className="mt-8 max-w-[52ch] text-lg text-muted">
          Drop in an HTML prototype. Comment on the exact element, ask for a few versions of a section, and watch
          your teammates&rsquo; agents make the changes live. Files stay in your own GitHub or Google Drive.
        </p>
        <div className="mt-12 flex items-center gap-6">
          <Link
            href="/sign-up"
            className="rounded-md bg-ink px-5 py-2.5 text-sm text-paper transition-opacity hover:opacity-80"
          >
            Create an account
          </Link>
          <Link href="/sign-in" className="text-sm underline-offset-4 hover:underline">
            I already have one
          </Link>
        </div>
      </section>
    </main>
  );
}
