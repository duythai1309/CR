import { createClient } from "@/lib/supabase/server";
import { requireCoopProfile } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { ChatWidget } from "@/components/chat/chat-widget";

export default async function CoopLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireCoopProfile();
  const supabase = await createClient();
  const { data: coop } = await supabase
    .from("cooperatives")
    .select("name")
    .eq("id", profile.cooperative_id)
    .single();

  return (
    <div className="min-h-dvh bg-soil-50">
      <AppNav profile={profile} coopName={coop?.name} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <ChatWidget audience="coop" />
    </div>
  );
}
