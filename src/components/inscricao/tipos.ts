export type AulaDisponivel = {
  id: string;
  curso: string;
  unidade: string;
  tema_da_aula: string;
  data: string; // YYYY-MM-DD
  horario: string; // HH:MM:SS
  professor: string;
  vagas_totais: number;
  vagas_restantes: number;
};

export type ResumoAula = {
  curso: string;
  unidade: string;
  tema_da_aula: string;
  data: string; // DD/MM/AAAA
  horario: string; // HH:MM
  professor: string;
};

export type RespostaConfirmacao =
  | { ok: true; inscricao_id: string; aula: ResumoAula }
  | {
      ok: false;
      codigo: "nome_invalido" | "email_invalido" | "aula_indisponivel" | "email_ja_inscrito" | "esgotada";
      mensagem: string;
    };

export const ULTIMAS_VAGAS = 3;
