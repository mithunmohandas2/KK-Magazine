import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Studio from "@/components/Studio";
import { magazineName } from "@/lib/data";
import { sessionCookie, sessionUser, workspace } from "@/lib/store";

export const metadata = { title: `Dashboard | ${magazineName}` };

export default async function Dashboard() {
  const user = await sessionUser((await cookies()).get(sessionCookie)?.value);
  if (!user) redirect("/login");
  return <Studio initialWorkspace={await workspace(user)} />;
}
