import { cookies } from "next/headers";
import type { Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import Reader from "@/components/Reader";
import { RequestError } from "@/lib/errors";
import { previewMagazine, sessionCookie } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const viewport: Viewport = { viewportFit: "cover" };
export const metadata = {
  title: "Magazine Admin Preview",
  robots: { index: false, follow: false },
};

export default async function AdminPreview() {
  const token = (await cookies()).get(sessionCookie)?.value;
  try {
    const { magazine, initialPage } = await previewMagazine(token);
    return <Reader magazine={magazine} initialPage={initialPage} signedIn adminPreview />;
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 401) redirect("/login");
      if (error.status === 403) notFound();
    }
    throw error;
  }
}
