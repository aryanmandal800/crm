import { api } from "@/lib/api";
import { getInstitutionOr404 } from "@/lib/access";
import { rescore } from "@/lib/scoring";
export const POST = api<{ id: string }>(["lead.edit", "research.edit"], async (ctx, _r, { id }) => { await getInstitutionOr404(ctx, id); await rescore([id]); return { id }; });
