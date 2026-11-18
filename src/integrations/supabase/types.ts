export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aulas: {
        Row: {
          created_at: string
          curso: string
          data: string
          horario: string
          id: string
          professor: string
          tema_da_aula: string
          unidade: string
          updated_at: string
          vagas_totais: number
        }
        Insert: {
          created_at?: string
          curso: string
          data: string
          horario: string
          id?: string
          professor: string
          tema_da_aula: string
          unidade: string
          updated_at?: string
          vagas_totais: number
        }
        Update: {
          created_at?: string
          curso?: string
          data?: string
          horario?: string
          id?: string
          professor?: string
          tema_da_aula?: string
          unidade?: string
          updated_at?: string
          vagas_totais?: number
        }
        Relationships: []
      }
      historico_admin: {
        Row: {
          acao: string
          admin_email: string | null
          admin_id: string | null
          aluno_email: string
          aluno_nome: string
          aula_antiga: string | null
          aula_antiga_id: string | null
          aula_nova: string | null
          aula_nova_id: string | null
          created_at: string
          id: string
          inscricao_id: string
          motivo: string | null
        }
        Insert: {
          acao: string
          admin_email?: string | null
          admin_id?: string | null
          aluno_email: string
          aluno_nome: string
          aula_antiga?: string | null
          aula_antiga_id?: string | null
          aula_nova?: string | null
          aula_nova_id?: string | null
          created_at?: string
          id?: string
          inscricao_id: string
          motivo?: string | null
        }
        Update: {
          acao?: string
          admin_email?: string | null
          admin_id?: string | null
          aluno_email?: string
          aluno_nome?: string
          aula_antiga?: string | null
          aula_antiga_id?: string | null
          aula_nova?: string | null
          aula_nova_id?: string | null
          created_at?: string
          id?: string
          inscricao_id?: string
          motivo?: string | null
        }
        Relationships: []
      }
      inscricoes: {
        Row: {
          aula_id: string
          data_hora_inscricao: string
          email: string
          id: string
          nome: string
          status: string
        }
        Insert: {
          aula_id: string
          data_hora_inscricao?: string
          email: string
          id?: string
          nome: string
          status?: string
        }
        Update: {
          aula_id?: string
          data_hora_inscricao?: string
          email?: string
          id?: string
          nome?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_buscar_inscricoes: {
        Args: { p_termo: string }
        Returns: {
          aula_id: string
          curso: string
          data: string
          data_hora_inscricao: string
          email: string
          horario: string
          inscricao_id: string
          nome: string
          professor: string
          tema_da_aula: string
          unidade: string
        }[]
      }
      admin_cancelar_inscricao: {
        Args: { p_inscricao_id: string; p_motivo?: string }
        Returns: Json
      }
      admin_editar_aula: {
        Args: {
          p_curso: string
          p_data: string
          p_horario: string
          p_id: string
          p_professor: string
          p_tema_da_aula: string
          p_unidade: string
          p_vagas_totais: number
        }
        Returns: Json
      }
      admin_excluir_aula: {
        Args: { p_id: string; p_inscritos_confirmados: number }
        Returns: Json
      }
      admin_historico_inscricao: {
        Args: { p_inscricao_id: string }
        Returns: {
          acao: string
          admin_email: string | null
          admin_id: string | null
          aluno_email: string
          aluno_nome: string
          aula_antiga: string | null
          aula_antiga_id: string | null
          aula_nova: string | null
          aula_nova_id: string | null
          created_at: string
          id: string
          inscricao_id: string
          motivo: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "historico_admin"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_inscrever_aluno: {
        Args: {
          p_aula_id: string
          p_email: string
          p_motivo?: string
          p_nome: string
        }
        Returns: Json
      }
      admin_listar_aulas: {
        Args: never
        Returns: {
          curso: string
          data: string
          horario: string
          id: string
          professor: string
          tema_da_aula: string
          unidade: string
          vagas_preenchidas: number
          vagas_restantes: number
          vagas_totais: number
        }[]
      }
      confirmar_inscricao: {
        Args: {
          p_aula_id: string
          p_curso: string
          p_data: string
          p_email: string
          p_horario: string
          p_nome: string
          p_professor: string
          p_tema_da_aula: string
          p_unidade: string
        }
        Returns: Json
      }
      descrever_aula: { Args: { p_id: string }; Returns: string }
      email_admin_atual: { Args: never; Returns: string }
      existe_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      listar_aulas_disponiveis: {
        Args: never
        Returns: {
          curso: string
          data: string
          horario: string
          id: string
          professor: string
          tema_da_aula: string
          unidade: string
          vagas_restantes: number
          vagas_totais: number
        }[]
      }
      trocar_aula_inscricao: {
        Args: {
          p_inscricao_id: string
          p_motivo?: string
          p_nova_aula_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
