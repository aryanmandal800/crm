import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { homeFor } from "@/lib/nav";
export default async function Home() { redirect(homeFor(await requirePage())); }
