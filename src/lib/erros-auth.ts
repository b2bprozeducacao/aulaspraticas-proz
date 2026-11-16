/** Traduz erros do login/cadastro de admin em mensagens específicas em pt-BR. */
export type ErroAuth = { code?: string; message?: string; status?: number };

export function mensagemErroAuth(erro: ErroAuth | null | undefined): string {
  const code = erro?.code ?? "";
  const msg = (erro?.message ?? "").toLowerCase();

  if (code === "weak_password" || /password should|weak password|pwned|leaked/.test(msg))
    return "Senha fraca. Use pelo menos 8 caracteres, misturando letras, números e símbolos, e evite senhas comuns.";
  if (code === "user_already_exists" || code === "email_exists" || /already registered|already exists/.test(msg))
    return "Este e-mail já está cadastrado. Use a opção Entrar.";
  if (code === "email_address_invalid" || (code === "validation_failed" && /email/.test(msg)) || /invalid format|unable to validate email/.test(msg))
    return "E-mail inválido. Confira se está escrito certo, sem acentos ou espaços (ex.: nome@proz.com.br).";
  if (code === "signup_disabled" || /signups not allowed/.test(msg))
    return "O cadastro de novas contas está desativado. Peça acesso à administradora.";
  if (code === "over_email_send_rate_limit" || /email rate limit/.test(msg))
    return "Muitos e-mails enviados em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (code === "over_request_rate_limit" || erro?.status === 429)
    return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (code === "invalid_credentials" || /invalid login/.test(msg)) return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed" || /not confirmed/.test(msg))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  return "Não foi possível continuar agora. Tente de novo.";
}
