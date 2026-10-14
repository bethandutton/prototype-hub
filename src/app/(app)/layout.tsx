import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
        <div className="flex items-center gap-6">
          <Link href="/projects" className="serif text-xl">
            Rehearsal
          </Link>
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/projects"
            afterSelectOrganizationUrl="/projects"
            appearance={{ elements: { rootBox: "text-sm" } }}
          />
        </div>
        <UserButton />
      </header>
      {children}
    </div>
  );
}
