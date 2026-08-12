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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asignaciones: {
        Row: {
          created_at: string
          id: string
          institucion_id: string
          proceso_id: string
          profesional_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institucion_id: string
          proceso_id: string
          profesional_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institucion_id?: string
          proceso_id?: string
          profesional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profesionales"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_extra_procesos: {
        Row: {
          clave_campo: string
          etiqueta: string
          id: string
          orden: number
          proceso_id: string
          tipo: string
        }
        Insert: {
          clave_campo: string
          etiqueta: string
          id?: string
          orden: number
          proceso_id: string
          tipo?: string
        }
        Update: {
          clave_campo?: string
          etiqueta?: string
          id?: string
          orden?: number
          proceso_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "campos_extra_procesos_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
        ]
      }
      compromisos: {
        Row: {
          created_at: string
          descripcion: string
          estado: string
          fecha_verificacion: string | null
          id: string
          responsable: string | null
          visita_id: string
        }
        Insert: {
          created_at?: string
          descripcion: string
          estado?: string
          fecha_verificacion?: string | null
          id?: string
          responsable?: string | null
          visita_id: string
        }
        Update: {
          created_at?: string
          descripcion?: string
          estado?: string
          fecha_verificacion?: string | null
          id?: string
          responsable?: string | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromisos_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores: {
        Row: {
          area: string
          aspecto: string
          created_at: string
          criterio: string
          id: string
          orden: number
          proceso_id: string
        }
        Insert: {
          area: string
          aspecto: string
          created_at?: string
          criterio: string
          id?: string
          orden: number
          proceso_id: string
        }
        Update: {
          area?: string
          aspecto?: string
          created_at?: string
          criterio?: string
          id?: string
          orden?: number
          proceso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicadores_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
        ]
      }
      instituciones: {
        Row: {
          created_at: string
          id: string
          nombre: string
          sector: string | null
          sede: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          sector?: string | null
          sede?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          sector?: string | null
          sede?: string | null
        }
        Relationships: []
      }
      procesos: {
        Row: {
          abreviatura: string | null
          clave: string
          consolidado_sheet_id: string | null
          created_at: string
          id: string
          nombre: string
          objetivo_fijo: string | null
          plantilla_doc_id: string | null
        }
        Insert: {
          abreviatura?: string | null
          clave: string
          consolidado_sheet_id?: string | null
          created_at?: string
          id?: string
          nombre: string
          objetivo_fijo?: string | null
          plantilla_doc_id?: string | null
        }
        Update: {
          abreviatura?: string | null
          clave?: string
          consolidado_sheet_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          objetivo_fijo?: string | null
          plantilla_doc_id?: string | null
        }
        Relationships: []
      }
      profesionales: {
        Row: {
          created_at: string
          debe_cambiar_password: boolean
          email: string
          firma_url: string | null
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          created_at?: string
          debe_cambiar_password?: boolean
          email: string
          firma_url?: string | null
          id: string
          nombre: string
          rol: string
        }
        Update: {
          created_at?: string
          debe_cambiar_password?: boolean
          email?: string
          firma_url?: string | null
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: []
      }
      respuestas: {
        Row: {
          calificacion: string
          id: string
          indicador_id: string
          observacion: string | null
          visita_id: string
        }
        Insert: {
          calificacion: string
          id?: string
          indicador_id: string
          observacion?: string | null
          visita_id: string
        }
        Update: {
          calificacion?: string
          id?: string
          indicador_id?: string
          observacion?: string | null
          visita_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respuestas_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "indicadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas: {
        Row: {
          actividad_adicional: string | null
          created_at: string
          datos_adicionales: Json | null
          estado: string
          fecha: string
          firma_url: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          institucion_id: string
          numero_visita: number
          objetivo: string | null
          observaciones: string | null
          pdf_url: string | null
          proceso_id: string
          profesional_id: string
          resultado_semaforo: string | null
          seguimiento_compromisos_anteriores: string | null
          updated_at: string
        }
        Insert: {
          actividad_adicional?: string | null
          created_at?: string
          datos_adicionales?: Json | null
          estado?: string
          fecha: string
          firma_url?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          institucion_id: string
          numero_visita: number
          objetivo?: string | null
          observaciones?: string | null
          pdf_url?: string | null
          proceso_id: string
          profesional_id: string
          resultado_semaforo?: string | null
          seguimiento_compromisos_anteriores?: string | null
          updated_at?: string
        }
        Update: {
          actividad_adicional?: string | null
          created_at?: string
          datos_adicionales?: Json | null
          estado?: string
          fecha?: string
          firma_url?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          institucion_id?: string
          numero_visita?: number
          objetivo?: string | null
          observaciones?: string | null
          pdf_url?: string | null
          proceso_id?: string
          profesional_id?: string
          resultado_semaforo?: string | null
          seguimiento_compromisos_anteriores?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_institucion_id_fkey"
            columns: ["institucion_id"]
            isOneToOne: false
            referencedRelation: "instituciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_proceso_id_fkey"
            columns: ["proceso_id"]
            isOneToOne: false
            referencedRelation: "procesos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_profesional_id_fkey"
            columns: ["profesional_id"]
            isOneToOne: false
            referencedRelation: "profesionales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      actualizar_mi_firma: { Args: { p_firma_url: string }; Returns: undefined }
      is_administrador: { Args: never; Returns: boolean }
      is_coordinador: { Args: never; Returns: boolean }
      marcar_password_cambiada: { Args: never; Returns: undefined }
      reordenar_indicadores: { Args: { p_cambios: Json }; Returns: undefined }
      siguiente_numero_visita: {
        Args: { p_institucion: string; p_proceso: string }
        Returns: number
      }
      ultimas_conexiones: {
        Args: never
        Returns: {
          profesional_id: string
          ultima_conexion: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
