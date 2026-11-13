import { z } from "zod";

/** E-mail salvo sempre em minúsculas e sem espaços. */
export function normalizarEmail(email: string): string {
  return email.replace(/\s/g, "").toLowerCase();
}

/** Nome completo: obrigatório e com pelo menos duas palavras. */
export function normalizarNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

export function nomeCompletoValido(nome: string): boolean {
  const n = normalizarNome(nome);
  return n.length <= 150 && n.split(" ").filter(Boolean).length >= 2;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function emailValido(email: string): boolean {
  const e = normalizarEmail(email);
  return e.length <= 255 && EMAIL_RE.test(e);
}

export const dadosAlunoSchema = z.object({
  nome: z
    .string()
    .refine((v) => normalizarNome(v).length > 0, "Informe seu nome completo.")
    .refine(nomeCompletoValido, "Informe nome e sobrenome."),
  email: z
    .string()
    .refine((v) => normalizarEmail(v).length > 0, "Informe seu e-mail.")
    .refine(emailValido, "Esse e-mail não parece válido. Confira e tente de novo."),
});

export type DadosAluno = z.infer<typeof dadosAlunoSchema>;
