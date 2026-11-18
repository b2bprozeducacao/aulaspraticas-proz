<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Seat confirmation runs only through the `confirmar_inscricao` database function (row lock + all checks in one transaction); never insert into `inscricoes` from app code, so the server stays the single source of truth for seat limits.
- Students read classes only via `listar_aulas_disponiveis()`; `aulas` and `inscricoes` have no anon access and are readable only by admins through RLS (`has_role`), so personal data is never public.
- Admin role is stored in `user_roles`; the first account ever created becomes admin via a trigger on `auth.users`, so no hardcoded credentials are needed.
- Pure rules (validation, CSV export, spreadsheet import parsing) live in `src/lib/` with tests in `src/lib/regras.test.ts`.
- Admins edit/delete classes only via `admin_editar_aula` / `admin_excluir_aula`; delete requires the caller to pass the current confirmed-enrollment count, so enrollments are never removed without the admin seeing how many.
