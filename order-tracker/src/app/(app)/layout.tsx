import { auth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import Providers from "@/components/Providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = ((session?.user as unknown) as { role?: string })?.role;

  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar role={role} />
        <main className="flex-1 lg:ml-[220px] transition-all duration-200">
          <div className="min-h-screen p-4 pt-20 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </Providers>
  );
}
