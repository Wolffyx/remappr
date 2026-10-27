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
            builder_packages: {
                Row: {
                    changelog: string
                    channel: string
                    files: NonNullable<Json>
                    host_api: string
                    published_at: string
                    storage_prefix: string
                    version: string
                }
                ComputedFields: never
                Insert: {
                    changelog?: string
                    channel?: string
                    files: NonNullable<Json>
                    host_api: string
                    published_at?: string
                    storage_prefix: string
                    version: string
                }
                Update: {
                    changelog?: string
                    channel?: string
                    files?: NonNullable<Json>
                    host_api?: string
                    published_at?: string
                    storage_prefix?: string
                    version?: string
                }
                Relationships: []
            }
            content_reports: {
                Row: {
                    comment_id: string | null
                    created_at: string
                    id: string
                    item_id: string | null
                    note: string
                    reason: string
                    reporter_id: string
                    resolved_at: string | null
                    status: string
                }
                ComputedFields: never
                Insert: {
                    comment_id?: string | null
                    created_at?: string
                    id?: string
                    item_id?: string | null
                    note?: string
                    reason: string
                    reporter_id?: string
                    resolved_at?: string | null
                    status?: string
                }
                Update: {
                    comment_id?: string | null
                    created_at?: string
                    id?: string
                    item_id?: string | null
                    note?: string
                    reason?: string
                    reporter_id?: string
                    resolved_at?: string | null
                    status?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'content_reports_comment_id_fkey'
                        columns: ['comment_id']
                        isOneToOne: false
                        referencedRelation: 'item_comments'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'content_reports_item_id_fkey'
                        columns: ['item_id']
                        isOneToOne: false
                        referencedRelation: 'library_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'content_reports_reporter_id_fkey'
                        columns: ['reporter_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            item_comments: {
                Row: {
                    author_id: string | null
                    body: string
                    created_at: string
                    deleted_at: string | null
                    edited_at: string | null
                    id: string
                    item_id: string
                    moderation: string
                    parent_id: string | null
                }
                ComputedFields: never
                Insert: {
                    author_id?: string | null
                    body: string
                    created_at?: string
                    deleted_at?: string | null
                    edited_at?: string | null
                    id?: string
                    item_id: string
                    moderation?: string
                    parent_id?: string | null
                }
                Update: {
                    author_id?: string | null
                    body?: string
                    created_at?: string
                    deleted_at?: string | null
                    edited_at?: string | null
                    id?: string
                    item_id?: string
                    moderation?: string
                    parent_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'item_comments_author_id_fkey'
                        columns: ['author_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'item_comments_item_id_fkey'
                        columns: ['item_id']
                        isOneToOne: false
                        referencedRelation: 'library_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'item_comments_parent_id_fkey'
                        columns: ['parent_id']
                        isOneToOne: false
                        referencedRelation: 'item_comments'
                        referencedColumns: ['id']
                    },
                ]
            }
            item_stars: {
                Row: {
                    created_at: string
                    item_id: string
                    user_id: string
                }
                ComputedFields: never
                Insert: {
                    created_at?: string
                    item_id: string
                    user_id?: string
                }
                Update: {
                    created_at?: string
                    item_id?: string
                    user_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'item_stars_item_id_fkey'
                        columns: ['item_id']
                        isOneToOne: false
                        referencedRelation: 'library_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'item_stars_user_id_fkey'
                        columns: ['user_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            library_item_versions: {
                Row: {
                    changelog: string
                    created_at: string
                    document: NonNullable<Json>
                    git_commit_sha: string | null
                    item_id: string
                    kind: string
                    license: string | null
                    message: string
                    release_no: number | null
                    size_bytes: number
                    version: number
                }
                ComputedFields: never
                Insert: {
                    changelog?: string
                    created_at?: string
                    document: NonNullable<Json>
                    git_commit_sha?: string | null
                    item_id: string
                    kind?: string
                    license?: string | null
                    message?: string
                    release_no?: number | null
                    size_bytes: number
                    version: number
                }
                Update: {
                    changelog?: string
                    created_at?: string
                    document?: NonNullable<Json>
                    git_commit_sha?: string | null
                    item_id?: string
                    kind?: string
                    license?: string | null
                    message?: string
                    release_no?: number | null
                    size_bytes?: number
                    version?: number
                }
                Relationships: [
                    {
                        foreignKeyName: 'library_item_versions_item_id_fkey'
                        columns: ['item_id']
                        isOneToOne: false
                        referencedRelation: 'library_items'
                        referencedColumns: ['id']
                    },
                ]
            }
            library_items: {
                Row: {
                    client_id: string | null
                    comments_count: number
                    created_at: string
                    deleted_at: string | null
                    description: string
                    device_id: string | null
                    downloads_count: number
                    forked_from: string | null
                    forked_license: string | null
                    forked_release: number | null
                    forks_count: number
                    head_version: number
                    id: string
                    identifiers: string[]
                    license: string | null
                    meta: NonNullable<Json>
                    moderation: string
                    name: string
                    owner_id: string
                    published_at: string | null
                    published_version: number | null
                    search: unknown
                    share_hash: string | null
                    share_rev: number
                    stars_count: number
                    summary: string
                    tags: string[]
                    type: string
                    updated_at: string
                    verified: boolean
                    visibility: string
                }
                ComputedFields: never
                Insert: {
                    client_id?: string | null
                    comments_count?: number
                    created_at?: string
                    deleted_at?: string | null
                    description?: string
                    device_id?: string | null
                    downloads_count?: number
                    forked_from?: string | null
                    forked_license?: string | null
                    forked_release?: number | null
                    forks_count?: number
                    head_version?: number
                    id?: string
                    identifiers?: string[]
                    license?: string | null
                    meta?: NonNullable<Json>
                    moderation?: string
                    name: string
                    owner_id: string
                    published_at?: string | null
                    published_version?: number | null
                    search?: unknown
                    share_hash?: string | null
                    share_rev?: number
                    stars_count?: number
                    summary?: string
                    tags?: string[]
                    type: string
                    updated_at?: string
                    verified?: boolean
                    visibility?: string
                }
                Update: {
                    client_id?: string | null
                    comments_count?: number
                    created_at?: string
                    deleted_at?: string | null
                    description?: string
                    device_id?: string | null
                    downloads_count?: number
                    forked_from?: string | null
                    forked_license?: string | null
                    forked_release?: number | null
                    forks_count?: number
                    head_version?: number
                    id?: string
                    identifiers?: string[]
                    license?: string | null
                    meta?: NonNullable<Json>
                    moderation?: string
                    name?: string
                    owner_id?: string
                    published_at?: string | null
                    published_version?: number | null
                    search?: unknown
                    share_hash?: string | null
                    share_rev?: number
                    stars_count?: number
                    summary?: string
                    tags?: string[]
                    type?: string
                    updated_at?: string
                    verified?: boolean
                    visibility?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'library_items_device_id_fkey'
                        columns: ['device_id']
                        isOneToOne: false
                        referencedRelation: 'library_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'library_items_forked_from_fkey'
                        columns: ['forked_from']
                        isOneToOne: false
                        referencedRelation: 'library_items'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'library_items_owner_id_fkey'
                        columns: ['owner_id']
                        isOneToOne: false
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            licensed_devices: {
                Row: {
                    activated_at: string
                    device_pub_hash: string
                    id: string
                    label: string
                    last_seen_at: string
                    machine_hash: string | null
                    platform: string
                    revoked_at: string | null
                    user_id: string
                }
                ComputedFields: never
                Insert: {
                    activated_at?: string
                    device_pub_hash: string
                    id?: string
                    label?: string
                    last_seen_at?: string
                    machine_hash?: string | null
                    platform: string
                    revoked_at?: string | null
                    user_id: string
                }
                Update: {
                    activated_at?: string
                    device_pub_hash?: string
                    id?: string
                    label?: string
                    last_seen_at?: string
                    machine_hash?: string | null
                    platform?: string
                    revoked_at?: string | null
                    user_id?: string
                }
                Relationships: []
            }
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
            account_export: { Args: { p_user: string }; Returns: Json }
            account_prepare_delete: {
                Args: { p_user: string }
                Returns: string[]
            }
            billing_upsert: { Args: { p_row: Json }; Returns: undefined }
            collection_members: {
                Args: { p_collection: string }
                Returns: {
                    item_id: string
                    name: string
                    note: string
                    ord: number
                    owner_username: string
                    type: string
                }[]
            }
            create_item: {
                Args: { p_document: Json; p_item: Json }
                Returns: string
            }
            deactivate_device: { Args: { p_id: string }; Returns: undefined }
            delete_comment: { Args: { p_comment: string }; Returns: undefined }
            delete_item: { Args: { p_item: string }; Returns: undefined }
            dismiss_reports: {
                Args: { p_id: string; p_target: string }
                Returns: undefined
            }
            fork_item: {
                Args: { p_item: string; p_token: string }
                Returns: string
            }
            get_share_token: { Args: { p_item: string }; Returns: string }
            get_shared_item: {
                Args: { p_token: string }
                Returns: {
                    document: Json
                    id: string
                    license: string
                    name: string
                    owner_username: string
                    release_no: number
                    summary: string
                    type: string
                }[]
            }
            health: { Args: Record<PropertyKey, never>; Returns: boolean }
            hide_comment: { Args: { p_comment: string }; Returns: undefined }
            license_register_device: {
                Args: {
                    p_device: string
                    p_machine: string
                    p_meta: Json
                    p_user: string
                }
                Returns: boolean
            }
            license_state: {
                Args: { p_device: string; p_user: string }
                Returns: Json
            }
            log_package_download: {
                Args: { p_entry: Json }
                Returns: undefined
            }
            match_devices: {
                Args: { p_identifiers: Json }
                Returns: {
                    device_id: string
                    score: number
                }[]
            }
            moderate: {
                Args: { p_id: string; p_status: string; p_target: string }
                Returns: undefined
            }
            moderation_queue: {
                Args: Record<PropertyKey, never>
                Returns: {
                    body: string
                    first_reported: string
                    id: string
                    item_id: string
                    moderation: string
                    notes: string[]
                    owner_username: string
                    reasons: string[]
                    reports: number
                    target: string
                    title: string
                }[]
            }
            my_plan: { Args: Record<PropertyKey, never>; Returns: Json }
            my_usage: { Args: Record<PropertyKey, never>; Returns: Json }
            package_download_allowed: {
                Args: { p_user: string }
                Returns: boolean
            }
            publish_item: {
                Args: {
                    p_changelog: string
                    p_item: string
                    p_license: string
                    p_visibility: string
                }
                Returns: number
            }
            record_download: { Args: { p_item: string }; Returns: undefined }
            register_builder_package: {
                Args: { p_pkg: Json }
                Returns: undefined
            }
            rotate_share_token: { Args: { p_item: string }; Returns: string }
            save_device_backup: { Args: { p_backup: Json }; Returns: string }
            save_item: {
                Args: {
                    p_base_version: number
                    p_changes: Json
                    p_item: string
                }
                Returns: number
            }
            search_items: {
                Args: {
                    p_filters: Json
                    p_page: number
                    p_query: string
                    p_sort: string
                }
                Returns: {
                    device_kind: string
                    downloads: number
                    id: string
                    license: string
                    name: string
                    owner_username: string
                    published_at: string
                    stars: number
                    summary: string
                    tags: string[]
                    target: string
                    type: string
                }[]
            }
            sync_pull: {
                Args: { p_since: string }
                Returns: {
                    client_id: string
                    deleted_at: string
                    head_version: number
                    id: string
                    name: string
                    type: string
                    updated_at: string
                }[]
            }
            unpublish_item: { Args: { p_item: string }; Returns: undefined }
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
