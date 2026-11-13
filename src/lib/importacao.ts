import { parseDataBR, parseHorario } from "./datas";

export const COLUNAS_OBRIGATORIAS = [
  "curso",
  "unidade",
  "tema_da_aula",
  "data",
  "horario",
  "professor",
  "vagas_totais",
] as const;

export type AulaImportada = {
  curso: string;
  unidade: string;
  tema_da_aula: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM
  professor: string;
  vagas_totais: number;
};

export type LinhaComErro = { linha: number; erros: string[]; valores: Record<string, string> };

export type ResultadoImportacao = {
  validas: AulaImportada[];
  invalidas: LinhaComErro[];
  colunasFaltando: string[];
};

/** "Tema da Aula" / "horário" / "Vagas totais" -> "tema_da_aula" / "horario" / "vagas_totais" */
export function normalizarCabecalho(c: string): string {
  return c
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function validarLinhas(linhas: Record<string, unknown>[]): ResultadoImportacao {
  const normalizadas = linhas.map((l) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(l)) out[normalizarCabecalho(k)] = String(v ?? "").trim();
    return out;
  });

  const presentes = new Set(normalizadas.flatMap((l) => Object.keys(l)));
  const colunasFaltando = COLUNAS_OBRIGATORIAS.filter((c) => !presentes.has(c));
  if (colunasFaltando.length) return { validas: [], invalidas: [], colunasFaltando };

  const validas: AulaImportada[] = [];
  const invalidas: LinhaComErro[] = [];
  const vistas = new Set<string>();

  normalizadas.forEach((l, i) => {
    const linha = i + 2; // linha 1 = cabeçalho
    if (COLUNAS_OBRIGATORIAS.every((c) => !l[c])) return; // linha vazia
    const erros: string[] = [];
    for (const c of ["curso", "unidade", "tema_da_aula", "professor"] as const) {
      if (!l[c]) erros.push(`"${c}" vazio`);
    }
    const data = parseDataBR(l.data ?? "");
    if (!data) erros.push(`data inválida ("${l.data ?? ""}") — use DD/MM/AAAA`);
    const horario = parseHorario(l.horario ?? "");
    if (!horario) erros.push(`horário inválido ("${l.horario ?? ""}") — use HH:MM`);
    const vagasTxt = l.vagas_totais ?? "";
    const vagas = /^\d+$/.test(vagasTxt) ? Number(vagasTxt) : NaN;
    if (!Number.isInteger(vagas) || vagas < 0) erros.push(`vagas não numéricas ("${vagasTxt}")`);

    if (erros.length) {
      invalidas.push({ linha, erros, valores: l });
      return;
    }
    const aula: AulaImportada = {
      curso: l.curso,
      unidade: l.unidade,
      tema_da_aula: l.tema_da_aula,
      data: data!,
      horario: horario!,
      professor: l.professor,
      vagas_totais: vagas,
    };
    const chave = [aula.curso, aula.unidade, aula.tema_da_aula, aula.data, aula.horario, aula.professor].join("|");
    if (vistas.has(chave)) {
      invalidas.push({ linha, erros: ["aula repetida na planilha"], valores: l });
      return;
    }
    vistas.add(chave);
    validas.push(aula);
  });

  return { validas, invalidas, colunasFaltando: [] };
}
