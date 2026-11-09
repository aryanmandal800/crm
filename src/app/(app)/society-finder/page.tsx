import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SocietyFinderClient } from "@/components/client/SocietyFinder";

export const dynamic = "force-dynamic";

export default async function SocietyFinderPage() {
  await requirePage();

  return (
    <>
      <PageHeader
        title="Society Finder"
        sub="Discover and research cooperative credit societies, urban banks, and financial institutions across India using Google Places."
      />
      <SocietyFinderClient />
    </>
  );
}

