export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            lookups: {
                Row: {
                    category: string
                    data: NonNullable<Json>
                    key: string
                }
                ComputedFields: never
                Insert: {
                    category: string
                    data?: NonNullable<Json>
                    key: string
                }
                Update: {
                    category?: string
                    data?: NonNullable<Json>
                    key?: string
                }
                Relationships: []
            }
            plans: {
                Row: {
                    billing: string
                    billing_interval: string | null
                    is_active: boolean
                    key: string
                    limits: NonNullable<Json>
                    name: string
                    stripe_price_id: string | null
                }
                ComputedFields: never
                Insert: {
                    billing: string
                    billing_interval?: string | null
                    is_active?: boolean
                    key: string
                    limits: NonNullable<Json>
                    name: string
                    stripe_price_id?: string | null
                }
                Update: {
                    billing?: string
                    billing_interval?: string | null
                    is_active?: boolean
                    key?: string
                    limits?: NonNullable<Json>
                    name?: string
                    stripe_price_id?: string | null
                }
                Relationships: []
            }
            purchases: {
                Row: {
                    amount_cents: number | null
                    created_at: string
                    currency: string | null
                    id: string
                    note: string
                    plan_key: string
                    status: string
                    stripe_checkout_session_id: string | null
                    stripe_payment_intent_id: string | null
                    stripe_subscription_id: string | null
                    type: string
                    updated_at: string
                    user_id: string | null
                    valid_until: string | null
                }
                ComputedFields: never
                Insert: {
                    amount_cents?: number | null
                    created_at?: string
                    currency?: string | null
                    id?: string
                    note?: string
                    plan_key: string
                    status: string
                    stripe_checkout_session_id?: string | null
                    stripe_payment_intent_id?: string | null
                    stripe_subscription_id?: string | null
                    type: string
                    updated_at?: string
                    user_id?: string | null
                    valid_until?: string | null
                }
                Update: {
                    amount_cents?: number | null
                    created_at?: string
                    currency?: string | null
                    id?: string
                    note?: string
                    plan_key?: string
                    status?: string
                    stripe_checkout_session_id?: string | null
                    stripe_payment_intent_id?: string | null
                    stripe_subscription_id?: string | null
                    type?: string
                    updated_at?: string
                    user_id?: string | null
                    valid_until?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'purchases_plan_key_fkey'
                        columns: ['plan_key']
                        isOneToOne: false
                        referencedRelation: 'plans'
                        referencedColumns: ['key']
                    },
                ]
            }
            users: {
                Row: {
                    avatar_url: string | null
                    bio: string
                    created_at: string
                    display_name: string | null
                    id: string
                    updated_at: string
                    username: string | null
                }
                ComputedFields: never
                Insert: {
                    avatar_url?: string | null
                    bio?: string
                    created_at?: string
                    display_name?: string | null
                    id: string
                    updated_at?: string
                    username?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    bio?: string
                    created_at?: string
                    display_name?: string | null
                    id?: string
                    updated_at?: string
                    username?: string | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            billing_upsert: { Args: { p_row: Json }; Returns: undefined }
            my_plan: { Args: Record<PropertyKey, never>; Returns: Json }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
            DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] &
            DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R
        }
          ? R
          : never
      : never

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I
        }
          ? I
          : never
      : never

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends
        | keyof DefaultSchema['Tables']
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U
        }
          ? U
          : never
      : never

export type Enums<
    DefaultSchemaEnumNameOrOptions extends
        | keyof DefaultSchema['Enums']
        | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never

export const Constants = {
    public: {
        Enums: {},
    },
} as const
