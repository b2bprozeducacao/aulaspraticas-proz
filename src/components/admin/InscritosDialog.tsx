import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Download, Eye, Loader2, UserPlus, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { baixarCsv, gerarCsv } from "@/lib/csv-export";
import { formatarData, formatarDataHora, formatarHorario } from "@/lib/datas";
import { buscarInscricoesConfirmadas, paraLinhaExport, slug, type AulaAdmin, type InscricaoAdmin } from "./dados";
import { AdicionarAlunoDialog, useGestaoAluno, type AlunoAlvo } from "./GestaoAluno";

export function InscritosDialog({ aula, onClose }: { aula: AulaAdmin | null; onClose: () => void }) {
  const gestao = useGestaoAluno();
  const [adicionar, setAdicionar] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "inscritos", aula?.id],
    queryFn: () => buscarInscricoesConfirmadas(aula!.id),
    enabled: !!aula,
  });

  function alvo(i: InscricaoAdmin): AlunoAlvo {
    return {
      inscricao_id: i.id,
      nome: i.nome,
      email: i.email,
      data_hora_inscricao: i.data_hora_inscricao,
      aula: { id: aula!.id, curso: aula!.curso, unidade: aula!.unidade, tema_da_aula: aula!.tema_da_aula, data: aula!.data, horario: aula!.horario, professor: aula!.professor },
    };
  }

  function exportar() {
    if (!aula || !data) return;
    baixarCsv(
      `inscritos-${slug(aula.tema_da_aula)}-${aula.data}.csv`,
      gerarCsv(data.map(paraLinhaExport)),
    );
  }

  return (
    <>
      <Dialog open={!!aula} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {aula && (
            <>
              <DialogHeader>
                <p className="eyebrow">Inscritos</p>
                <DialogTitle className="text-xl font-bold text-brand">{aula.tema_da_aula}</DialogTitle>
                <DialogDescription>
                  {aula.curso} · {aula.unidade} · {formatarData(aula.data)} às {formatarHorario(aula.horario)} · Prof.{" "}
                  {aula.professor}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{aula.vagas_preenchidas}</strong> de {aula.vagas_totais} vagas
                  preenchidas
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setAdicionar(true)} disabled={aula.vagas_restantes === 0 || new Date(`${aula.data}T${formatarHorario(aula.horario)}:00-03:00`) <= new Date()}>
                    <UserPlus aria-hidden /> Adicionar aluno
                  </Button>
                  <Button variant="soft" size="sm" onClick={exportar} disabled={!data?.length}>
                    <Download aria-hidden /> Exportar CSV
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center gap-2 py-6 text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando inscritos…
                </div>
              ) : isError ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-destructive">Não conseguimos carregar os inscritos.</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                    Tentar de novo
                  </Button>
                </div>
              ) : !data?.length ? (
                <p className="rounded-xl bg-muted p-4 text-center text-sm text-muted-foreground">Nenhum inscrito ainda.</p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {data.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{i.nome}</p>
                        <p className="break-all text-sm text-muted-foreground">{i.email}</p>
                        <p className="text-xs text-muted-foreground">Inscrito em {formatarDataHora(i.data_hora_inscricao)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => gestao.abrirDetalhes(alvo(i))}>
                          <Eye aria-hidden /> Detalhes
                        </Button>
                        <Button variant="soft" size="sm" onClick={() => gestao.abrirTroca(alvo(i))}>
                          <ArrowRightLeft aria-hidden /> Trocar aula
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive" onClick={() => gestao.abrirCancelamento(alvo(i))}>
                          <UserX aria-hidden /> Cancelar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {gestao.janelas}
      <AdicionarAlunoDialog aula={adicionar ? aula : null} onClose={() => setAdicionar(false)} />
    </>
  );
}
