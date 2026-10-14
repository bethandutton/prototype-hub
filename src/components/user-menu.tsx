"use client";

import { UserButton } from "@clerk/nextjs";

// The avatar menu in the top bar. Admin lives here rather than in the bar
// itself, so the chrome stays the same for everyone.
export function UserMenu({ admin }: { admin: boolean }) {
  return (
    <UserButton>
      {admin && (
        <UserButton.MenuItems>
          <UserButton.Link
            label="Admin"
            href="/admin"
            labelIcon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
                <path d="M8 1.5 2.5 3.75v3.5c0 3.2 2.3 5.9 5.5 7.25 3.2-1.35 5.5-4.05 5.5-7.25v-3.5L8 1.5Z" strokeLinejoin="round" />
              </svg>
            }
          />
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}
