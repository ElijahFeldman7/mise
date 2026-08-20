import { requireSession } from "@/lib/session";
import TabBar from "@/components/TabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <div className="flex-1 pb-[76px]">{children}</div>
      <TabBar isAdmin={session.profile.is_admin} />
    </div>
  );
}
