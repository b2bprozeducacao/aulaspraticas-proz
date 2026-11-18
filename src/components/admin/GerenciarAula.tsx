import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { formatarData, formatarHorario } from "@/lib/datas";
import type { AulaAdmin } from "./dados";

type Resposta = { ok: boolean; mensagem?: string; inscritos?: number; removidos?: number };

const CAMPOS = [
  { id: "curso", label: "Curso" },
  { id: "unidade", label: "Unidade" },
  { id: "tema_da_aula", label: "Tema da aula" },
  { id: "professor", label: "Professor(a)" },
] as const;

export function EditarAulaDialog({ aula, onClose }: { aula: AulaAdmin | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ curso: "", unidade: "", tema_da_aula: "", professor: "", data: "", horario: "", vagas: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aula) return;
    setErro(null);
    setForm({
      curso: aula.curso,
      unidade: aula.unidade,
      tema_da_aula: aula.tema_da_aula,
      professor: aula.professor,
      data: aula.data,
      horario: formatarHorario(aula.horario),
      vagas: String(aula.vagas_totais),
    });
  }, [aula]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!aula) return;
    const vagas = Number(form.vagas);
    if (!Number.isInteger(vagas) || vagas < 1) {
      setErro("O total de vagas deve ser um número inteiro, pelo menos 1.");
      return;
    }
    if (vagas < aula.vagas_preenchidas) {
      setErro(`Essa aula já tem ${aula.vagas_preenchidas} inscritos. O total de vagas não pode ser menor que isso.`);
      return;
    }
    setSalvando(true);
    setErro(null);
    const { data, error } = await supabase.rpc("admin_editar_aula", {
      p_id: aula.id,
      p_curso: form.curso,
      p_unidade: form.unidade,
      p_tema_da_aula: form.tema_da_aula,
      p_data: form.data,
      p_horario: form.horario,
      p_professor: form.professor,
      p_vagas_totais: vagas,
    });
    setSalvando(false);
    const r = data as unknown as Resposta | null;
    if (error || !r) {
      setErro("Não foi possível salvar agora. Tente de novo.");
      return;
    }
    if (!r.ok) {
      setErro(r.mensagem ?? "Não foi possível salvar.");
      return;
    }
    toast.success("Aula atualizada.");
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    onClose();
  }

  return (
    <Dialog open={!!aula} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-brand">Editar aula</DialogTitle>
          <DialogDescription>
            {aula && aula.vagas_preenchidas > 0
              ? `${aula.vagas_preenchidas} pessoas já estão inscritas. As inscrições continuam valendo após a edição.`
              : "Altere os dados e salve."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="grid gap-4">
          {CAMPOS.map((c) => (
            <div key={c.id} className="grid gap-2">
              <Label htmlFor={`ed-${c.id}`}>{c.label}</Label>
              <Input
                id={`ed-${c.id}`}
                required
                value={form[c.id]}
                onChange={(e) => setForm((f) => ({ ...f, [c.id]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ed-data">Data</Label>
              <Input id="ed-data" type="date" required value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-horario">Horário</Label>
              <Input id="ed-horario" type="time" required value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ed-vagas">Vagas</Label>
              <Input
                id="ed-vagas"
                type="number"
                min={Math.max(1, aula?.vagas_preenchidas ?? 1)}
                required
                value={form.vagas}
                onChange={(e) => setForm((f) => ({ ...f, vagas: e.target.value }))}
              />
            </div>
          </div>
          {erro && <p className="text-sm font-medium text-destructive" role="alert">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="animate-spin" aria-hidden />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ExcluirAulaDialog({ aula, onClose }: { aula: AulaAdmin | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [inscritos, setInscritos] = useState(0);

  useEffect(() => {
    if (!aula) return;
    setAviso(null);
    setInscritos(aula.vagas_preenchidas);
  }, [aula]);

  async function excluir() {
    if (!aula) return;
    setExcluindo(true);
    const { data, error } = await supabase.rpc("admin_excluir_aula", { p_id: aula.id, p_inscritos_confirmados: inscritos });
    setExcluindo(false);
    const r = data as unknown as Resposta | null;
    if (error || !r) {
      toast.error("Não foi possível excluir agora. Tente de novo.");
      return;
    }
    if (!r.ok) {
      // O número de inscritos mudou: atualiza o aviso e pede nova confirmação
      if (typeof r.inscritos === "number") setInscritos(r.inscritos);
      setAviso(r.mensagem ?? "Não foi possível excluir.");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      return;
    }
    toast.success(r.removidos ? `Aula excluída. ${r.removidos} inscrições foram removidas.` : "Aula excluída.");
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    onClose();
  }

  return (
    <AlertDialog open={!!aula} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="grid gap-2">
              {aula && (
                <p>
                  <strong className="text-foreground">{aula.tema_da_aula}</strong> — {aula.curso}, {aula.unidade},{" "}
                  {formatarData(aula.data)} às {formatarHorario(aula.horario)}.
                </p>
              )}
              {inscritos > 0 ? (
                <p className="rounded-xl bg-muted p-3 font-medium text-destructive">
                  {inscritos === 1 ? "1 pessoa está inscrita" : `${inscritos} pessoas estão inscritas`} nesta aula. Ao excluir, as
                  inscrições dessas pessoas também serão apagadas. Exporte a lista antes, se precisar avisá-las.
                </p>
              ) : (
                <p>Esta aula não tem inscritos. Essa ação não pode ser desfeita.</p>
              )}
              {aviso && <p className="font-medium text-destructive" role="alert">{aviso}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              excluir();
            }}
            disabled={excluindo}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {excluindo && <Loader2 className="animate-spin" aria-hidden />}
            {inscritos > 0 ? `Excluir aula e ${inscritos} ${inscritos === 1 ? "inscrição" : "inscrições"}` : "Excluir aula"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
