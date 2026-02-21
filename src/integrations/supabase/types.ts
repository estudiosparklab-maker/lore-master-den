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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      character_sheets: {
        Row: {
          age: string | null
          alignment_law: string | null
          alignment_moral: string | null
          armor: number
          back: string | null
          backpack_items: string[] | null
          backpack_max_load: number
          belt: string | null
          boots: string | null
          charisma: number
          class: Database["public"]["Enums"]["character_class"] | null
          constitution: number
          copper: number
          created_at: string
          current_hp: number
          defense: number
          gold: number
          heavy_cutting_weapons: number
          height: string | null
          history: string | null
          hit_points: number
          horses: number
          icon_url: string | null
          id: string
          intelligence: number
          left_hand: string | null
          legs: string | null
          level: number
          light_cutting_weapons: number
          long_bows: number
          mana: number
          mount_items: string[] | null
          mount_max_load: number
          mount_name: string | null
          name: string
          others: number
          potions: number
          race: Database["public"]["Enums"]["character_race"] | null
          reflexes: number
          resistance: number
          right_hand: string | null
          short_bows: number
          silver: number
          spears: number
          stealth: number
          strength: number
          table_id: string
          torso: string | null
          traps: number
          user_id: string
          weight: string | null
          wisdom: number
          xp: number
        }
        Insert: {
          age?: string | null
          alignment_law?: string | null
          alignment_moral?: string | null
          armor?: number
          back?: string | null
          backpack_items?: string[] | null
          backpack_max_load?: number
          belt?: string | null
          boots?: string | null
          charisma?: number
          class?: Database["public"]["Enums"]["character_class"] | null
          constitution?: number
          copper?: number
          created_at?: string
          current_hp?: number
          defense?: number
          gold?: number
          heavy_cutting_weapons?: number
          height?: string | null
          history?: string | null
          hit_points?: number
          horses?: number
          icon_url?: string | null
          id?: string
          intelligence?: number
          left_hand?: string | null
          legs?: string | null
          level?: number
          light_cutting_weapons?: number
          long_bows?: number
          mana?: number
          mount_items?: string[] | null
          mount_max_load?: number
          mount_name?: string | null
          name: string
          others?: number
          potions?: number
          race?: Database["public"]["Enums"]["character_race"] | null
          reflexes?: number
          resistance?: number
          right_hand?: string | null
          short_bows?: number
          silver?: number
          spears?: number
          stealth?: number
          strength?: number
          table_id: string
          torso?: string | null
          traps?: number
          user_id: string
          weight?: string | null
          wisdom?: number
          xp?: number
        }
        Update: {
          age?: string | null
          alignment_law?: string | null
          alignment_moral?: string | null
          armor?: number
          back?: string | null
          backpack_items?: string[] | null
          backpack_max_load?: number
          belt?: string | null
          boots?: string | null
          charisma?: number
          class?: Database["public"]["Enums"]["character_class"] | null
          constitution?: number
          copper?: number
          created_at?: string
          current_hp?: number
          defense?: number
          gold?: number
          heavy_cutting_weapons?: number
          height?: string | null
          history?: string | null
          hit_points?: number
          horses?: number
          icon_url?: string | null
          id?: string
          intelligence?: number
          left_hand?: string | null
          legs?: string | null
          level?: number
          light_cutting_weapons?: number
          long_bows?: number
          mana?: number
          mount_items?: string[] | null
          mount_max_load?: number
          mount_name?: string | null
          name?: string
          others?: number
          potions?: number
          race?: Database["public"]["Enums"]["character_race"] | null
          reflexes?: number
          resistance?: number
          right_hand?: string | null
          short_bows?: number
          silver?: number
          spears?: number
          stealth?: number
          strength?: number
          table_id?: string
          torso?: string | null
          traps?: number
          user_id?: string
          weight?: string | null
          wisdom?: number
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_sheets_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          character_name: string | null
          created_at: string
          id: string
          num_dice: number
          num_faces: number
          results: number[]
          table_id: string
          total: number
          user_id: string
        }
        Insert: {
          character_name?: string | null
          created_at?: string
          id?: string
          num_dice?: number
          num_faces?: number
          results?: number[]
          table_id: string
          total?: number
          user_id: string
        }
        Update: {
          character_name?: string | null
          created_at?: string
          id?: string
          num_dice?: number
          num_faces?: number
          results?: number[]
          table_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dice_rolls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      game_tables: {
        Row: {
          created_at: string
          created_by: string
          current_turn_character_id: string | null
          description: string | null
          id: string
          max_level: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_turn_character_id?: string | null
          description?: string | null
          id?: string
          max_level?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_turn_character_id?: string | null
          description?: string | null
          id?: string
          max_level?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_current_turn"
            columns: ["current_turn_character_id"]
            isOneToOne: false
            referencedRelation: "character_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          character_ids: string[] | null
          content: string
          created_at: string
          id: string
          table_id: string
          title: string
          updated_at: string
        }
        Insert: {
          character_ids?: string[] | null
          content?: string
          created_at?: string
          id?: string
          table_id: string
          title: string
          updated_at?: string
        }
        Update: {
          character_ids?: string[] | null
          content?: string
          created_at?: string
          id?: string
          table_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      map_tokens: {
        Row: {
          character_id: string | null
          created_at: string
          hit_points: number | null
          icon_url: string | null
          id: string
          map_id: string
          max_hit_points: number | null
          name: string | null
          token_type: string
          x_position: number
          y_position: number
        }
        Insert: {
          character_id?: string | null
          created_at?: string
          hit_points?: number | null
          icon_url?: string | null
          id?: string
          map_id: string
          max_hit_points?: number | null
          name?: string | null
          token_type?: string
          x_position?: number
          y_position?: number
        }
        Update: {
          character_id?: string | null
          created_at?: string
          hit_points?: number | null
          icon_url?: string | null
          id?: string
          map_id?: string
          max_hit_points?: number | null
          name?: string | null
          token_type?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_tokens_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "character_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_tokens_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "table_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      table_invitations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invited_by: string
          table_id: string
          token: string
          used_by: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by: string
          table_id: string
          token?: string
          used_by?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invited_by?: string
          table_id?: string
          token?: string
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "table_invitations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_maps: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          name: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_maps_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_memberships: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          table_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          table_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_memberships_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_messages: {
        Row: {
          created_at: string
          display_name: string
          id: string
          message: string
          table_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          message: string
          table_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          message?: string
          table_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_messages_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_map_table_master: { Args: { _map_id: string }; Returns: boolean }
      is_map_table_member: { Args: { _map_id: string }; Returns: boolean }
      is_table_master: { Args: { _table_id: string }; Returns: boolean }
      is_table_member: { Args: { _table_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "master" | "player"
      character_class:
        | "Guerreiro"
        | "Assassino"
        | "Paladino"
        | "Monge"
        | "Arqueiro"
        | "Engenheiro"
        | "Mago"
        | "Feiticeiro"
        | "Bruxo"
        | "Necromante"
        | "Xamã"
        | "Bárbaro"
        | "Caçador"
        | "Pirata/Ladrão"
        | "Cavaleiro"
      character_race:
        | "Humano"
        | "Elfo"
        | "Anão"
        | "Fada"
        | "Homem Réptil"
        | "Draconiano"
        | "Orc"
        | "Ogro"
        | "Besta"
        | "Elemental"
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
    Enums: {
      app_role: ["admin", "master", "player"],
      character_class: [
        "Guerreiro",
        "Assassino",
        "Paladino",
        "Monge",
        "Arqueiro",
        "Engenheiro",
        "Mago",
        "Feiticeiro",
        "Bruxo",
        "Necromante",
        "Xamã",
        "Bárbaro",
        "Caçador",
        "Pirata/Ladrão",
        "Cavaleiro",
      ],
      character_race: [
        "Humano",
        "Elfo",
        "Anão",
        "Fada",
        "Homem Réptil",
        "Draconiano",
        "Orc",
        "Ogro",
        "Besta",
        "Elemental",
      ],
    },
  },
} as const
