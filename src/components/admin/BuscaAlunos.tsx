import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Eye, Loader2, Search, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { descreverAula, useGestaoAluno, type AlunoAlvo } from "./GestaoAluno";

type Linha = {
  inscricao_id: string;
  nome: string;
  email: string;
  data_hora_inscricao: string;
  aula_id: string;
  curso: string;
  unidade: string;
  tema_da_aula: string;
  data: string;
  horario: string;
  professor: string;
};

function paraAlvo(l: Linha): AlunoAlvo {
  return {
    inscricao_id: l.inscricao_id,
    nome: l.nome,
    email: l.email,
    data_hora_inscricao: l.data_hora_inscricao,
    aula: { id: l.aula_id, curso: l.curso, unidade: l.unidade, tema_da_aula: l.tema_da_aula, data: l.data, horario: l.horario, professor: l.professor },
  };
}

export function BuscaAlunos() {
  const [texto, setTexto] = useState("");
  const [termo, setTermo] = useState("");
  const gestao = useGestaoAluno();

  useEffect(() => {
    const t = setTimeout(() => setTermo(texto.trim()), 300);
    return () => clearTimeout(t);
  }, [texto]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin", "busca", termo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_buscar_inscricoes", { p_termo: termo });
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
    enabled: termo.length >= 2,
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card" aria-labelledby="busca-titulo">
      <Label id="busca-titulo" htmlFor="busca-aluno">Buscar aluno em todas as aulas</Label>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="busca-aluno" className="pl-9" placeholder="Nome ou e-mail" value={texto} onChange={(e) => setTexto(e.target.value)} />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>

      {termo.length >= 2 && !isFetching && (
        isError ? (
          <p className="mt-3 text-sm text-destructive">Não conseguimos buscar agora.</p>
        ) : !data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma inscrição ativa encontrada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {data.map((l) => {
              const alvo = paraAlvo(l);
              return (
                <li key={l.inscricao_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{l.nome}</p>
                    <p className="break-all text-sm text-muted-foreground">{l.email}</p>
                    <p className="text-xs text-muted-foreground">{descreverAula(alvo.aula)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => gestao.abrirDetalhes(alvo)}><Eye aria-hidden /> Detalhes</Button>
                    <Button variant="soft" size="sm" onClick={() => gestao.abrirTroca(alvo)}><ArrowRightLeft aria-hidden /> Trocar aula</Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => gestao.abrirCancelamento(alvo)}><UserX aria-hidden /> Cancelar</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
      {gestao.janelas}
    </section>
  );
}
