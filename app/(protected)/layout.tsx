import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
        <Link href="/dashboard" className="font-display text-lg font-semibold">
          Site Estimator
        </Link>
        <UserButton />
      </header>
      <main className="p-[var(--space-4)]">{children}</main>
    </div>
  );
}
