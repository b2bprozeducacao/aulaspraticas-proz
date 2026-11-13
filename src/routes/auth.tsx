import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/proz/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar | Admin Aulas Práticas Proz" },
      { name: "description", content: "Acesso restrito à equipe da Proz para gerenciar as aulas práticas." },
      { property: "og:title", content: "Entrar | Admin Aulas Práticas Proz" },
      { property: "og:description", content: "Acesso restrito à equipe da Proz para gerenciar as aulas práticas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { data: existeAdmin, isLoading } = useQuery({
    queryKey: ["existe-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("existe_admin");
      if (error) throw error;
      return data as boolean;
    },
  });
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const podeCriar = existeAdmin === false;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    if (!email.trim() || senha.length < 8) {
      setErro("Informe o e-mail e uma senha com pelo menos 8 caracteres.");
      return;
    }
    setEnviando(true);
    try {
      if (modo === "criar" && podeCriar) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/admin" });
        else setInfo("Conta criada! Confirme pelo link que enviamos ao seu e-mail e depois entre aqui.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        navigate({ to: "/admin" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setErro(
        /invalid login/i.test(msg)
          ? "E-mail ou senha incorretos."
          : /not confirmed/i.test(msg)
            ? "Confirme seu e-mail pelo link enviado antes de entrar."
            : "Não foi possível continuar agora. Tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-page">
      <header className="bg-gradient-brand">
        <div className="mx-auto max-w-md px-5 py-5">
          <Logo />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <p className="eyebrow">Área administrativa</p>
        <h1 className="mt-1.5 text-3xl">{modo === "criar" ? "Criar acesso de admin" : "Entrar"}</h1>
        {modo === "criar" && (
          <p className="mt-2 text-muted-foreground">Esta será a conta administradora principal.</p>
        )}

        <form onSubmit={enviar} noValidate className="mt-6 grid gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="grid gap-2">
            <Label htmlFor="admin-email">E-mail</Label>
            <Input id="admin-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="admin-senha">Senha</Label>
            <Input
              id="admin-senha"
              type="password"
              autoComplete={modo === "criar" ? "new-password" : "current-password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          {erro && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {erro}
            </p>
          )}
          {info && (
            <p role="status" className="rounded-xl bg-brand-soft p-3 text-sm text-brand">
              {info}
            </p>
          )}
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
            {modo === "criar" ? "Criar conta" : "Entrar"}
          </Button>
        </form>

        {!isLoading && podeCriar && (
          <button
            type="button"
            onClick={() => {
              setModo(modo === "criar" ? "entrar" : "criar");
              setErro(null);
              setInfo(null);
            }}
            className="mt-4 text-sm font-medium text-brand-vibrant underline underline-offset-2"
          >
            {modo === "criar" ? "Já tenho conta — entrar" : "Primeiro acesso? Criar conta de admin"}
          </button>
        )}
      </main>
    </div>
  );
}
