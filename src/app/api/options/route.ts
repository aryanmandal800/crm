import { api } from "@/lib/api";
import { options } from "@/lib/options";

export const dynamic = "force-dynamic";

export const GET = api(null, async () => {
  const o = await options();
  return o;
});
