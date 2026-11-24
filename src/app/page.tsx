import { cookies } from "next/headers";
import type { Viewport } from "next";
import Reader from "@/components/Reader";
import { publicMagazine, sessionCookie, sessionUser } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const viewport: Viewport = { viewportFit: "cover" };

export default async function Home() {
  const token = (await cookies()).get(sessionCookie)?.value;
  const [{ magazine, initialPage }, user] = await Promise.all([
    publicMagazine(),
    sessionUser(token),
  ]);
  return (
    <Reader
      magazine={magazine}
      initialPage={initialPage}
      signedIn={Boolean(user)}
    />
  );
}
