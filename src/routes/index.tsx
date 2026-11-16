import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, ArrowLeft, Building2, GraduationCap, Loader2, PartyPopper, RefreshCw } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "@/components/proz/Logo";
import { SiteFooter } from "@/components/proz/SiteFooter";
import { WhatsAppButton } from "@/components/proz/WhatsAppButton";
import { AulaCard, OptionButton, ResumoLista, StepHeading, paraResumo } from "@/components/inscricao/partes";
import type { AulaDisponivel, RespostaConfirmacao, ResumoAula } from "@/components/inscricao/tipos";
import { dadosAlunoSchema, normalizarEmail, normalizarNome } from "@/lib/validacao";
import { formatarHorario } from "@/lib/datas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Garanta sua vaga | Aulas Práticas Proz" },
      { name: "description", content: "Escolha seu curso, unidade e horário e retire sua vaga na aula prática da Proz." },
      { property: "og:title", content: "Garanta sua vaga | Aulas Práticas Proz" },
      { property: "og:description", content: "Escolha seu curso, unidade e horário e retire sua vaga na aula prática da Proz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inscricao,
});

type Etapa = 1 | 2 | 3 | 4 | 5 | 6;
const TOTAL_ETAPAS = 5;
const TITULOS: Record<Etapa, string> = {
  1: "Curso",
  2: "Unidade",
  3: "Aula",
  4: "Seus dados",
  5: "Revisão",
  6: "Pronto",
};

const CONSENTIMENTO =
  "Concordo com o uso do meu nome e e-mail apenas para organizar minha participação na aula prática.";

const aulasQuery = {
  queryKey: ["aulas-disponiveis"],
  queryFn: async (): Promise<AulaDisponivel[]> => {
    const { data, error } = await supabase.rpc("listar_aulas_disponiveis");
    if (error) throw error;
    return (data ?? []) as AulaDisponivel[];
  },
};

function Inscricao() {
  const queryClient = useQueryClient();
  const { data: aulas, isLoading, isError, refetch, isFetching } = useQuery(aulasQuery);

  const [etapa, setEtapa] = useState<Etapa>(1);
  const [curso, setCurso] = useState<string | null>(null);
  const [unidade, setUnidade] = useState<string | null>(null);
  const [aula, setAula] = useState<AulaDisponivel | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [errosForm, setErrosForm] = useState<{ nome?: string | undefined; email?: string | undefined }>({});
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<{ mensagem: string; aulaExistente?: ResumoAula | undefined } | null>(null);
  const [confirmada, setConfirmada] = useState<{ aula: ResumoAula; nome: string; email: string } | null>(null);

  const cursos = useMemo(() => contar(aulas ?? [], (a) => a.curso), [aulas]);
  const unidades = useMemo(
    () => contar((aulas ?? []).filter((a) => a.curso === curso), (a) => a.unidade),
    [aulas, curso],
  );
  const aulasDaUnidade = useMemo(
    () => (aulas ?? []).filter((a) => a.curso === curso && a.unidade === unidade),
    [aulas, curso, unidade],
  );

  function irPara(e: Etapa) {
    setEtapa(e);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function voltar() {
    setErroConfirmacao(null);
    if (etapa === 2) setUnidade(null);
    if (etapa === 3) setAula(null);
    irPara((etapa - 1) as Etapa);
  }

  function enviarDados(e: FormEvent) {
    e.preventDefault();
    const r = dadosAlunoSchema.safeParse({ nome, email });
    if (!r.success) {
      const f = r.error.flatten().fieldErrors;
      setErrosForm({ nome: f.nome?.[0], email: f.email?.[0] });
      return;
    }
    setErrosForm({});
    setErroConfirmacao(null);
    irPara(5);
  }

  async function confirmar() {
    if (!aula || !aceite) return;
    setEnviando(true);
    setErroConfirmacao(null);
    try {
      const { data, error } = await supabase.rpc("confirmar_inscricao", {
        p_aula_id: aula.id,
        p_curso: aula.curso,
        p_unidade: aula.unidade,
        p_tema_da_aula: aula.tema_da_aula,
        p_data: aula.data,
        p_horario: formatarHorario(aula.horario),
        p_professor: aula.professor,
        p_nome: normalizarNome(nome),
        p_email: normalizarEmail(email),
      });
      if (error) throw error;
      const r = data as unknown as RespostaConfirmacao;
      if (r.ok) {
        setConfirmada({ aula: r.aula, nome: normalizarNome(nome), email: normalizarEmail(email) });
        queryClient.invalidateQueries({ queryKey: aulasQuery.queryKey });
        irPara(6);
        return;
      }
      if (r.codigo === "esgotada" || r.codigo === "aula_indisponivel") {
        setAula(null);
        setAceite(false);
        setAviso(r.mensagem);
        await queryClient.invalidateQueries({ queryKey: aulasQuery.queryKey });
        irPara(3);
        return;
      }
      if (r.codigo === "nome_invalido" || r.codigo === "email_invalido") {
        setErrosForm(r.codigo === "nome_invalido" ? { nome: r.mensagem } : { email: r.mensagem });
        irPara(4);
        return;
      }
      setErroConfirmacao({ mensagem: r.mensagem, aulaExistente: r.aula_existente });
    } catch {
      setErroConfirmacao({ mensagem: "Não conseguimos confirmar agora. Verifique sua conexão e tente de novo." });
    } finally {
      setEnviando(false);
    }
  }

  function recomecar() {
    setEtapa(1);
    setCurso(null);
    setUnidade(null);
    setAula(null);
    setNome("");
    setEmail("");
    setAceite(false);
    setConfirmada(null);
    setAviso(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-page">
      <header className="bg-gradient-brand">
        <div className="mx-auto max-w-3xl px-5 pb-8 pt-5">
          <Logo />
          {etapa < 6 && (
            <div className="mt-8">
              <p className="eyebrow-on-brand">Aulas práticas</p>
              <h1 className="mt-1 text-3xl leading-tight text-on-brand sm:text-4xl">Garanta sua vaga</h1>
              <Progresso etapa={etapa} />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:py-10">
        {etapa > 1 && etapa < 6 && (
          <button
            type="button"
            onClick={voltar}
            className="mb-5 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-brand-vibrant hover:text-brand"
          >
            <ArrowLeft className="size-4" aria-hidden /> Voltar
          </button>
        )}

        <div key={etapa} className="animate-rise">
          {isLoading && etapa < 4 ? (
            <Carregando />
          ) : isError && etapa < 4 ? (
            <ErroCarregar onRetry={() => refetch()} />
          ) : etapa === 1 ? (
            <section aria-labelledby="t1">
              <StepHeading eyebrow="Etapa 1" title="Qual é o seu curso?" />
              {cursos.length === 0 ? (
                <Vazio texto="Ainda não há aulas práticas abertas. Volte em breve!" />
              ) : (
                <div className="grid gap-3">
                  {cursos.map(([nomeCurso, n]) => (
                    <OptionButton
                      key={nomeCurso}
                      label={nomeCurso}
                      detail={n === 1 ? "1 aula disponível" : `${n} aulas disponíveis`}
                      icon={<GraduationCap className="size-5" aria-hidden />}
                      onClick={() => {
                        setCurso(nomeCurso);
                        setUnidade(null);
                        setAula(null);
                        irPara(2);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : etapa === 2 ? (
            <section>
              <StepHeading eyebrow="Etapa 2" title="Em qual unidade?" hint={curso ?? undefined} />
              {unidades.length === 0 ? (
                <Vazio texto="Esse curso não tem mais aulas abertas." />
              ) : (
                <div className="grid gap-3">
                  {unidades.map(([nomeUnidade, n]) => (
                    <OptionButton
                      key={nomeUnidade}
                      label={nomeUnidade}
                      detail={n === 1 ? "1 aula disponível" : `${n} aulas disponíveis`}
                      icon={<Building2 className="size-5" aria-hidden />}
                      onClick={() => {
                        setUnidade(nomeUnidade);
                        setAula(null);
                        irPara(3);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : etapa === 3 ? (
            <section>
              <StepHeading eyebrow="Etapa 3" title="Escolha sua aula" hint={`${curso} · ${unidade}`} />
              {aviso && (
                <Alerta>
                  <span>{aviso}</span>
                </Alerta>
              )}
              {isFetching && (
                <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Atualizando vagas…
                </p>
              )}
              {aulasDaUnidade.length === 0 ? (
                <Vazio texto="Não há mais aulas abertas nessa unidade." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {aulasDaUnidade.map((a) => (
                    <AulaCard
                      key={a.id}
                      aula={a}
                      onSelect={() => {
                        setAula(a);
                        setAviso(null);
                        irPara(4);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : etapa === 4 ? (
            <section>
              <StepHeading eyebrow="Etapa 4" title="Seus dados" hint="Só precisamos do seu nome e e-mail." />
              <form onSubmit={enviarDados} noValidate className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    aria-invalid={!!errosForm.nome}
                    aria-describedby={errosForm.nome ? "nome-erro" : undefined}
                    maxLength={150}
                    placeholder="Ex.: Ana Paula Souza"
                  />
                  {errosForm.nome && <ErroCampo id="nome-erro">{errosForm.nome}</ErroCampo>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errosForm.email}
                    aria-describedby={errosForm.email ? "email-erro" : undefined}
                    maxLength={255}
                    placeholder="voce@email.com"
                  />
                  {errosForm.email && <ErroCampo id="email-erro">{errosForm.email}</ErroCampo>}
                </div>
                <Button type="submit" size="xl" className="w-full sm:w-auto sm:justify-self-end">
                  Continuar
                </Button>
              </form>
            </section>
          ) : etapa === 5 && aula ? (
            <section>
              <StepHeading eyebrow="Etapa 5" title="Confira e confirme" />
              <div className="rounded-2xl bg-brand-soft p-5 sm:p-6">
                <ResumoLista aula={paraResumo(aula)} />
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nome</dt>
                    <dd className="font-medium">{normalizarNome(nome)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">E-mail</dt>
                    <dd className="break-all font-medium">{normalizarEmail(email)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => irPara(4)}
                  className="mt-3 text-sm font-medium text-brand-vibrant underline underline-offset-2 hover:text-brand"
                >
                  Editar dados
                </button>
              </div>

              <div className="mt-5 flex items-start gap-3">
                <Checkbox id="aceite" checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
                <Label htmlFor="aceite" className="text-sm font-normal leading-relaxed">
                  {CONSENTIMENTO}
                </Label>
              </div>

              {erroConfirmacao && (
                <Alerta>
                  <div>
                    <p className="font-bold">{erroConfirmacao.mensagem}</p>
                    {erroConfirmacao.aulaExistente && (
                      <p className="mt-1">
                        Sua inscrição atual: <strong>{erroConfirmacao.aulaExistente.tema_da_aula}</strong> —{" "}
                        {erroConfirmacao.aulaExistente.curso}, {erroConfirmacao.aulaExistente.unidade},{" "}
                        {erroConfirmacao.aulaExistente.data} às {erroConfirmacao.aulaExistente.horario} com{" "}
                        {erroConfirmacao.aulaExistente.professor}.
                      </p>
                    )}
                  </div>
                </Alerta>
              )}

              <Button
                size="xl"
                className="mt-6 w-full"
                onClick={confirmar}
                disabled={!aceite || enviando}
              >
                {enviando ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden /> Confirmando…
                  </>
                ) : (
                  "Confirmar minha vaga"
                )}
              </Button>
              {!aceite && (
                <p className="mt-2 text-center text-sm text-muted-foreground">Marque a caixa acima para confirmar.</p>
              )}
            </section>
          ) : etapa === 6 && confirmada ? (
            <Sucesso confirmada={confirmada} onNova={recomecar} />
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function contar<T>(lista: T[], chave: (x: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
}

function Progresso({ etapa }: { etapa: Etapa }) {
  return (
    <div className="mt-6" aria-label={`Etapa ${etapa} de ${TOTAL_ETAPAS}: ${TITULOS[etapa]}`}>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: TOTAL_ETAPAS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i < etapa ? "bg-on-brand" : "bg-on-brand/30"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-on-brand/90">
        Etapa {etapa} de {TOTAL_ETAPAS} · {TITULOS[etapa]}
      </p>
    </div>
  );
}

function Sucesso({ confirmada, onNova }: { confirmada: { aula: ResumoAula; nome: string; email: string }; onNova: () => void }) {
  return (
    <section aria-live="polite">
      <div className="overflow-hidden rounded-3xl bg-gradient-brand p-6 text-on-brand shadow-card sm:p-8">
        <PartyPopper className="size-10" aria-hidden />
        <h2 className="mt-4 text-3xl text-on-brand sm:text-4xl">Vaga confirmada! 🎉</h2>
        <p className="mt-3 max-w-prose text-lg leading-relaxed text-on-brand">
          No dia da aula, apresente-se na secretaria da unidade ou ao seu professor(a) com{" "}
          <strong>15 minutos de antecedência</strong>.
        </p>
        <p className="mt-4 text-on-brand">Teve algum imprevisto? Fale com a gente pelo WhatsApp:</p>
        <WhatsAppButton className="mt-3" />
      </div>

      <div className="mt-5 rounded-2xl bg-brand-soft p-5 sm:p-6">
        <p className="eyebrow mb-3">Sua aula</p>
        <ResumoLista aula={confirmada.aula} />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Inscrição em nome de <strong className="text-foreground">{confirmada.nome}</strong> ({confirmada.email}).
      </p>
      <Button variant="outline" size="lg" className="mt-6" onClick={onNova}>
        Voltar ao início
      </Button>
    </section>
  );
}

function Carregando() {
  return (
    <div className="grid gap-3" role="status" aria-label="Carregando aulas">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
      ))}
    </div>
  );
}

function ErroCarregar({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
      <AlertCircle className="mx-auto size-8 text-brand-vibrant" aria-hidden />
      <p className="mt-3 font-bold text-foreground">Não conseguimos carregar as aulas.</p>
      <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente de novo.</p>
      <Button variant="soft" className="mt-4" onClick={onRetry}>
        <RefreshCw aria-hidden /> Tentar de novo
      </Button>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground shadow-card">{texto}</div>
  );
}

function Alerta({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-4 mt-4 flex items-start gap-3 rounded-2xl border border-highlight bg-card p-4 text-sm text-foreground">
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-cta" aria-hidden />
      {children}
    </div>
  );
}

function ErroCampo({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-sm font-medium text-destructive">
      <AlertCircle className="size-4" aria-hidden /> {children}
    </p>
  );
}
