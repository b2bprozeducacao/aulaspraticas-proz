import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { baixarCsv, gerarCsv } from "@/lib/csv-export";
import { formatarData, formatarDataHora, formatarHorario } from "@/lib/datas";
import { buscarInscricoesConfirmadas, paraLinhaExport, slug, type AulaAdmin, type InscricaoAdmin } from "./dados";

export function InscritosDialog({ aula, onClose }: { aula: AulaAdmin | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cancelar, setCancelar] = useState<InscricaoAdmin | null>(null);
  const [cancelando, setCancelando] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "inscritos", aula?.id],
    queryFn: () => buscarInscricoesConfirmadas(aula!.id),
    enabled: !!aula,
  });

  async function confirmarCancelamento() {
    if (!cancelar) return;
    setCancelando(true);
    const { error } = await supabase.from("inscricoes").update({ status: "cancelada" }).eq("id", cancelar.id);
    setCancelando(false);
    if (error) {
      toast.error("Não foi possível cancelar. Tente de novo.");
      return;
    }
    toast.success(`Inscrição de ${cancelar.nome} cancelada. A vaga foi liberada.`);
    setCancelar(null);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
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
                <Button variant="soft" size="sm" onClick={exportar} disabled={!data?.length}>
                  <Download aria-hidden /> Exportar CSV
                </Button>
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
                      <Button variant="outline" size="sm" onClick={() => setCancelar(i)}>
                        <UserX aria-hidden /> Cancelar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancelar} onOpenChange={(o) => !o && setCancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelar?.nome} ({cancelar?.email}) perde a vaga, que fica livre para outra pessoa. O e-mail poderá se
              inscrever de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelando}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarCancelamento();
              }}
              disabled={cancelando}
            >
              {cancelando && <Loader2 className="animate-spin" aria-hidden />}
              Cancelar inscrição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
