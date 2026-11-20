import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = api(null, async (ctx) => {
  return {
    ok: true,
    user: ctx.user,
    role: ctx.role,
    perms: Array.from(ctx.perms),
    scope: ctx.scope,
    grant: ctx.grant,
  };
});
