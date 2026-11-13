import { supabase } from "@/integrations/supabase/client";
import { formatarData, formatarDataHora, formatarHorario } from "@/lib/datas";
import type { LinhaExport } from "@/lib/csv-export";

export type AulaAdmin = {
  id: string;
  curso: string;
  unidade: string;
  tema_da_aula: string;
  data: string;
  horario: string;
  professor: string;
  vagas_totais: number;
  vagas_preenchidas: number;
  vagas_restantes: number;
};

export type InscricaoAdmin = {
  id: string;
  aula_id: string;
  nome: string;
  email: string;
  data_hora_inscricao: string;
  status: string;
  aulas: {
    curso: string;
    unidade: string;
    tema_da_aula: string;
    data: string;
    horario: string;
    professor: string;
  } | null;
};

export const aulasAdminQuery = {
  queryKey: ["admin", "aulas"],
  queryFn: async (): Promise<AulaAdmin[]> => {
    const { data, error } = await supabase.rpc("admin_listar_aulas");
    if (error) throw error;
    return (data ?? []) as AulaAdmin[];
  },
};

const PAGINA = 1000;

/** Busca inscrições confirmadas (todas ou de uma aula), paginando além do limite de 1000. */
export async function buscarInscricoesConfirmadas(aulaId?: string): Promise<InscricaoAdmin[]> {
  const todas: InscricaoAdmin[] = [];
  for (let de = 0; ; de += PAGINA) {
    let q = supabase
      .from("inscricoes")
      .select("id, aula_id, nome, email, data_hora_inscricao, status, aulas(curso, unidade, tema_da_aula, data, horario, professor)")
      .eq("status", "confirmada")
      .order("data_hora_inscricao", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (aulaId) q = q.eq("aula_id", aulaId);
    const { data, error } = await q;
    if (error) throw error;
    todas.push(...((data ?? []) as InscricaoAdmin[]));
    if (!data || data.length < PAGINA) break;
  }
  return todas;
}

export function paraLinhaExport(i: InscricaoAdmin): LinhaExport {
  const a = i.aulas;
  return [
    a?.curso ?? "",
    a?.unidade ?? "",
    a?.tema_da_aula ?? "",
    a ? formatarData(a.data) : "",
    a ? formatarHorario(a.horario) : "",
    a?.professor ?? "",
    i.nome,
    i.email,
    formatarDataHora(i.data_hora_inscricao),
  ];
}

export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
