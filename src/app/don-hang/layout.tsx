import { requireProfile } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <div className="min-h-dvh bg-soil-50">
      <AppNav profile={profile} />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
