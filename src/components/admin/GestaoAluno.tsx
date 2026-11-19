import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, CalendarDays, Clock, History, Loader2, MapPin, UserRound, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dadosAlunoSchema, normalizarEmail, normalizarNome } from "@/lib/validacao";
import { formatarData, formatarDataHora, formatarHorario } from "@/lib/datas";
import { aulasAdminQuery, type AulaAdmin } from "./dados";

export type AulaResumo = Pick<AulaAdmin, "id" | "curso" | "unidade" | "tema_da_aula" | "data" | "horario" | "professor">;

export type AlunoAlvo = {
  inscricao_id: string;
  nome: string;
  email: string;
  data_hora_inscricao: string;
  aula: AulaResumo;
};

type Resposta = { ok: boolean; mensagem?: string };

const selectCls =
  "h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground focus-visible:border-brand-vibrant focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30";

export function descreverAula(a: AulaResumo) {
  return `${a.tema_da_aula} — ${a.curso}, ${a.unidade}, ${formatarData(a.data)} às ${formatarHorario(a.horario)} (Prof. ${a.professor})`;
}

function aulaFutura(a: Pick<AulaAdmin, "data" | "horario">) {
  return new Date(`${a.data}T${formatarHorario(a.horario)}:00-03:00`) > new Date();
}

function useAtualizarAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] });
}

function CampoMotivo({ id, valor, onChange, placeholder }: { id: string; valor: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>
      <Textarea id={id} value={valor} maxLength={500} rows={2} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/* ---------------- Cancelar ---------------- */

export function CancelarInscricaoDialog({ aluno, onClose }: { aluno: AlunoAlvo | null; onClose: () => void }) {
  const atualizar = useAtualizarAdmin();
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setMotivo("");
    setErro(null);
  }, [aluno]);

  async function confirmar() {
    if (!aluno) return;
    setEnviando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("admin_cancelar_inscricao", { p_inscricao_id: aluno.inscricao_id, p_motivo: motivo });
    setEnviando(false);
    const r = data as unknown as Resposta | null;
    if (error || !r) return setErro("Não foi possível cancelar agora. Tente de novo.");
    if (!r.ok) return setErro(r.mensagem ?? "Não foi possível cancelar.");
    toast.success(`Inscrição de ${aluno.nome} cancelada. A vaga foi liberada.`);
    atualizar();
    onClose();
  }

  return (
    <Dialog open={!!aluno} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-brand">Remover aluno da aula?</DialogTitle>
          <DialogDescription>A vaga fica livre para outra pessoa e o e-mail poderá se inscrever de novo.</DialogDescription>
        </DialogHeader>
        {aluno && (
          <dl className="grid gap-1 rounded-xl bg-muted p-3 text-sm">
            <div><dt className="inline font-bold">Nome: </dt><dd className="inline">{aluno.nome}</dd></div>
            <div><dt className="inline font-bold">E-mail: </dt><dd className="inline break-all">{aluno.email}</dd></div>
            <div><dt className="inline font-bold">Aula: </dt><dd className="inline">{descreverAula(aluno.aula)}</dd></div>
          </dl>
        )}
        <CampoMotivo id="motivo-cancelar" valor={motivo} onChange={setMotivo} placeholder="Ex.: aluno pediu pelo WhatsApp" />
        {erro && <p className="text-sm font-medium text-destructive" role="alert">{erro}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Voltar</Button>
          <Button onClick={confirmar} disabled={enviando} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <UserX aria-hidden />}
            Cancelar inscrição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Trocar aula ---------------- */

export function TrocarAulaDialog({ aluno, onClose }: { aluno: AlunoAlvo | null; onClose: () => void }) {
  const atualizar = useAtualizarAdmin();
  const { data: aulas, isLoading } = useQuery({ ...aulasAdminQuery, enabled: !!aluno });
  const [curso, setCurso] = useState("");
  const [unidade, setUnidade] = useState("");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aluno) return;
    setCurso(aluno.aula.curso);
    setUnidade("");
    setEscolhida(null);
    setMotivo("");
    setErro(null);
  }, [aluno]);

  const futuras = useMemo(() => (aulas ?? []).filter((a) => aulaFutura(a) && a.id !== aluno?.aula.id), [aulas, aluno]);
  const cursos = useMemo(() => [...new Set(futuras.map((a) => a.curso))].sort((a, b) => a.localeCompare(b, "pt-BR")), [futuras]);
  const unidades = useMemo(
    () => [...new Set(futuras.filter((a) => !curso || a.curso === curso).map((a) => a.unidade))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [futuras, curso],
  );
  const lista = futuras.filter((a) => (!curso || a.curso === curso) && (!unidade || a.unidade === unidade));

  async function confirmar() {
    if (!aluno || !escolhida) return;
    setEnviando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("trocar_aula_inscricao", {
      p_inscricao_id: aluno.inscricao_id,
      p_nova_aula_id: escolhida,
      p_motivo: motivo,
    });
    setEnviando(false);
    const r = data as unknown as Resposta | null;
    if (error || !r) return setErro("Não foi possível trocar agora. Tente de novo.");
    if (!r.ok) {
      setErro(r.mensagem ?? "Não foi possível trocar.");
      atualizar();
      return;
    }
    toast.success(`${aluno.nome} foi movido(a) para a nova aula.`);
    atualizar();
    onClose();
  }

  return (
    <Dialog open={!!aluno} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <p className="eyebrow">Trocar aula</p>
          <DialogTitle className="text-xl font-bold text-brand">{aluno?.nome}</DialogTitle>
          <DialogDescription>Aula atual: {aluno && descreverAula(aluno.aula)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="troca-curso">Curso</Label>
            <select id="troca-curso" className={selectCls} value={curso} onChange={(e) => { setCurso(e.target.value); setUnidade(""); setEscolhida(null); }}>
              <option value="">Todos</option>
              {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="troca-unidade">Unidade</Label>
            <select id="troca-unidade" className={selectCls} value={unidade} onChange={(e) => { setUnidade(e.target.value); setEscolhida(null); }}>
              <option value="">Todas</option>
              {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando aulas…
          </div>
        ) : lista.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">Nenhuma outra aula futura com esses filtros.</p>
        ) : (
          <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1" role="radiogroup" aria-label="Nova aula">
            {lista.map((a) => {
              const esgotada = a.vagas_restantes === 0;
              const ativa = escolhida === a.id;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ativa}
                    disabled={esgotada}
                    onClick={() => setEscolhida(a.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${ativa ? "border-brand-vibrant bg-brand-soft" : "border-border bg-card hover:border-brand-vibrant/60"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-brand">{a.tema_da_aula}</p>
                      <span className={`shrink-0 text-sm font-bold ${esgotada ? "text-muted-foreground" : "text-brand-vibrant"}`}>
                        {esgotada ? "Esgotada" : `${a.vagas_restantes} ${a.vagas_restantes === 1 ? "vaga" : "vagas"}`}
                      </span>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-cta">{a.curso}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{a.unidade}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{formatarData(a.data)}</span>
                      <span className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatarHorario(a.horario)}</span>
                      <span className="flex items-center gap-1"><UserRound className="size-3.5" aria-hidden />{a.professor}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <CampoMotivo id="motivo-troca" valor={motivo} onChange={setMotivo} placeholder="Ex.: conflito de horário" />
        {erro && <p className="text-sm font-medium text-destructive" role="alert">{erro}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>Voltar</Button>
          <Button onClick={confirmar} disabled={!escolhida || enviando}>
            {enviando ? <Loader2 className="animate-spin" aria-hidden /> : <ArrowRightLeft aria-hidden />}
            Confirmar troca
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Adicionar aluno ---------------- */

export function AdicionarAlunoDialog({ aula, onClose }: { aula: AulaResumo | null; onClose: () => void }) {
  const atualizar = useAtualizarAdmin();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<{ nome?: string | undefined; email?: string | undefined; geral?: string | undefined }>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setNome("");
    setEmail("");
    setMotivo("");
    setErros({});
  }, [aula]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!aula) return;
    const v = dadosAlunoSchema.safeParse({ nome, email });
    if (!v.success) {
      const f = v.error.flatten().fieldErrors;
      setErros({ nome: f.nome?.[0], email: f.email?.[0] });
      return;
    }
    setErros({});
    setEnviando(true);
    const { data, error } = await supabase.rpc("admin_inscrever_aluno", {
      p_aula_id: aula.id,
      p_nome: normalizarNome(nome),
      p_email: normalizarEmail(email),
      p_motivo: motivo,
    });
    setEnviando(false);
    const r = data as unknown as (Resposta & { codigo?: string }) | null;
    if (error || !r) return setErros({ geral: "Não foi possível inscrever agora. Tente de novo." });
    if (!r.ok) {
      if (r.codigo === "nome_invalido") return setErros({ nome: r.mensagem });
      if (r.codigo === "email_invalido" || r.codigo === "email_ja_inscrito") return setErros({ email: r.mensagem });
      atualizar();
      return setErros({ geral: r.mensagem ?? "Não foi possível inscrever." });
    }
    toast.success(`${normalizarNome(nome)} foi inscrito(a) na aula.`);
    atualizar();
    onClose();
  }

  return (
    <Dialog open={!!aula} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Adicionar aluno</p>
          <DialogTitle className="text-xl font-bold text-brand">{aula?.tema_da_aula}</DialogTitle>
          <DialogDescription>{aula && descreverAula(aula)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="add-nome">Nome completo</Label>
            <Input id="add-nome" value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={!!erros.nome} autoComplete="off" />
            {erros.nome && <p className="text-sm text-destructive">{erros.nome}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-email">E-mail</Label>
            <Input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!erros.email} autoComplete="off" />
            {erros.email && <p className="text-sm text-destructive">{erros.email}</p>}
          </div>
          <CampoMotivo id="motivo-add" valor={motivo} onChange={setMotivo} placeholder="Ex.: inscrição pela secretaria / WhatsApp" />
          {erros.geral && <p className="text-sm font-medium text-destructive" role="alert">{erros.geral}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={enviando}>Voltar</Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" aria-hidden />}
              Inscrever aluno
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Detalhes + histórico ---------------- */

type ItemHistorico = {
  id: string;
  acao: "troca" | "cancelamento" | "inscricao_manual";
  admin_email: string | null;
  aula_antiga: string | null;
  aula_nova: string | null;
  motivo: string | null;
  created_at: string;
};

const NOME_ACAO: Record<ItemHistorico["acao"], string> = {
  troca: "Troca de aula",
  cancelamento: "Cancelamento",
  inscricao_manual: "Inscrição manual",
};

export function DetalhesAlunoDialog({
  aluno,
  onClose,
  onTrocar,
  onCancelar,
}: {
  aluno: AlunoAlvo | null;
  onClose: () => void;
  onTrocar: (a: AlunoAlvo) => void;
  onCancelar: (a: AlunoAlvo) => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "historico", aluno?.inscricao_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_historico_inscricao", { p_inscricao_id: aluno!.inscricao_id });
      if (error) throw error;
      return (data ?? []) as unknown as ItemHistorico[];
    },
    enabled: !!aluno,
  });

  return (
    <Dialog open={!!aluno} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <p className="eyebrow">Aluno</p>
          <DialogTitle className="text-xl font-bold text-brand">{aluno?.nome}</DialogTitle>
          <DialogDescription className="break-all">{aluno?.email}</DialogDescription>
        </DialogHeader>
        {aluno && (
          <>
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-bold">Aula atual</p>
              <p>{descreverAula(aluno.aula)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Inscrito em {formatarDataHora(aluno.data_hora_inscricao)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="soft" size="sm" onClick={() => onTrocar(aluno)}><ArrowRightLeft aria-hidden /> Trocar aula</Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => onCancelar(aluno)}><UserX aria-hidden /> Cancelar</Button>
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 font-bold text-brand"><History className="size-4" aria-hidden /> Histórico</h3>
              {isLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
              ) : isError ? (
                <p className="mt-2 text-sm text-destructive">Não conseguimos carregar o histórico.</p>
              ) : !data?.length ? (
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma ação do admin registrada. Inscrição feita pelo próprio aluno.</p>
              ) : (
                <ol className="mt-2 grid gap-2">
                  {data.map((h) => (
                    <li key={h.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-bold text-foreground">{NOME_ACAO[h.acao]}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatarDataHora(h.created_at)} · por {h.admin_email ?? "admin"}
                      </p>
                      {h.aula_antiga && <p className="mt-1"><span className="font-medium">De:</span> {h.aula_antiga}</p>}
                      {h.aula_nova && <p><span className="font-medium">Para:</span> {h.aula_nova}</p>}
                      {h.motivo && <p className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {h.motivo}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Orquestração ---------------- */

/** Mantém as janelas de detalhes/troca/cancelamento num único lugar. */
export function useGestaoAluno() {
  const [detalhes, setDetalhes] = useState<AlunoAlvo | null>(null);
  const [trocar, setTrocar] = useState<AlunoAlvo | null>(null);
  const [cancelar, setCancelar] = useState<AlunoAlvo | null>(null);
  const janelas = (
    <>
      <DetalhesAlunoDialog
        aluno={detalhes}
        onClose={() => setDetalhes(null)}
        onTrocar={(a) => { setDetalhes(null); setTrocar(a); }}
        onCancelar={(a) => { setDetalhes(null); setCancelar(a); }}
      />
      <TrocarAulaDialog aluno={trocar} onClose={() => setTrocar(null)} />
      <CancelarInscricaoDialog aluno={cancelar} onClose={() => setCancelar(null)} />
    </>
  );
  return { abrirDetalhes: setDetalhes, abrirTroca: setTrocar, abrirCancelamento: setCancelar, janelas };
}
