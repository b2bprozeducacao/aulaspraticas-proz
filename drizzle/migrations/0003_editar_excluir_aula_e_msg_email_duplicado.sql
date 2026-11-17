CREATE OR REPLACE FUNCTION public.confirmar_inscricao(p_aula_id uuid, p_curso text, p_unidade text, p_tema_da_aula text, p_data date, p_horario text, p_professor text, p_nome text, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_aula public.aulas%ROWTYPE;
  v_email text;
  v_nome text;
  v_ocupadas integer;
  v_id uuid;
  v_msg_dup constant text := 'Este e-mail já está inscrito em uma aula prática. Se precisar trocar de aula, fale com a gente pelo WhatsApp (31) 93618-8054';
BEGIN
  v_nome := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_email := lower(regexp_replace(coalesce(p_email, ''), '\s', '', 'g'));

  IF length(v_nome) > 150 OR array_length(regexp_split_to_array(v_nome, ' '), 1) < 2
     OR length(split_part(v_nome, ' ', 2)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'nome_invalido',
      'mensagem', 'Informe seu nome completo (nome e sobrenome).');
  END IF;

  IF length(v_email) > 255 OR v_email !~ '^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'email_invalido',
      'mensagem', 'Informe um e-mail válido.');
  END IF;

  SELECT * INTO v_aula FROM public.aulas WHERE id = p_aula_id FOR UPDATE;

  IF NOT FOUND
     OR v_aula.curso <> p_curso
     OR v_aula.unidade <> p_unidade
     OR v_aula.tema_da_aula <> p_tema_da_aula
     OR v_aula.data <> p_data
     OR v_aula.horario <> p_horario::time
     OR v_aula.professor <> p_professor THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'aula_indisponivel',
      'mensagem', 'Essa aula não está mais disponível.');
  END IF;

  IF ((v_aula.data + v_aula.horario) AT TIME ZONE 'America/Sao_Paulo') <= now() THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'aula_indisponivel',
      'mensagem', 'Essa aula não está mais disponível.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE email = v_email AND status = 'confirmada') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'email_ja_inscrito', 'mensagem', v_msg_dup);
  END IF;

  SELECT count(*) INTO v_ocupadas FROM public.inscricoes
  WHERE aula_id = v_aula.id AND status = 'confirmada';

  IF v_ocupadas >= v_aula.vagas_totais THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'esgotada',
      'mensagem', 'Poxa, as vagas dessa aula acabaram enquanto você preenchia. Escolha outro horário.');
  END IF;

  BEGIN
    INSERT INTO public.inscricoes (aula_id, nome, email, status)
    VALUES (v_aula.id, v_nome, v_email, 'confirmada')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'email_ja_inscrito', 'mensagem', v_msg_dup);
  END;

  RETURN jsonb_build_object('ok', true, 'inscricao_id', v_id,
    'aula', jsonb_build_object(
      'curso', v_aula.curso, 'unidade', v_aula.unidade, 'tema_da_aula', v_aula.tema_da_aula,
      'data', to_char(v_aula.data, 'DD/MM/YYYY'), 'horario', to_char(v_aula.horario, 'HH24:MI'),
      'professor', v_aula.professor));
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_editar_aula(p_id uuid, p_curso text, p_unidade text, p_tema_da_aula text, p_data date, p_horario time, p_professor text, p_vagas_totais integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ocupadas integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.aulas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Essa aula não existe mais.');
  END IF;
  IF coalesce(btrim(p_curso),'') = '' OR coalesce(btrim(p_unidade),'') = '' OR coalesce(btrim(p_tema_da_aula),'') = ''
     OR coalesce(btrim(p_professor),'') = '' OR p_data IS NULL OR p_horario IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Preencha todos os campos.');
  END IF;
  IF p_vagas_totais IS NULL OR p_vagas_totais < 1 THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'O total de vagas deve ser pelo menos 1.');
  END IF;
  SELECT count(*) INTO v_ocupadas FROM public.inscricoes WHERE aula_id = p_id AND status = 'confirmada';
  IF p_vagas_totais < v_ocupadas THEN
    RETURN jsonb_build_object('ok', false, 'mensagem',
      format('Essa aula já tem %s inscritos. O total de vagas não pode ser menor que isso.', v_ocupadas));
  END IF;
  BEGIN
    UPDATE public.aulas SET curso = btrim(p_curso), unidade = btrim(p_unidade), tema_da_aula = btrim(p_tema_da_aula),
      data = p_data, horario = p_horario, professor = btrim(p_professor), vagas_totais = p_vagas_totais
    WHERE id = p_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Já existe outra aula com esses mesmos dados.');
  END;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_excluir_aula(p_id uuid, p_inscritos_confirmados integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ocupadas integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.aulas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Essa aula já tinha sido excluída.');
  END IF;
  SELECT count(*) INTO v_ocupadas FROM public.inscricoes WHERE aula_id = p_id AND status = 'confirmada';
  IF v_ocupadas <> coalesce(p_inscritos_confirmados, -1) THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'inscritos_mudaram', 'inscritos', v_ocupadas,
      'mensagem', format('O número de inscritos mudou para %s. Confira e confirme de novo.', v_ocupadas));
  END IF;
  DELETE FROM public.aulas WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'removidos', v_ocupadas);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_editar_aula(uuid, text, text, text, date, time, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_excluir_aula(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_editar_aula(uuid, text, text, text, date, time, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_excluir_aula(uuid, integer) TO authenticated;