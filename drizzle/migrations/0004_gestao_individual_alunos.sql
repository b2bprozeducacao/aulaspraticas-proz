CREATE TABLE public.historico_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('troca', 'cancelamento', 'inscricao_manual')),
  admin_id uuid,
  admin_email text,
  aluno_nome text NOT NULL,
  aluno_email text NOT NULL,
  aula_antiga_id uuid,
  aula_antiga text,
  aula_nova_id uuid,
  aula_nova text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historico_admin_inscricao_idx ON public.historico_admin (inscricao_id, created_at DESC);

GRANT SELECT ON public.historico_admin TO authenticated;
GRANT ALL ON public.historico_admin TO service_role;
ALTER TABLE public.historico_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin lê histórico" ON public.historico_admin
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Inscrições só mudam por funções do banco
DROP POLICY IF EXISTS "Admin atualiza inscrições" ON public.inscricoes;
DROP POLICY IF EXISTS "Admin remove inscrições" ON public.inscricoes;
REVOKE INSERT, UPDATE, DELETE ON public.inscricoes FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.descrever_aula(p_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT format('%s — %s, %s, %s às %s (Prof. %s)', a.tema_da_aula, a.curso, a.unidade,
    to_char(a.data, 'DD/MM/YYYY'), to_char(a.horario, 'HH24:MI'), a.professor)
  FROM public.aulas a WHERE a.id = p_id
$$;
REVOKE ALL ON FUNCTION public.descrever_aula(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_admin_atual()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT email::text FROM auth.users WHERE id = auth.uid() $$;
REVOKE ALL ON FUNCTION public.email_admin_atual() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trocar_aula_inscricao(p_inscricao_id uuid, p_nova_aula_id uuid, p_motivo text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_insc public.inscricoes%ROWTYPE;
  v_antiga uuid;
  v_nova public.aulas%ROWTYPE;
  v_ocupadas integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT aula_id INTO v_antiga FROM public.inscricoes WHERE id = p_inscricao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Inscrição não encontrada.');
  END IF;
  IF v_antiga = p_nova_aula_id THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'O aluno já está nessa aula.');
  END IF;

  -- Trava as duas aulas sempre na mesma ordem para evitar impasse
  PERFORM 1 FROM public.aulas WHERE id IN (v_antiga, p_nova_aula_id) ORDER BY id FOR UPDATE;

  SELECT * INTO v_insc FROM public.inscricoes WHERE id = p_inscricao_id FOR UPDATE;
  IF NOT FOUND OR v_insc.status <> 'confirmada' THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Essa inscrição não está mais ativa.');
  END IF;
  IF v_insc.aula_id <> v_antiga THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'A inscrição mudou enquanto você escolhia. Atualize e tente de novo.');
  END IF;

  SELECT * INTO v_nova FROM public.aulas WHERE id = p_nova_aula_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'A nova aula não existe mais.');
  END IF;
  IF ((v_nova.data + v_nova.horario) AT TIME ZONE 'America/Sao_Paulo') <= now() THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'A nova aula já aconteceu.');
  END IF;
  SELECT count(*) INTO v_ocupadas FROM public.inscricoes WHERE aula_id = v_nova.id AND status = 'confirmada';
  IF v_ocupadas >= v_nova.vagas_totais THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'A nova aula não tem mais vagas.');
  END IF;

  UPDATE public.inscricoes SET aula_id = v_nova.id WHERE id = v_insc.id;

  INSERT INTO public.historico_admin (inscricao_id, acao, admin_id, admin_email, aluno_nome, aluno_email,
    aula_antiga_id, aula_antiga, aula_nova_id, aula_nova, motivo)
  VALUES (v_insc.id, 'troca', auth.uid(), public.email_admin_atual(), v_insc.nome, v_insc.email,
    v_antiga, public.descrever_aula(v_antiga), v_nova.id, public.descrever_aula(v_nova.id),
    nullif(btrim(left(coalesce(p_motivo, ''), 500)), ''));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancelar_inscricao(p_inscricao_id uuid, p_motivo text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_insc public.inscricoes%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_insc FROM public.inscricoes WHERE id = p_inscricao_id FOR UPDATE;
  IF NOT FOUND OR v_insc.status <> 'confirmada' THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Essa inscrição não está mais ativa.');
  END IF;
  UPDATE public.inscricoes SET status = 'cancelada' WHERE id = v_insc.id;
  INSERT INTO public.historico_admin (inscricao_id, acao, admin_id, admin_email, aluno_nome, aluno_email,
    aula_antiga_id, aula_antiga, motivo)
  VALUES (v_insc.id, 'cancelamento', auth.uid(), public.email_admin_atual(), v_insc.nome, v_insc.email,
    v_insc.aula_id, public.descrever_aula(v_insc.aula_id), nullif(btrim(left(coalesce(p_motivo, ''), 500)), ''));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_inscrever_aluno(p_aula_id uuid, p_nome text, p_email text, p_motivo text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_aula public.aulas%ROWTYPE;
  v_res jsonb;
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_aula FROM public.aulas WHERE id = p_aula_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'aula_indisponivel', 'mensagem', 'Essa aula não existe mais.');
  END IF;

  -- Mesmas regras da inscrição pública
  v_res := public.confirmar_inscricao(v_aula.id, v_aula.curso, v_aula.unidade, v_aula.tema_da_aula,
    v_aula.data, to_char(v_aula.horario, 'HH24:MI:SS'), v_aula.professor, p_nome, p_email);

  IF NOT (v_res->>'ok')::boolean THEN
    IF v_res->>'codigo' = 'email_ja_inscrito' THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'email_ja_inscrito',
        'mensagem', 'Este e-mail já está inscrito em uma aula prática. Use a busca para trocar a aula dessa pessoa.');
    ELSIF v_res->>'codigo' = 'esgotada' THEN
      RETURN jsonb_build_object('ok', false, 'codigo', 'esgotada', 'mensagem', 'Essa aula não tem mais vagas.');
    END IF;
    RETURN v_res;
  END IF;

  v_id := (v_res->>'inscricao_id')::uuid;
  INSERT INTO public.historico_admin (inscricao_id, acao, admin_id, admin_email, aluno_nome, aluno_email,
    aula_nova_id, aula_nova, motivo)
  SELECT i.id, 'inscricao_manual', auth.uid(), public.email_admin_atual(), i.nome, i.email,
    v_aula.id, public.descrever_aula(v_aula.id), nullif(btrim(left(coalesce(p_motivo, ''), 500)), '')
  FROM public.inscricoes i WHERE i.id = v_id;

  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_buscar_inscricoes(p_termo text)
 RETURNS TABLE(inscricao_id uuid, nome text, email text, data_hora_inscricao timestamptz,
   aula_id uuid, curso text, unidade text, tema_da_aula text, data date, horario time, professor text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_termo text := btrim(coalesce(p_termo, ''));
  v_padrao text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF length(v_termo) < 2 THEN
    RETURN;
  END IF;
  v_padrao := '%' || replace(replace(replace(lower(left(v_termo, 100)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  RETURN QUERY
  SELECT i.id, i.nome, i.email, i.data_hora_inscricao, a.id, a.curso, a.unidade, a.tema_da_aula, a.data, a.horario, a.professor
  FROM public.inscricoes i JOIN public.aulas a ON a.id = i.aula_id
  WHERE i.status = 'confirmada' AND (lower(i.nome) LIKE v_padrao OR i.email LIKE v_padrao)
  ORDER BY i.nome
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_historico_inscricao(p_inscricao_id uuid)
 RETURNS SETOF public.historico_admin
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.historico_admin h WHERE h.inscricao_id = p_inscricao_id ORDER BY h.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.trocar_aula_inscricao(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancelar_inscricao(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_inscrever_aluno(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_buscar_inscricoes(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_historico_inscricao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trocar_aula_inscricao(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancelar_inscricao(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_inscrever_aluno(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_buscar_inscricoes(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_historico_inscricao(uuid) TO authenticated;