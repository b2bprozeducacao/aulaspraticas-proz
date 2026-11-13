-- Papéis
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê os próprios papéis" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.existe_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.existe_admin() TO anon, authenticated;

-- O primeiro usuário cadastrado vira admin; os demais não recebem papel.
CREATE OR REPLACE FUNCTION public.atribuir_primeiro_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(918273645);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.atribuir_primeiro_admin();

-- Aulas
CREATE TABLE public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso text NOT NULL,
  unidade text NOT NULL,
  tema_da_aula text NOT NULL,
  data date NOT NULL,
  horario time NOT NULL,
  professor text NOT NULL,
  vagas_totais integer NOT NULL CHECK (vagas_totais >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aulas_unica UNIQUE (curso, unidade, tema_da_aula, data, horario, professor)
);
GRANT SELECT ON public.aulas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aulas TO authenticated;
GRANT ALL ON public.aulas TO service_role;
ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aulas visíveis a todos" ON public.aulas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insere aulas" ON public.aulas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza aulas" ON public.aulas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin remove aulas" ON public.aulas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Inscrições
CREATE TABLE public.inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  data_hora_inscricao timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada', 'cancelada'))
);
CREATE UNIQUE INDEX inscricoes_email_confirmada_unico ON public.inscricoes (email) WHERE status = 'confirmada';
CREATE INDEX inscricoes_aula_idx ON public.inscricoes (aula_id);
GRANT SELECT, UPDATE, DELETE ON public.inscricoes TO authenticated;
GRANT ALL ON public.inscricoes TO service_role;
ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin lê inscrições" ON public.inscricoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin atualiza inscrições" ON public.inscricoes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin remove inscrições" ON public.inscricoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lista pública de aulas futuras com vagas restantes
CREATE OR REPLACE FUNCTION public.listar_aulas_disponiveis()
RETURNS TABLE (
  id uuid, curso text, unidade text, tema_da_aula text, data date, horario time,
  professor text, vagas_totais integer, vagas_restantes integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.curso, a.unidade, a.tema_da_aula, a.data, a.horario, a.professor, a.vagas_totais,
    GREATEST(a.vagas_totais - COALESCE(c.n, 0), 0)::integer AS vagas_restantes
  FROM public.aulas a
  LEFT JOIN (
    SELECT aula_id, count(*)::integer AS n FROM public.inscricoes WHERE status = 'confirmada' GROUP BY aula_id
  ) c ON c.aula_id = a.id
  WHERE ((a.data + a.horario) AT TIME ZONE 'America/Sao_Paulo') > now()
  ORDER BY a.data, a.horario
$$;
GRANT EXECUTE ON FUNCTION public.listar_aulas_disponiveis() TO anon, authenticated;

-- Painel do admin: todas as aulas com preenchidas/restantes
CREATE OR REPLACE FUNCTION public.admin_listar_aulas()
RETURNS TABLE (
  id uuid, curso text, unidade text, tema_da_aula text, data date, horario time,
  professor text, vagas_totais integer, vagas_preenchidas integer, vagas_restantes integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id, a.curso, a.unidade, a.tema_da_aula, a.data, a.horario, a.professor, a.vagas_totais,
    COALESCE(c.n, 0)::integer,
    GREATEST(a.vagas_totais - COALESCE(c.n, 0), 0)::integer
  FROM public.aulas a
  LEFT JOIN (
    SELECT i.aula_id, count(*)::integer AS n FROM public.inscricoes i WHERE i.status = 'confirmada' GROUP BY i.aula_id
  ) c ON c.aula_id = a.id
  ORDER BY a.data, a.horario;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_listar_aulas() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_listar_aulas() TO authenticated;

-- Confirmação de vaga: única transação com todas as validações
CREATE OR REPLACE FUNCTION public.confirmar_inscricao(
  p_aula_id uuid,
  p_curso text,
  p_unidade text,
  p_tema_da_aula text,
  p_data date,
  p_horario text,
  p_professor text,
  p_nome text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aula public.aulas%ROWTYPE;
  v_email text;
  v_nome text;
  v_ocupadas integer;
  v_existente record;
  v_id uuid;
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

  -- Trava a linha da aula para evitar disputa pela última vaga
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

  SELECT a.curso, a.unidade, a.tema_da_aula, a.data, a.horario, a.professor
    INTO v_existente
  FROM public.inscricoes i JOIN public.aulas a ON a.id = i.aula_id
  WHERE i.email = v_email AND i.status = 'confirmada'
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'email_ja_inscrito',
      'mensagem', 'Este e-mail já está inscrito em uma aula prática.',
      'aula_existente', jsonb_build_object(
        'curso', v_existente.curso, 'unidade', v_existente.unidade,
        'tema_da_aula', v_existente.tema_da_aula,
        'data', to_char(v_existente.data, 'DD/MM/YYYY'),
        'horario', to_char(v_existente.horario, 'HH24:MI'),
        'professor', v_existente.professor));
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
    RETURN jsonb_build_object('ok', false, 'codigo', 'email_ja_inscrito',
      'mensagem', 'Este e-mail já está inscrito em uma aula prática.');
  END;

  RETURN jsonb_build_object('ok', true, 'inscricao_id', v_id,
    'aula', jsonb_build_object(
      'curso', v_aula.curso, 'unidade', v_aula.unidade, 'tema_da_aula', v_aula.tema_da_aula,
      'data', to_char(v_aula.data, 'DD/MM/YYYY'), 'horario', to_char(v_aula.horario, 'HH24:MI'),
      'professor', v_aula.professor));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.confirmar_inscricao(uuid, text, text, text, date, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.confirmar_inscricao(uuid, text, text, text, date, text, text, text, text) TO anon, authenticated;
