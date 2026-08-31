import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";

export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: coop } = profile.cooperative_id
    ? await supabase.from("cooperatives").select("name").eq("id", profile.cooperative_id).single()
    : { data: null };

  return (
    <div className="min-h-dvh bg-soil-50">
      <AppNav profile={profile} coopName={coop?.name} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
