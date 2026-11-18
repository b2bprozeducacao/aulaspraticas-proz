import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, Clock, Download, Loader2, LogOut, MapPin, Pencil, Trash2, Upload, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/proz/Logo";
import { BuscaAlunos } from "@/components/admin/BuscaAlunos";
import { ImportarAulas } from "@/components/admin/ImportarAulas";
import { InscritosDialog } from "@/components/admin/InscritosDialog";
import { EditarAulaDialog, ExcluirAulaDialog } from "@/components/admin/GerenciarAula";
import { aulasAdminQuery, buscarInscricoesConfirmadas, paraLinhaExport, type AulaAdmin } from "@/components/admin/dados";
import { baixarCsv, gerarCsv } from "@/lib/csv-export";
import { formatarData, formatarHorario } from "@/lib/datas";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel | Admin Aulas Práticas Proz" },
      { name: "description", content: "Gerencie aulas práticas, inscritos e exportações da Proz." },
      { property: "og:title", content: "Painel | Admin Aulas Práticas Proz" },
      { property: "og:description", content: "Gerencie aulas práticas, inscritos e exportações da Proz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const TODOS = "";

function AdminPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const { data: ehAdmin, isLoading: checando } = useQuery({
    queryKey: ["admin", "papel", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      return data as boolean;
    },
  });

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-gradient-page">
      <header className="bg-gradient-brand">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-on-brand/90 sm:inline">{user.email}</span>
            <Button variant="onBrand" size="sm" onClick={sair}>
              <LogOut aria-hidden /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        {checando ? (
          <div className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Verificando acesso…
          </div>
        ) : !ehAdmin ? (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <h1 className="text-2xl">Sem acesso</h1>
            <p className="mt-2 text-muted-foreground">Sua conta não tem permissão de administrador.</p>
            <Button variant="outline" className="mt-4" onClick={sair}>
              Sair
            </Button>
          </div>
        ) : (
          <Painel />
        )}
      </main>
    </div>
  );
}

function Painel() {
  const [aba, setAba] = useState("aulas");
  return (
    <>
      <p className="eyebrow">Área administrativa</p>
      <h1 className="mt-1 text-3xl sm:text-4xl">Aulas práticas</h1>
      <Tabs value={aba} onValueChange={setAba} className="mt-6">
        <TabsList className="h-auto rounded-xl bg-card p-1">
          <TabsTrigger value="aulas" className="rounded-lg px-4 py-2 data-[state=active]:bg-brand-soft data-[state=active]:text-brand">
            <Users className="mr-1.5 size-4" aria-hidden /> Aulas e inscritos
          </TabsTrigger>
          <TabsTrigger value="importar" className="rounded-lg px-4 py-2 data-[state=active]:bg-brand-soft data-[state=active]:text-brand">
            <Upload className="mr-1.5 size-4" aria-hidden /> Importar base
          </TabsTrigger>
        </TabsList>
        <TabsContent value="aulas" className="mt-6">
          <ListaAulas />
        </TabsContent>
        <TabsContent value="importar" className="mt-6">
          <ImportarAulas onConcluido={() => setAba("aulas")} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function opcoes(aulas: AulaAdmin[], campo: "curso" | "unidade" | "professor") {
  return [...new Set(aulas.map((a) => a[campo]))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function ListaAulas() {
  const { data: aulas, isLoading, isError, refetch } = useQuery(aulasAdminQuery);
  const [curso, setCurso] = useState(TODOS);
  const [unidade, setUnidade] = useState(TODOS);
  const [professor, setProfessor] = useState(TODOS);
  const [data, setData] = useState("");
  const [aberta, setAberta] = useState<AulaAdmin | null>(null);
  const [editando, setEditando] = useState<AulaAdmin | null>(null);
  const [excluindo, setExcluindo] = useState<AulaAdmin | null>(null);
  const [exportando, setExportando] = useState(false);

  const lista = aulas ?? [];
  const filtradas = useMemo(
    () =>
      lista.filter(
        (a) =>
          (!curso || a.curso === curso) &&
          (!unidade || a.unidade === unidade) &&
          (!professor || a.professor === professor) &&
          (!data || a.data === data),
      ),
    [lista, curso, unidade, professor, data],
  );
  const totais = useMemo(
    () => filtradas.reduce((t, a) => ({ vagas: t.vagas + a.vagas_totais, preenchidas: t.preenchidas + a.vagas_preenchidas }), { vagas: 0, preenchidas: 0 }),
    [filtradas],
  );

  async function exportarTodas() {
    setExportando(true);
    try {
      const inscricoes = await buscarInscricoesConfirmadas();
      if (!inscricoes.length) {
        toast.info("Ainda não há vagas preenchidas para exportar.");
        return;
      }
      const hoje = new Date().toISOString().slice(0, 10);
      baixarCsv(`vagas-preenchidas-${hoje}.csv`, gerarCsv(inscricoes.map(paraLinhaExport)));
    } catch {
      toast.error("Não foi possível exportar agora.");
    } finally {
      setExportando(false);
    }
  }

  // Mantém o diálogo com números atualizados após cancelamentos
  const abertaAtual = aberta ? (lista.find((a) => a.id === aberta.id) ?? aberta) : null;

  if (isLoading)
    return (
      <div className="grid gap-3" role="status" aria-label="Carregando aulas">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  if (isError)
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-destructive">Não conseguimos carregar as aulas.</p>
        <Button variant="outline" className="mt-3" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );

  return (
    <div className="grid gap-5">
      <BuscaAlunos />
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Filtro id="f-curso" label="Curso" valor={curso} onChange={setCurso} opcoes={opcoes(lista, "curso")} />
        <Filtro id="f-unidade" label="Unidade" valor={unidade} onChange={setUnidade} opcoes={opcoes(lista, "unidade")} />
        <Filtro id="f-prof" label="Professor(a)" valor={professor} onChange={setProfessor} opcoes={opcoes(lista, "professor")} />
        <div className="grid gap-2">
          <Label htmlFor="f-data">Data</Label>
          <Input id="f-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setCurso(TODOS);
            setUnidade(TODOS);
            setProfessor(TODOS);
            setData("");
          }}
        >
          Limpar filtros
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {filtradas.length} aulas · <strong className="text-foreground">{totais.preenchidas}</strong> de {totais.vagas} vagas
          preenchidas
        </p>
        <Button onClick={exportarTodas} disabled={exportando}>
          {exportando ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          Exportar todas as vagas preenchidas
        </Button>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhuma aula cadastrada. Use “Importar base” para enviar a planilha.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhuma aula com esses filtros.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtradas.map((a) => (
            <CardAula key={a.id} aula={a} onVer={() => setAberta(a)} onEditar={() => setEditando(a)} onExcluir={() => setExcluindo(a)} />
          ))}
        </ul>
      )}

      <InscritosDialog aula={abertaAtual} onClose={() => setAberta(null)} />
      <EditarAulaDialog aula={editando} onClose={() => setEditando(null)} />
      <ExcluirAulaDialog aula={excluindo} onClose={() => setExcluindo(null)} />
    </div>
  );
}

function Filtro({
  id,
  label,
  valor,
  onChange,
  opcoes,
}: {
  id: string;
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: string[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground focus-visible:border-brand-vibrant focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
      >
        <option value={TODOS}>Todos</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function CardAula({ aula, onVer, onEditar, onExcluir }: { aula: AulaAdmin; onVer: () => void; onEditar: () => void; onExcluir: () => void }) {
  const pct = aula.vagas_totais > 0 ? Math.min(100, Math.round((aula.vagas_preenchidas / aula.vagas_totais) * 100)) : 100;
  const passada = new Date(`${aula.data}T${formatarHorario(aula.horario)}:00-03:00`) <= new Date();
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-cta">{aula.curso}</p>
          <p className="mt-0.5 text-lg font-bold leading-snug text-brand">{aula.tema_da_aula}</p>
        </div>
        {passada ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Realizada</span>
        ) : aula.vagas_restantes === 0 ? (
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">Esgotada</span>
        ) : null}
      </div>
      <ul className="grid grid-cols-2 gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-1.5"><MapPin className="size-4 text-brand-vibrant" aria-hidden />{aula.unidade}</li>
        <li className="flex items-center gap-1.5"><UserRound className="size-4 text-brand-vibrant" aria-hidden />{aula.professor}</li>
        <li className="flex items-center gap-1.5"><CalendarDays className="size-4 text-brand-vibrant" aria-hidden />{formatarData(aula.data)}</li>
        <li className="flex items-center gap-1.5"><Clock className="size-4 text-brand-vibrant" aria-hidden />{formatarHorario(aula.horario)}</li>
      </ul>
      <div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{aula.vagas_preenchidas}</strong>/{aula.vagas_totais} preenchidas
          </span>
          <span className="font-bold text-brand-vibrant">{aula.vagas_restantes} restantes</span>
        </div>
        <div
          className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Ocupação ${pct}%`}
        >
          <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" size="sm" onClick={onVer}>
          <Users aria-hidden /> Ver inscritos
        </Button>
        <Button variant="outline" size="sm" onClick={onEditar}>
          <Pencil aria-hidden /> Editar
        </Button>
        <Button variant="outline" size="sm" onClick={onExcluir} className="text-destructive">
          <Trash2 aria-hidden /> Excluir
        </Button>
      </div>
    </li>
  );
}
