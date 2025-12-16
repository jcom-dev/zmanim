table "actions" {
  schema = schema.public
  column "id" {
    null    = false
    type    = uuid
    default = sql("gen_random_uuid()")
  }
  column "action_type" {
    null = false
    type = character_varying(50)
  }
  column "concept" {
    null = false
    type = character_varying(50)
  }
  column "user_id" {
    null = true
    type = text
  }
  column "publisher_id" {
    null = true
    type = integer
  }
  column "request_id" {
    null = false
    type = uuid
  }
  column "parent_action_id" {
    null = true
    type = uuid
  }
  column "entity_type" {
    null = true
    type = character_varying(50)
  }
  column "entity_id" {
    null = true
    type = text
  }
  column "payload" {
    null = true
    type = jsonb
  }
  column "result" {
    null = true
    type = jsonb
  }
  column "status" {
    null    = true
    type    = character_varying(20)
    default = "pending"
  }
  column "error_message" {
    null = true
    type = text
  }
  column "started_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "completed_at" {
    null = true
    type = timestamptz
  }
  column "duration_ms" {
    null = true
    type = integer
  }
  column "metadata" {
    null = true
    type = jsonb
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_parent_action" {
    columns     = [column.parent_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_actions_action_type" {
    columns = [column.action_type]
  }
  index "idx_actions_entity" {
    columns = [column.entity_type, column.entity_id]
  }
  index "idx_actions_parent" {
    columns = [column.parent_action_id]
    where   = "(parent_action_id IS NOT NULL)"
  }
  index "idx_actions_publisher_id" {
    columns = [column.publisher_id]
  }
  index "idx_actions_request_id" {
    columns = [column.request_id]
  }
  index "idx_actions_started_at" {
    on {
      desc   = true
      column = column.started_at
    }
  }
  index "idx_actions_user_id" {
    columns = [column.user_id]
  }
}
table "ai_audit_logs" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = true
    type = integer
  }
  column "user_id" {
    null = true
    type = text
  }
  column "request_type" {
    null = false
    type = character_varying(50)
  }
  column "input_text" {
    null = true
    type = text
  }
  column "output_text" {
    null = true
    type = text
  }
  column "tokens_used" {
    null    = true
    type    = integer
    default = 0
  }
  column "model" {
    null = true
    type = character_varying(100)
  }
  column "confidence" {
    null = true
    type = numeric(3,3)
  }
  column "success" {
    null    = true
    type    = boolean
    default = true
  }
  column "error_message" {
    null = true
    type = text
  }
  column "duration_ms" {
    null = true
    type = integer
  }
  column "rag_context_used" {
    null    = true
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "ai_audit_logs_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_ai_audit_created" {
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_ai_audit_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_ai_audit_success" {
    columns = [column.success]
  }
  index "idx_ai_audit_type" {
    columns = [column.request_type]
  }
  index "idx_ai_audit_type_created" {
    on {
      column = column.request_type
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_ai_audit_user" {
    columns = [column.user_id]
  }
}
table "ai_content_sources" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  unique "ai_content_sources_key_key" {
    columns = [column.key]
  }
}
table "ai_index_statuses" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "color" {
    null = true
    type = character_varying(7)
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "ai_indexes" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "source_id" {
    null = false
    type = smallint
  }
  column "total_chunks" {
    null    = false
    type    = integer
    default = 0
  }
  column "last_indexed_at" {
    null = true
    type = timestamptz
  }
  column "status_id" {
    null = false
    type = smallint
  }
  column "error_message" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "ai_indexes_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.ai_content_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "ai_indexes_status_id_fkey" {
    columns     = [column.status_id]
    ref_columns = [table.ai_index_statuses.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  unique "ai_indexes_source_key" {
    columns = [column.source_id]
  }
}
table "algorithm_rollback_audit" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "algorithm_id" {
    null = false
    type = integer
  }
  column "source_version" {
    null = false
    type = integer
  }
  column "target_version" {
    null = false
    type = integer
  }
  column "new_version" {
    null = false
    type = integer
  }
  column "reason" {
    null = true
    type = text
  }
  column "rolled_back_by" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_rollback_audit_algorithm" {
    columns     = [column.algorithm_id]
    ref_columns = [table.algorithms.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_algorithm_rollback_audit_algorithm_id" {
    on {
      column = column.algorithm_id
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
}
table "algorithm_statuses" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "color" {
    null = true
    type = character_varying(7)
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_algorithm_statuses_key" {
    columns = [column.key]
  }
}
table "algorithm_templates" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "template_key" {
    null = false
    type = text
  }
  column "name" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "configuration" {
    null = false
    type = jsonb
  }
  column "sort_order" {
    null    = false
    type    = integer
    default = 0
  }
  column "is_active" {
    null    = false
    type    = boolean
    default = true
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_algorithm_templates_active" {
    columns = [column.is_active]
    where   = "(is_active = true)"
  }
  index "idx_algorithm_templates_key" {
    columns = [column.template_key]
  }
  unique "algorithm_templates_template_key_key" {
    columns = [column.template_key]
  }
}
table "algorithm_version_history" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "algorithm_id" {
    null = false
    type = integer
  }
  column "version_number" {
    null = false
    type = integer
  }
  column "status" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "config_snapshot" {
    null = false
    type = jsonb
  }
  column "created_by" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "published_at" {
    null = true
    type = timestamptz
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_algorithm_version_history_algorithm" {
    columns     = [column.algorithm_id]
    ref_columns = [table.algorithms.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_algorithm_version_history_algorithm_id" {
    columns = [column.algorithm_id]
  }
  index "idx_algorithm_version_history_version_number" {
    on {
      column = column.algorithm_id
    }
    on {
      desc   = true
      column = column.version_number
    }
  }
  unique "uq_algorithm_version" {
    columns = [column.algorithm_id, column.version_number]
  }
}
table "algorithms" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "name" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "configuration" {
    null = true
    type = jsonb
  }
  column "status_id" {
    null = true
    type = smallint
  }
  column "is_public" {
    null    = true
    type    = boolean
    default = false
  }
  column "forked_from" {
    null = true
    type = integer
  }
  column "attribution_text" {
    null = true
    type = text
  }
  column "fork_count" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_by_action_id" {
    null = true
    type = uuid
  }
  column "updated_by_action_id" {
    null = true
    type = uuid
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "algorithms_forked_from_fkey" {
    columns     = [column.forked_from]
    ref_columns = [table.algorithms.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "algorithms_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "algorithms_status_id_fkey" {
    columns     = [column.status_id]
    ref_columns = [table.algorithm_statuses.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "fk_created_by_action_algo" {
    columns     = [column.created_by_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "fk_updated_by_action_algo" {
    columns     = [column.updated_by_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_algorithms_forked_from" {
    columns = [column.forked_from]
    where   = "(forked_from IS NOT NULL)"
  }
  index "idx_algorithms_public" {
    columns = [column.is_public]
    where   = "(is_public = true)"
  }
  index "idx_algorithms_publisher_id" {
    columns = [column.publisher_id]
  }
  index "idx_algorithms_publisher_status" {
    columns = [column.publisher_id, column.status_id]
  }
  index "idx_algorithms_publisher_status_created" {
    on {
      column = column.publisher_id
    }
    on {
      column = column.status_id
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_algorithms_status" {
    columns = [column.status_id]
  }
}
table "astronomical_primitives" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "variable_name" {
    null = false
    type = character_varying(50)
  }
  column "display_name" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "formula_dsl" {
    null = false
    type = text
  }
  column "category_id" {
    null = false
    type = smallint
  }
  column "calculation_type_id" {
    null = false
    type = smallint
  }
  column "solar_angle" {
    null = true
    type = numeric(5,2)
  }
  column "is_dawn" {
    null = true
    type = boolean
  }
  column "edge_type_id" {
    null = true
    type = smallint
  }
  column "sort_order" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "astronomical_primitives_calculation_type_id_fkey" {
    columns     = [column.calculation_type_id]
    ref_columns = [table.calculation_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "astronomical_primitives_category_id_fkey" {
    columns     = [column.category_id]
    ref_columns = [table.primitive_categories.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "astronomical_primitives_edge_type_id_fkey" {
    columns     = [column.edge_type_id]
    ref_columns = [table.edge_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_astronomical_primitives_category" {
    columns = [column.category_id]
  }
  index "idx_astronomical_primitives_variable_name" {
    columns = [column.variable_name]
  }
  unique "astronomical_primitives_variable_name_key" {
    columns = [column.variable_name]
  }
}
table "blocked_emails" {
  schema  = schema.public
  comment = "Permanently blocked email addresses. Submissions silently ignored."
  column "id" {
    null = false
    type = serial
  }
  column "email" {
    null = false
    type = text
  }
  column "blocked_by" {
    null    = false
    type    = text
    comment = "Admin clerk_user_id who blocked the email"
  }
  column "blocked_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "reason" {
    null    = true
    type    = text
    comment = "Optional note explaining why email was blocked"
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_blocked_emails_email_lower" {
    unique = true
    on {
      expr = "lower(email)"
    }
  }
}
table "calculation_logs" {
  schema  = schema.public
  comment = "Records all zmanim calculation requests for analytics. Optimized for high-volume inserts using batch COPY protocol."
  column "id" {
    null = false
    type = bigserial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "city_id" {
    null = false
    type = bigint
  }
  column "date_calculated" {
    null = false
    type = date
  }
  column "cache_hit" {
    null    = false
    type    = boolean
    default = false
    comment = "Whether result was served from Redis cache"
  }
  column "response_time_ms" {
    null    = true
    type    = smallint
    comment = "Total calculation time in milliseconds (includes cache lookup)"
  }
  column "zman_count" {
    null = true
    type = smallint
  }
  column "source" {
    null    = false
    type    = smallint
    comment = "Request source: 1=web UI, 2=authenticated API, 3=external API (M2M)"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "calculation_logs_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_calc_logs_created_brin" {
    columns = [column.created_at]
    type    = BRIN
  }
  index "idx_calc_logs_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_calc_logs_publisher_date" {
    columns = [column.publisher_id, column.date_calculated]
  }
}
table "calculation_stats_daily" {
  schema  = schema.public
  comment = "Pre-aggregated daily statistics for fast dashboard queries. Updated by daily rollup job."
  column "publisher_id" {
    null = false
    type = integer
  }
  column "date" {
    null = false
    type = date
  }
  column "total_calculations" {
    null    = false
    type    = integer
    default = 0
  }
  column "cache_hits" {
    null    = false
    type    = integer
    default = 0
  }
  column "total_response_time_ms" {
    null    = false
    type    = bigint
    default = 0
    comment = "Sum of all response times for average calculation"
  }
  column "source_web" {
    null    = false
    type    = integer
    default = 0
  }
  column "source_api" {
    null    = false
    type    = integer
    default = 0
  }
  column "source_external" {
    null    = false
    type    = integer
    default = 0
  }
  primary_key {
    columns = [column.publisher_id, column.date]
  }
  foreign_key "calculation_stats_daily_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_calc_stats_daily_date" {
    columns = [column.date]
  }
  index "idx_calc_stats_daily_publisher_date" {
    columns = [column.publisher_id, column.date]
  }
}
table "calculation_types" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "location_correction_requests" {
  schema  = schema.public
  comment = "Community-submitted corrections to global locality data"
  column "id" {
    null = false
    type = serial
  }
  column "city_id" {
    null = false
    type = bigint
  }
  column "publisher_id" {
    null    = true
    type    = integer
    comment = "Publisher who submitted the request (nullable for anonymous)"
  }
  column "requester_email" {
    null    = false
    type    = text
    comment = "Email of the person who submitted the request"
  }
  column "requester_name" {
    null = true
    type = text
  }
  column "proposed_latitude" {
    null = true
    type = double_precision
  }
  column "proposed_longitude" {
    null = true
    type = double_precision
  }
  column "proposed_elevation" {
    null = true
    type = integer
  }
  column "correction_reason" {
    null    = false
    type    = text
    comment = "Explanation of why the correction is needed"
  }
  column "evidence_urls" {
    null    = true
    type    = sql("text[]")
    comment = "Links to supporting evidence (surveys, official sources, etc.)"
  }
  column "status" {
    null    = false
    type    = text
    default = "pending"
  }
  column "reviewed_by" {
    null    = true
    type    = text
    comment = "Clerk user ID of admin who reviewed the request"
  }
  column "reviewed_at" {
    null = true
    type = timestamptz
  }
  column "review_notes" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "location_correction_requests_city_id_fkey" {
    columns     = [column.city_id]
    ref_columns = [table.geo_cities.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "location_correction_requests_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_location_correction_requests_pending" {
    where = "(status = 'pending'::text)"
    on {
      column = column.status
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_location_correction_requests_publisher_created" {
    where = "(publisher_id IS NOT NULL)"
    on {
      column = column.publisher_id
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_correction_requests_city" {
    columns = [column.city_id]
  }
  index "idx_correction_requests_created_at" {
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_correction_requests_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_correction_requests_status" {
    columns = [column.status]
  }
  check "at_least_one_proposed_value" {
    expr = "((proposed_latitude IS NOT NULL) OR (proposed_longitude IS NOT NULL) OR (proposed_elevation IS NOT NULL))"
  }
  check "location_correction_requests_status_check" {
    expr = "(status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))"
  }
}
table "coverage_levels" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "sort_order" {
    null = false
    type = smallint
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_coverage_levels_key" {
    columns = [column.key]
  }
}
table "data_types" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "day_types" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "key" {
    null = false
    type = character_varying(100)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "parent_id" {
    null = true
    type = integer
  }
  column "sort_order" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "day_types_parent_id_fkey" {
    columns     = [column.parent_id]
    ref_columns = [table.day_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_day_types_name" {
    columns = [column.key]
  }
  index "idx_day_types_parent" {
    columns = [column.parent_id]
  }
  unique "day_types_name_key" {
    columns = [column.key]
  }
}
table "display_groups" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "key" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = character_varying(100)
  }
  column "display_name_english" {
    null = false
    type = character_varying(100)
  }
  column "description" {
    null = true
    type = character_varying(255)
  }
  column "icon_name" {
    null = true
    type = character_varying(50)
  }
  column "color" {
    null = true
    type = character_varying(50)
  }
  column "sort_order" {
    null = false
    type = integer
  }
  column "time_categories" {
    null = false
    type = sql("text[]")
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_display_groups_key" {
    columns = [column.key]
  }
  index "idx_display_groups_sort" {
    columns = [column.sort_order]
  }
}
table "edge_types" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "embeddings" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "source_id" {
    null = false
    type = smallint
  }
  column "content_type" {
    null = false
    type = character_varying(50)
  }
  column "chunk_index" {
    null = false
    type = integer
  }
  column "content" {
    null = false
    type = text
  }
  column "metadata" {
    null    = true
    type    = jsonb
    default = "{}"
  }
  column "embedding" {
    null = true
    type = sql("public.vector(1536)")
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "embeddings_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.ai_content_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "embeddings_content_type_idx" {
    columns = [column.content_type]
  }
  index "embeddings_source_idx" {
    columns = [column.source_id]
  }
  index "embeddings_vector_idx" {
    type = "ivfflat"
    on {
      column = column.embedding
      ops    = "public.vector_cosine_ops"
    }
  }
  unique "embeddings_source_chunk_index_key" {
    columns = [column.source_id, column.chunk_index]
  }
}
table "event_categories" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "key" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = character_varying(100)
  }
  column "display_name_english" {
    null = false
    type = character_varying(100)
  }
  column "description" {
    null = true
    type = character_varying(255)
  }
  column "icon_name" {
    null = true
    type = character_varying(50)
  }
  column "color" {
    null = true
    type = character_varying(50)
  }
  column "sort_order" {
    null = false
    type = integer
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_event_categories_key" {
    columns = [column.key]
  }
  index "idx_event_categories_sort" {
    columns = [column.sort_order]
  }
  unique "event_categories_key_key" {
    columns = [column.key]
  }
}
table "explanation_cache" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "formula_hash" {
    null = false
    type = character_varying(32)
  }
  column "language" {
    null    = false
    type    = character_varying(10)
    default = "mixed"
  }
  column "explanation" {
    null = false
    type = text
  }
  column "source_id" {
    null = false
    type = smallint
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "expires_at" {
    null = false
    type = timestamptz
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "explanation_cache_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.explanation_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_explanation_cache_expiry" {
    columns = [column.expires_at]
  }
  index "idx_explanation_cache_lookup" {
    columns = [column.formula_hash, column.language]
  }
}
table "explanation_sources" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "fast_start_types" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_fast_start_types_key" {
    columns = [column.key]
  }
}
table "geo_alternative_names" {
  schema  = schema.public
  comment = "Stores common aliases for geographic entities (UK, USA, England, NYC, etc.) for improved search UX"
  column "id" {
    null = false
    type = serial
  }
  column "entity_type" {
    null    = false
    type    = character_varying(20)
    comment = "Type of geographic entity: city, district, region, or country"
  }
  column "entity_id" {
    null    = false
    type    = integer
    comment = "ID of the entity in the corresponding table (no FK constraint for flexibility)"
  }
  column "name" {
    null    = false
    type    = text
    comment = "Original alias name (e.g., \"UK\", \"NYC\")"
  }
  column "name_ascii" {
    null    = false
    type    = text
    comment = "ASCII normalized version for search (generated via normalize_ascii())"
  }
  column "is_common" {
    null    = true
    type    = boolean
    default = false
    comment = "True for very common aliases (used for search ranking boost)"
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_alt_names_common" {
    columns = [column.is_common]
    where   = "(is_common = true)"
  }
  index "idx_alt_names_lookup" {
    columns = [column.entity_type, column.entity_id]
  }
  index "idx_alt_names_trgm" {
    type = GIN
    on {
      column = column.name_ascii
      ops    = "public.gin_trgm_ops"
    }
  }
  check "geo_alternative_names_entity_type_check" {
    expr = "((entity_type)::text = ANY ((ARRAY['city'::character varying, 'district'::character varying, 'region'::character varying, 'country'::character varying])::text[]))"
  }
}
table "geo_boundary_imports" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "source_id" {
    null = false
    type = integer
  }
  column "level_id" {
    null = false
    type = smallint
  }
  column "country_code" {
    null = true
    type = character_varying(2)
  }
  column "version" {
    null = true
    type = text
  }
  column "records_imported" {
    null    = true
    type    = integer
    default = 0
  }
  column "records_matched" {
    null    = true
    type    = integer
    default = 0
  }
  column "records_unmatched" {
    null    = true
    type    = integer
    default = 0
  }
  column "imported_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "notes" {
    null = true
    type = text
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_boundary_imports_level_id_fkey" {
    columns     = [column.level_id]
    ref_columns = [table.geo_levels.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_boundary_imports_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  unique "geo_boundary_imports_source_level_key" {
    columns = [column.source_id, column.level_id, column.country_code]
  }
}
table "geo_cities" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "region_id" {
    null = true
    type = integer
  }
  column "district_id" {
    null = true
    type = integer
  }
  column "name" {
    null = false
    type = text
  }
  column "name_ascii" {
    null = true
    type = text
  }
  column "latitude" {
    null = false
    type = double_precision
  }
  column "longitude" {
    null = false
    type = double_precision
  }
  column "location" {
    null = true
    type = sql("public.geography(Point,4326)")
    as {
      expr = "(public.st_setsrid(public.st_makepoint(longitude, latitude), 4326))::public.geography"
      type = STORED
    }
  }
  column "timezone" {
    null = false
    type = text
  }
  column "elevation_m" {
    null    = true
    type    = integer
    default = 0
  }
  column "population" {
    null = true
    type = integer
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "continent_id" {
    null = true
    type = smallint
  }
  column "country_id" {
    null = true
    type = integer
  }
  column "coordinate_source_id" {
    null = true
    type = integer
  }
  column "elevation_source_id" {
    null = true
    type = integer
  }
  column "source_type_id" {
    null    = true
    type    = integer
    comment = "References geo_data_sources - identifies where this city data came from (WOF, GeoNames, etc.)"
  }
  column "source_id" {
    null    = true
    type    = text
    comment = "External ID from the source system (e.g., WOF ID as text)"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_geo_cities_source_type" {
    columns     = [column.source_type_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_cities_continent_id_fkey" {
    columns     = [column.continent_id]
    ref_columns = [table.geo_continents.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_cities_coordinate_source_id_fkey" {
    columns     = [column.coordinate_source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_cities_country_id_fkey" {
    columns     = [column.country_id]
    ref_columns = [table.geo_countries.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_cities_district_id_fkey" {
    columns     = [column.district_id]
    ref_columns = [table.geo_districts.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_cities_elevation_source_id_fkey" {
    columns     = [column.elevation_source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_cities_region_id_fkey" {
    columns     = [column.region_id]
    ref_columns = [table.geo_regions.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_cities_continent_id" {
    columns = [column.continent_id]
  }
  index "idx_geo_cities_coord_source" {
    columns = [column.coordinate_source_id]
    where   = "((coordinate_source_id)::text <> 'wof'::text)"
  }
  index "idx_geo_cities_country_id" {
    columns = [column.country_id]
  }
  index "idx_geo_cities_country_name" {
    on {
      column = column.country_id
    }
    on {
      column = column.name
    }
    on {
      desc       = true
      column     = column.population
      nulls_last = true
    }
  }
  index "idx_geo_cities_district" {
    columns = [column.district_id]
  }
  index "idx_geo_cities_district_name" {
    where = "(district_id IS NOT NULL)"
    on {
      column = column.district_id
    }
    on {
      column = column.name
    }
    on {
      desc       = true
      column     = column.population
      nulls_last = true
    }
  }
  index "idx_geo_cities_id_location" {
    columns = [column.id]
    include = [column.latitude, column.longitude, column.elevation_m, column.timezone, column.coordinate_source_id, column.elevation_source_id]
  }
  index "idx_geo_cities_location" {
    columns = [column.location]
    type    = GIST
  }
  index "idx_geo_cities_name_ascii_trgm" {
    type = GIN
    on {
      column = column.name_ascii
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_geo_cities_name_population" {
    on {
      column = column.name
    }
    on {
      desc       = true
      column     = column.population
      nulls_last = true
    }
  }
  index "idx_geo_cities_name_trgm" {
    type = GIN
    on {
      column = column.name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_geo_cities_population" {
    on {
      desc       = true
      column     = column.population
      nulls_last = true
    }
  }
  index "idx_geo_cities_region" {
    columns = [column.region_id]
  }
  index "idx_geo_cities_region_name" {
    where = "(region_id IS NOT NULL)"
    on {
      column = column.region_id
    }
    on {
      column = column.name
    }
    on {
      desc       = true
      column     = column.population
      nulls_last = true
    }
  }
  index "idx_geo_cities_source_type" {
    columns = [column.source_type_id]
  }
  index "idx_geo_cities_source_unique" {
    unique  = true
    columns = [column.source_type_id, column.source_id]
    where   = "((source_type_id IS NOT NULL) AND (source_id IS NOT NULL))"
  }
  index "idx_geo_cities_zmanim_lookup" {
    columns = [column.id]
    include = [column.latitude, column.longitude, column.elevation_m, column.timezone, column.coordinate_source_id, column.elevation_source_id]
  }
}
table "geo_city_boundaries" {
  schema = schema.public
  column "city_id" {
    null = false
    type = integer
  }
  column "boundary" {
    null = false
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "boundary_simplified" {
    null = true
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "area_km2" {
    null = true
    type = double_precision
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.city_id]
  }
  foreign_key "geo_city_boundaries_city_id_fkey" {
    columns     = [column.city_id]
    ref_columns = [table.geo_cities.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_city_boundaries_geom" {
    columns = [column.boundary]
    type    = GIST
  }
  index "idx_city_boundaries_simplified" {
    columns = [column.boundary_simplified]
    type    = GIST
  }
}
table "geo_city_coordinates" {
  schema = schema.public
  column "id" {
    null = false
    type = integer
    identity {
      generated = ALWAYS
    }
  }
  column "city_id" {
    null = false
    type = integer
  }
  column "source_id" {
    null = false
    type = integer
  }
  column "external_id" {
    null = true
    type = text
  }
  column "latitude" {
    null = false
    type = double_precision
  }
  column "longitude" {
    null = false
    type = double_precision
  }
  column "accuracy_m" {
    null = true
    type = integer
  }
  column "submitted_by" {
    null = true
    type = text
  }
  column "publisher_id" {
    null = true
    type = integer
  }
  column "verified_at" {
    null = true
    type = timestamptz
  }
  column "verified_by" {
    null = true
    type = text
  }
  column "notes" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_city_coordinates_city_id_fkey" {
    columns     = [column.city_id]
    ref_columns = [table.geo_cities.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "geo_city_coordinates_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "geo_city_coordinates_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_city_coordinates_priority_lookup" {
    columns = [column.city_id, column.source_id]
    include = [column.latitude, column.longitude, column.accuracy_m, column.publisher_id, column.verified_at]
  }
  index "idx_geo_city_coordinates_publisher_lookup" {
    columns = [column.city_id, column.publisher_id]
    comment = "Optimizes publisher-specific coordinate override lookups for zmanim calculations"
    where   = "(publisher_id IS NOT NULL)"
    include = [column.latitude, column.longitude, column.source_id, column.verified_at]
  }
  index "idx_geo_city_coordinates_source" {
    columns = [column.source_id]
  }
  index "idx_geo_city_coordinates_source_active" {
    columns = [column.source_id]
    include = [column.city_id, column.publisher_id, column.latitude, column.longitude, column.verified_at]
  }
  index "idx_geo_city_coordinates_unique" {
    unique = true
    on {
      column = column.city_id
    }
    on {
      column = column.source_id
    }
    on {
      expr = "COALESCE(publisher_id, 0)"
    }
  }
}
table "geo_city_elevations" {
  schema = schema.public
  column "id" {
    null = false
    type = integer
    identity {
      generated = ALWAYS
    }
  }
  column "city_id" {
    null = false
    type = integer
  }
  column "coordinate_source_id" {
    null = false
    type = integer
  }
  column "source_id" {
    null = false
    type = integer
  }
  column "elevation_m" {
    null = false
    type = integer
  }
  column "accuracy_m" {
    null = true
    type = integer
  }
  column "submitted_by" {
    null = true
    type = text
  }
  column "publisher_id" {
    null = true
    type = integer
  }
  column "verified_at" {
    null = true
    type = timestamptz
  }
  column "verified_by" {
    null = true
    type = text
  }
  column "notes" {
    null = true
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_city_elevations_city_id_fkey" {
    columns     = [column.city_id]
    ref_columns = [table.geo_cities.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "geo_city_elevations_coordinate_source_id_fkey" {
    columns     = [column.coordinate_source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_city_elevations_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "geo_city_elevations_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_city_elevations_priority_lookup" {
    columns = [column.city_id, column.coordinate_source_id, column.source_id]
    include = [column.elevation_m, column.accuracy_m, column.publisher_id, column.verified_at]
  }
  index "idx_geo_city_elevations_publisher_lookup" {
    columns = [column.city_id, column.publisher_id]
    comment = "Optimizes publisher-specific elevation override lookups for zmanim calculations"
    where   = "(publisher_id IS NOT NULL)"
    include = [column.elevation_m, column.source_id, column.coordinate_source_id, column.verified_at]
  }
  index "idx_geo_city_elevations_source" {
    columns = [column.source_id]
  }
  index "idx_geo_city_elevations_source_active" {
    columns = [column.source_id]
    include = [column.city_id, column.publisher_id, column.elevation_m, column.verified_at]
  }
  index "idx_geo_city_elevations_unique" {
    unique = true
    on {
      column = column.city_id
    }
    on {
      column = column.coordinate_source_id
    }
    on {
      column = column.source_id
    }
    on {
      expr = "COALESCE(publisher_id, 0)"
    }
  }
}
table "geo_continents" {
  schema = schema.public
  column "id" {
    null = false
    type = smallserial
  }
  column "code" {
    null = false
    type = character_varying(2)
  }
  column "name" {
    null = false
    type = text
  }
  column "wof_id" {
    null = true
    type = integer
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_geo_continents_wof_id" {
    columns = [column.wof_id]
    where   = "(wof_id IS NOT NULL)"
  }
  unique "geo_continents_code_key" {
    columns = [column.code]
  }
  unique "geo_continents_wof_id_key" {
    columns = [column.wof_id]
  }
}
table "geo_countries" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "code" {
    null = false
    type = character_varying(2)
  }
  column "code_iso3" {
    null = true
    type = character_varying(3)
  }
  column "name" {
    null = false
    type = text
  }
  column "continent_id" {
    null = false
    type = smallint
  }
  column "adm1_label" {
    null    = true
    type    = text
    default = "Region"
  }
  column "adm2_label" {
    null    = true
    type    = text
    default = "District"
  }
  column "has_adm1" {
    null    = true
    type    = boolean
    default = true
  }
  column "has_adm2" {
    null    = true
    type    = boolean
    default = false
  }
  column "is_city_state" {
    null    = true
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "wof_id" {
    null = true
    type = integer
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_countries_continent_id_fkey" {
    columns     = [column.continent_id]
    ref_columns = [table.geo_continents.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_countries_continent" {
    columns = [column.continent_id]
  }
  index "idx_geo_countries_continent_name" {
    columns = [column.continent_id, column.name]
  }
  index "idx_geo_countries_name_trgm" {
    type = GIN
    on {
      column = column.name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_geo_countries_wof_id" {
    columns = [column.wof_id]
    where   = "(wof_id IS NOT NULL)"
  }
  unique "geo_countries_code_key" {
    columns = [column.code]
  }
}
table "geo_country_boundaries" {
  schema = schema.public
  column "country_id" {
    null = false
    type = smallint
  }
  column "boundary" {
    null = false
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "boundary_simplified" {
    null = true
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "area_km2" {
    null = true
    type = double_precision
  }
  column "centroid" {
    null = true
    type = sql("public.geography(Point,4326)")
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.country_id]
  }
  foreign_key "geo_country_boundaries_country_id_fkey" {
    columns     = [column.country_id]
    ref_columns = [table.geo_countries.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_country_boundaries_centroid" {
    columns = [column.centroid]
    type    = GIST
  }
  index "idx_country_boundaries_geom" {
    columns = [column.boundary]
    type    = GIST
  }
  index "idx_country_boundaries_simplified" {
    columns = [column.boundary_simplified]
    type    = GIST
  }
}
table "geo_data_imports" {
  schema = schema.public
  column "id" {
    null = false
    type = integer
    identity {
      generated = ALWAYS
    }
  }
  column "source_id" {
    null = false
    type = integer
  }
  column "import_type" {
    null = false
    type = character_varying(20)
  }
  column "version" {
    null = true
    type = text
  }
  column "started_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "completed_at" {
    null = true
    type = timestamptz
  }
  column "records_processed" {
    null    = true
    type    = integer
    default = 0
  }
  column "records_imported" {
    null    = true
    type    = integer
    default = 0
  }
  column "records_updated" {
    null    = true
    type    = integer
    default = 0
  }
  column "records_skipped" {
    null    = true
    type    = integer
    default = 0
  }
  column "errors" {
    null = true
    type = sql("text[]")
  }
  column "notes" {
    null = true
    type = text
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_data_imports_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_data_imports_source_started" {
    on {
      column = column.source_id
    }
    on {
      desc   = true
      column = column.started_at
    }
  }
}
table "geo_data_sources" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "name" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "data_type_id" {
    null = false
    type = smallint
  }
  column "priority" {
    null = false
    type = smallint
  }
  column "default_accuracy_m" {
    null = true
    type = integer
  }
  column "attribution" {
    null = true
    type = text
  }
  column "url" {
    null = true
    type = text
  }
  column "is_active" {
    null    = true
    type    = boolean
    default = true
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_data_sources_data_type_id_fkey" {
    columns     = [column.data_type_id]
    ref_columns = [table.data_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_data_sources_key" {
    columns = [column.key]
  }
  unique "geo_data_sources_key_key" {
    columns = [column.key]
  }
}
table "geo_district_boundaries" {
  schema = schema.public
  column "district_id" {
    null = false
    type = integer
  }
  column "boundary" {
    null = false
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "boundary_simplified" {
    null = true
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "area_km2" {
    null = true
    type = double_precision
  }
  column "centroid" {
    null = true
    type = sql("public.geography(Point,4326)")
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.district_id]
  }
  foreign_key "geo_district_boundaries_district_id_fkey" {
    columns     = [column.district_id]
    ref_columns = [table.geo_districts.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_district_boundaries_centroid" {
    columns = [column.centroid]
    type    = GIST
  }
  index "idx_district_boundaries_geom" {
    columns = [column.boundary]
    type    = GIST
  }
  index "idx_district_boundaries_simplified" {
    columns = [column.boundary_simplified]
    type    = GIST
  }
}
table "geo_districts" {
  schema = schema.public
  column "id" {
    null = false
    type = integer
    identity {
      generated = ALWAYS
    }
  }
  column "region_id" {
    null = true
    type = integer
  }
  column "code" {
    null = false
    type = text
  }
  column "name" {
    null = false
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "wof_id" {
    null = true
    type = integer
  }
  column "continent_id" {
    null = false
    type = smallint
  }
  column "country_id" {
    null = true
    type = smallint
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_districts_continent_id_fkey" {
    columns     = [column.continent_id]
    ref_columns = [table.geo_continents.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_districts_country_id_fkey" {
    columns     = [column.country_id]
    ref_columns = [table.geo_countries.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_districts_region_id_fkey" {
    columns     = [column.region_id]
    ref_columns = [table.geo_regions.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_geo_districts_continent" {
    columns = [column.continent_id]
  }
  index "idx_geo_districts_country" {
    columns = [column.country_id]
  }
  index "idx_geo_districts_name_trgm" {
    type = GIN
    on {
      column = column.name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_geo_districts_region" {
    columns = [column.region_id]
  }
  index "idx_geo_districts_region_name" {
    columns = [column.region_id, column.name]
  }
  index "idx_geo_districts_wof_id" {
    columns = [column.wof_id]
    where   = "(wof_id IS NOT NULL)"
  }
  unique "geo_districts_region_id_code_key" {
    columns = [column.region_id, column.code]
  }
  unique "geo_districts_wof_id_key" {
    columns = [column.wof_id]
  }
}
table "geo_foreign_names" {
  schema  = schema.public
  comment = "Stores foreign language names for geographic entities (Yerushalayim, Londres, München, etc.) with transliteration"
  column "id" {
    null = false
    type = serial
  }
  column "entity_type" {
    null    = false
    type    = character_varying(20)
    comment = "Type of geographic entity: city, district, region, or country"
  }
  column "entity_id" {
    null    = false
    type    = integer
    comment = "ID of the entity in the corresponding table (no FK constraint for flexibility)"
  }
  column "language_code" {
    null    = false
    type    = character_varying(10)
    comment = "ISO language code (he, fr, de, ar, etc.)"
  }
  column "name" {
    null    = false
    type    = text
    comment = "Foreign name in original script (e.g., \"ירושלים\" for Jerusalem in Hebrew)"
  }
  column "name_ascii" {
    null    = false
    type    = text
    comment = "ASCII transliterated version for search (e.g., \"yerushalayim\")"
  }
  column "is_preferred" {
    null    = true
    type    = boolean
    default = false
    comment = "True for the preferred name in this language (default display)"
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_foreign_names_lang" {
    columns = [column.language_code]
  }
  index "idx_foreign_names_lookup" {
    columns = [column.entity_type, column.entity_id]
  }
  index "idx_foreign_names_preferred" {
    columns = [column.language_code, column.is_preferred]
    where   = "(is_preferred = true)"
  }
  index "idx_foreign_names_trgm" {
    type = GIN
    on {
      column = column.name_ascii
      ops    = "public.gin_trgm_ops"
    }
  }
  check "geo_foreign_names_entity_type_check" {
    expr = "((entity_type)::text = ANY ((ARRAY['city'::character varying, 'district'::character varying, 'region'::character varying, 'country'::character varying])::text[]))"
  }
}
table "geo_import_errors" {
  schema  = schema.public
  comment = "Tracks errors during geographic data import and hierarchy assignment"
  column "id" {
    null = false
    type = serial
  }
  column "import_id" {
    null    = false
    type    = uuid
    comment = "UUID identifying this import batch"
  }
  column "error_type" {
    null    = false
    type    = character_varying(50)
    comment = "Error type: no_country_boundary, missing_region, missing_district, region_mismatch, district_mismatch"
  }
  column "entity_type" {
    null    = false
    type    = character_varying(20)
    comment = "Entity type: city, region, district, country"
  }
  column "entity_id" {
    null    = false
    type    = integer
    comment = "ID of the entity with the error"
  }
  column "details" {
    null    = true
    type    = jsonb
    comment = "JSON with error details (city_name, coordinates, expected values, etc.)"
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_geo_import_errors_created" {
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_geo_import_errors_entity" {
    columns = [column.entity_type, column.entity_id]
  }
  index "idx_geo_import_errors_import" {
    columns = [column.import_id]
  }
  index "idx_geo_import_errors_type" {
    columns = [column.error_type]
  }
}
table "geo_levels" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "sort_order" {
    null = false
    type = smallint
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_geo_levels_key" {
    columns = [column.key]
  }
}
table "geo_location_references" {
  schema = schema.public
  column "id" {
    null    = false
    type    = uuid
    default = sql("gen_random_uuid()")
  }
  column "continent_id" {
    null = true
    type = smallint
  }
  column "country_id" {
    null = true
    type = smallint
  }
  column "region_id" {
    null = true
    type = integer
  }
  column "district_id" {
    null = true
    type = integer
  }
  column "city_id" {
    null = true
    type = integer
  }
  column "coverage_level_id" {
    null = false
    type = smallint
  }
  column "display_name_english" {
    null = true
    type = text
  }
  column "display_name_hebrew" {
    null = true
    type = text
  }
  column "display_hierarchy_english" {
    null = true
    type = text
  }
  column "display_hierarchy_hebrew" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_location_references_coverage_level_id_fkey" {
    columns     = [column.coverage_level_id]
    ref_columns = [table.coverage_levels.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_location_refs_city" {
    columns = [column.city_id]
    where   = "(city_id IS NOT NULL)"
  }
  index "idx_geo_location_refs_continent" {
    columns = [column.continent_id]
    where   = "(continent_id IS NOT NULL)"
  }
  index "idx_geo_location_refs_country" {
    columns = [column.country_id]
    where   = "(country_id IS NOT NULL)"
  }
  index "idx_geo_location_refs_district" {
    columns = [column.district_id]
    where   = "(district_id IS NOT NULL)"
  }
  index "idx_geo_location_refs_level" {
    columns = [column.coverage_level_id]
  }
  index "idx_geo_location_refs_region" {
    columns = [column.region_id]
    where   = "(region_id IS NOT NULL)"
  }
}
table "geo_name_mappings" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "level_id" {
    null = false
    type = smallint
  }
  column "source_id" {
    null = false
    type = integer
  }
  column "source_name" {
    null = false
    type = text
  }
  column "source_country_code" {
    null = true
    type = character_varying(2)
  }
  column "target_id" {
    null = false
    type = integer
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "notes" {
    null = true
    type = text
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_name_mappings_level_id_fkey" {
    columns     = [column.level_id]
    ref_columns = [table.geo_levels.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_name_mappings_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  unique "geo_name_mappings_level_source_key" {
    columns = [column.level_id, column.source_id, column.source_name, column.source_country_code]
  }
}
table "geo_names" {
  schema = schema.public
  column "id" {
    null = false
    type = integer
    identity {
      generated = ALWAYS
    }
  }
  column "entity_type_id" {
    null = false
    type = smallint
  }
  column "entity_id" {
    null = false
    type = integer
  }
  column "language_code" {
    null = false
    type = character_varying(3)
  }
  column "name" {
    null = false
    type = text
  }
  column "is_preferred" {
    null    = true
    type    = boolean
    default = true
  }
  column "source_id" {
    null = true
    type = integer
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_names_entity_type_id_fkey" {
    columns     = [column.entity_type_id]
    ref_columns = [table.geo_levels.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_names_language_code_fkey" {
    columns     = [column.language_code]
    ref_columns = [table.languages.column.code]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "geo_names_source_id_fkey" {
    columns     = [column.source_id]
    ref_columns = [table.geo_data_sources.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_geo_names_entity" {
    columns = [column.entity_type_id, column.entity_id]
  }
  index "idx_geo_names_language" {
    columns = [column.language_code]
  }
  index "idx_geo_names_name_trgm" {
    type = GIN
    on {
      column = column.name
      ops    = "public.gin_trgm_ops"
    }
  }
  unique "geo_names_unique" {
    columns = [column.entity_type_id, column.entity_id, column.language_code]
  }
}
table "geo_region_boundaries" {
  schema = schema.public
  column "region_id" {
    null = false
    type = integer
  }
  column "boundary" {
    null = false
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "boundary_simplified" {
    null = true
    type = sql("public.geography(MultiPolygon,4326)")
  }
  column "area_km2" {
    null = true
    type = double_precision
  }
  column "centroid" {
    null = true
    type = sql("public.geography(Point,4326)")
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.region_id]
  }
  foreign_key "geo_region_boundaries_region_id_fkey" {
    columns     = [column.region_id]
    ref_columns = [table.geo_regions.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_region_boundaries_centroid" {
    columns = [column.centroid]
    type    = GIST
  }
  index "idx_region_boundaries_geom" {
    columns = [column.boundary]
    type    = GIST
  }
  index "idx_region_boundaries_simplified" {
    columns = [column.boundary_simplified]
    type    = GIST
  }
}
table "geo_regions" {
  schema = schema.public
  column "id" {
    null = false
    type = integer
    identity {
      generated = ALWAYS
    }
  }
  column "country_id" {
    null = true
    type = smallint
  }
  column "code" {
    null = false
    type = text
  }
  column "name" {
    null = false
    type = text
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "wof_id" {
    null = true
    type = integer
  }
  column "continent_id" {
    null = false
    type = smallint
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "geo_regions_continent_id_fkey" {
    columns     = [column.continent_id]
    ref_columns = [table.geo_continents.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "geo_regions_country_id_fkey" {
    columns     = [column.country_id]
    ref_columns = [table.geo_countries.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_geo_regions_continent" {
    columns = [column.continent_id]
  }
  index "idx_geo_regions_country" {
    columns = [column.country_id]
  }
  index "idx_geo_regions_country_name" {
    columns = [column.country_id, column.name]
  }
  index "idx_geo_regions_name_trgm" {
    type = GIN
    on {
      column = column.name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_geo_regions_wof_id" {
    columns = [column.wof_id]
    where   = "(wof_id IS NOT NULL)"
  }
  unique "geo_regions_country_id_code_key" {
    columns = [column.country_id, column.code]
  }
  unique "geo_regions_wof_id_key" {
    columns = [column.wof_id]
  }
}
table "jewish_event_types" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(30)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "jewish_events" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "code" {
    null = false
    type = character_varying(50)
  }
  column "name_hebrew" {
    null = false
    type = text
  }
  column "name_english" {
    null = false
    type = text
  }
  column "event_type_id" {
    null = false
    type = smallint
  }
  column "duration_days_israel" {
    null    = true
    type    = integer
    default = 1
  }
  column "duration_days_diaspora" {
    null    = true
    type    = integer
    default = 1
  }
  column "fast_start_type_id" {
    null = true
    type = smallint
  }
  column "parent_event_id" {
    null = true
    type = integer
  }
  column "sort_order" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "jewish_events_event_type_id_fkey" {
    columns     = [column.event_type_id]
    ref_columns = [table.jewish_event_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "jewish_events_fast_start_type_id_fkey" {
    columns     = [column.fast_start_type_id]
    ref_columns = [table.fast_start_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "jewish_events_parent_event_id_fkey" {
    columns     = [column.parent_event_id]
    ref_columns = [table.jewish_events.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_jewish_events_code" {
    columns = [column.code]
  }
  index "idx_jewish_events_parent" {
    columns = [column.parent_event_id]
  }
  index "idx_jewish_events_type" {
    columns = [column.event_type_id]
  }
  unique "jewish_events_code_key" {
    columns = [column.code]
  }
}
table "languages" {
  schema = schema.public
  column "code" {
    null = false
    type = character_varying(3)
  }
  column "name" {
    null = false
    type = text
  }
  column "native_name" {
    null = true
    type = text
  }
  column "script" {
    null = true
    type = character_varying(4)
  }
  column "direction" {
    null    = true
    type    = character_varying(3)
    default = "ltr"
  }
  column "is_active" {
    null    = true
    type    = boolean
    default = true
  }
  primary_key {
    columns = [column.code]
  }
}
table "master_zman_day_types" {
  schema = schema.public
  column "master_zman_id" {
    null = false
    type = integer
  }
  column "day_type_id" {
    null = false
    type = integer
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.master_zman_id, column.day_type_id]
  }
  foreign_key "master_zman_day_types_day_type_id_fkey" {
    columns     = [column.day_type_id]
    ref_columns = [table.day_types.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "master_zman_day_types_master_zman_id_fkey" {
    columns     = [column.master_zman_id]
    ref_columns = [table.master_zmanim_registry.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_master_zman_day_types_day" {
    columns = [column.day_type_id]
  }
  index "idx_master_zman_day_types_zman" {
    columns = [column.master_zman_id]
  }
}
table "master_zman_events" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "master_zman_id" {
    null = false
    type = integer
  }
  column "jewish_event_id" {
    null = false
    type = integer
  }
  column "is_primary" {
    null    = true
    type    = boolean
    default = false
  }
  column "override_hebrew_name" {
    null = true
    type = text
  }
  column "override_english_name" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "master_zman_events_jewish_event_id_fkey" {
    columns     = [column.jewish_event_id]
    ref_columns = [table.jewish_events.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "master_zman_events_master_zman_id_fkey" {
    columns     = [column.master_zman_id]
    ref_columns = [table.master_zmanim_registry.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_master_zman_events_event" {
    columns = [column.jewish_event_id]
  }
  index "idx_master_zman_events_zman" {
    columns = [column.master_zman_id]
  }
  unique "master_zman_events_unique" {
    columns = [column.master_zman_id, column.jewish_event_id]
  }
}
table "master_zman_tags" {
  schema = schema.public
  column "master_zman_id" {
    null = false
    type = integer
  }
  column "tag_id" {
    null = false
    type = integer
  }
  column "is_negated" {
    null    = false
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.master_zman_id, column.tag_id]
  }
  foreign_key "master_zman_tags_master_zman_id_fkey" {
    columns     = [column.master_zman_id]
    ref_columns = [table.master_zmanim_registry.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "master_zman_tags_tag_id_fkey" {
    columns     = [column.tag_id]
    ref_columns = [table.zman_tags.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_master_zman_tags_covering" {
    columns = [column.master_zman_id]
    include = [column.tag_id]
  }
  index "idx_master_zman_tags_negated" {
    columns = [column.master_zman_id, column.is_negated]
  }
  index "idx_master_zman_tags_tag" {
    columns = [column.tag_id]
  }
  index "idx_master_zman_tags_zman" {
    columns = [column.master_zman_id]
  }
}
table "master_zmanim_registry" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "zman_key" {
    null = false
    type = character_varying(100)
  }
  column "canonical_hebrew_name" {
    null = false
    type = text
  }
  column "canonical_english_name" {
    null = false
    type = text
  }
  column "transliteration" {
    null = true
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "halachic_source" {
    null = true
    type = text
  }
  column "halachic_notes" {
    null = true
    type = text
  }
  column "time_category_id" {
    null = true
    type = integer
  }
  column "default_formula_dsl" {
    null = true
    type = text
  }
  column "is_hidden" {
    null    = false
    type    = boolean
    default = false
  }
  column "is_core" {
    null    = true
    type    = boolean
    default = false
  }
  column "aliases" {
    null = true
    type = sql("text[]")
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "master_zmanim_registry_time_category_id_fkey" {
    columns     = [column.time_category_id]
    ref_columns = [table.time_categories.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_master_registry_category" {
    columns = [column.time_category_id]
  }
  index "idx_master_registry_english_name_trgm" {
    type = GIN
    on {
      column = column.canonical_english_name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_master_registry_hebrew_name_trgm" {
    type = GIN
    on {
      column = column.canonical_hebrew_name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_master_registry_hidden" {
    columns = [column.is_hidden]
  }
  index "idx_master_registry_transliteration_trgm" {
    type = GIN
    on {
      column = column.transliteration
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_master_registry_visible_by_category" {
    columns = [column.time_category_id, column.canonical_hebrew_name]
    where   = "(is_hidden = false)"
  }
  unique "master_zmanim_registry_zman_key_key" {
    columns = [column.zman_key]
  }
}
table "password_reset_tokens" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "email" {
    null = false
    type = text
  }
  column "token" {
    null = false
    type = text
  }
  column "expires_at" {
    null = false
    type = timestamptz
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_password_reset_tokens_email" {
    columns = [column.email]
  }
  index "idx_password_reset_tokens_token" {
    columns = [column.token]
  }
}
table "primitive_categories" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
}
table "publisher_coverage" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "coverage_level_id" {
    null = false
    type = smallint
  }
  column "city_id" {
    null = true
    type = integer
  }
  column "district_id" {
    null = true
    type = integer
  }
  column "region_id" {
    null = true
    type = integer
  }
  column "country_id" {
    null = true
    type = smallint
  }
  column "continent_id" {
    null = true
    type = smallint
  }
  column "is_active" {
    null    = false
    type    = boolean
    default = true
  }
  column "priority" {
    null    = true
    type    = integer
    default = 0
  }
  column "geo_location_id" {
    null = true
    type = uuid
  }
  column "created_by_action_id" {
    null = true
    type = uuid
  }
  column "updated_by_action_id" {
    null = true
    type = uuid
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_created_by_action_cov" {
    columns     = [column.created_by_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "fk_updated_by_action_cov" {
    columns     = [column.updated_by_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "publisher_coverage_city_id_fkey" {
    columns     = [column.city_id]
    ref_columns = [table.geo_cities.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_coverage_continent_id_fkey" {
    columns     = [column.continent_id]
    ref_columns = [table.geo_continents.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_coverage_country_id_fkey" {
    columns     = [column.country_id]
    ref_columns = [table.geo_countries.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_coverage_coverage_level_id_fkey" {
    columns     = [column.coverage_level_id]
    ref_columns = [table.coverage_levels.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "publisher_coverage_district_id_fkey" {
    columns     = [column.district_id]
    ref_columns = [table.geo_districts.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_coverage_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_coverage_region_id_fkey" {
    columns     = [column.region_id]
    ref_columns = [table.geo_regions.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_coverage_active" {
    columns = [column.publisher_id, column.is_active]
    where   = "(is_active = true)"
  }
  index "idx_publisher_coverage_city" {
    columns = [column.city_id]
    where   = "(city_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_continent" {
    columns = [column.continent_id]
    where   = "(continent_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_country" {
    columns = [column.country_id]
    where   = "(country_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_district" {
    columns = [column.district_id]
    where   = "(district_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_publisher_coverage_region" {
    columns = [column.region_id]
    where   = "(region_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_unique_city" {
    unique  = true
    columns = [column.publisher_id, column.city_id]
    where   = "(city_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_unique_continent" {
    unique  = true
    columns = [column.publisher_id, column.continent_id]
    where   = "(continent_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_unique_country" {
    unique  = true
    columns = [column.publisher_id, column.country_id]
    where   = "(country_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_unique_district" {
    unique  = true
    columns = [column.publisher_id, column.district_id]
    where   = "(district_id IS NOT NULL)"
  }
  index "idx_publisher_coverage_unique_region" {
    unique  = true
    columns = [column.publisher_id, column.region_id]
    where   = "(region_id IS NOT NULL)"
  }
}
table "publisher_invitations" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "email" {
    null = false
    type = text
  }
  column "role_id" {
    null = false
    type = smallint
  }
  column "token" {
    null = false
    type = text
  }
  column "expires_at" {
    null = false
    type = timestamptz
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "invited_by" {
    null    = false
    type    = text
    comment = "Clerk user ID of person who created invitation"
  }
  column "status" {
    null    = true
    type    = text
    default = "pending"
    comment = "Invitation state: pending, accepted, expired, cancelled"
  }
  column "accepted_at" {
    null    = true
    type    = timestamptz
    comment = "Timestamp when invitation was accepted (NULL = not accepted)"
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
    comment = "Timestamp of last update"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_invitations_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_invitations_role_id_fkey" {
    columns     = [column.role_id]
    ref_columns = [table.publisher_roles.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_invitations_expires_at" {
    columns = [column.expires_at]
    where   = "(status = 'pending'::text)"
  }
  index "idx_invitations_publisher_status" {
    columns = [column.publisher_id, column.status]
  }
  index "idx_publisher_invitations_email" {
    columns = [column.email, column.publisher_id]
  }
  index "idx_publisher_invitations_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_publisher_invitations_publisher_expires" {
    on {
      column = column.publisher_id
    }
    on {
      desc   = true
      column = column.expires_at
    }
  }
  index "idx_publisher_invitations_token" {
    columns = [column.token]
  }
  unique "publisher_invitations_publisher_id_email_key" {
    columns = [column.publisher_id, column.email]
  }
  unique "publisher_invitations_token_key" {
    columns = [column.token]
  }
}
table "publisher_location_overrides" {
  schema  = schema.public
  comment = "Publisher-specific location data overrides (lat/lon/elevation only) for accurate zmanim calculations"
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "city_id" {
    null = false
    type = integer
  }
  column "override_latitude" {
    null    = true
    type    = double_precision
    comment = "Override latitude in decimal degrees (-90 to 90)"
  }
  column "override_longitude" {
    null    = true
    type    = double_precision
    comment = "Override longitude in decimal degrees (-180 to 180)"
  }
  column "override_elevation" {
    null    = true
    type    = integer
    comment = "Override elevation in meters"
  }
  column "reason" {
    null    = true
    type    = text
    comment = "Optional explanation for the override"
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_location_overrides_city_id_fkey" {
    columns     = [column.city_id]
    ref_columns = [table.geo_cities.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_location_overrides_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_location_overrides_calculation" {
    columns = [column.publisher_id, column.city_id]
    include = [column.override_latitude, column.override_longitude, column.override_elevation]
  }
  index "idx_publisher_overrides_city" {
    columns = [column.city_id]
  }
  index "idx_publisher_overrides_publisher" {
    columns = [column.publisher_id]
  }
  unique "publisher_location_overrides_publisher_id_city_id_key" {
    columns = [column.publisher_id, column.city_id]
  }
}
table "publisher_onboarding" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "profile_complete" {
    null    = true
    type    = boolean
    default = false
  }
  column "algorithm_selected" {
    null    = true
    type    = boolean
    default = false
  }
  column "zmanim_configured" {
    null    = true
    type    = boolean
    default = false
  }
  column "coverage_set" {
    null    = true
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_onboarding_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_onboarding_publisher" {
    columns = [column.publisher_id]
  }
  unique "publisher_onboarding_publisher_id_key" {
    columns = [column.publisher_id]
  }
}
table "publisher_registration_tokens" {
  schema  = schema.public
  comment = "Email verification tokens for publisher registration. Unverified requests do NOT appear in admin queue."
  column "id" {
    null    = false
    type    = uuid
    default = sql("gen_random_uuid()")
  }
  column "registrant_email" {
    null = false
    type = text
  }
  column "publisher_data" {
    null    = false
    type    = jsonb
    comment = "JSON with publisher_name, publisher_contact_email, publisher_description"
  }
  column "token" {
    null = false
    type = text
  }
  column "status" {
    null    = false
    type    = text
    default = "pending"
  }
  column "user_exists" {
    null    = true
    type    = boolean
    comment = "Server-side only flag. NEVER expose to public API (prevents user enumeration attacks)."
  }
  column "verified_at" {
    null = true
    type = timestamptz
  }
  column "completed_at" {
    null = true
    type = timestamptz
  }
  column "expires_at" {
    null = false
    type = timestamptz
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "first_name" {
    null    = true
    type    = text
    comment = "Applicant first name"
  }
  column "last_name" {
    null    = true
    type    = text
    comment = "Applicant last name"
  }
  column "existing_clerk_user_id" {
    null    = true
    type    = text
    comment = "Set if email matches existing Clerk user (server-side only)"
  }
  column "confirmed_existing_user" {
    null    = true
    type    = boolean
    default = false
    comment = "True if user confirmed \"Yes, that is me\" on verification page"
  }
  column "reviewed_by" {
    null    = true
    type    = text
    comment = "Admin clerk_user_id who reviewed the application"
  }
  column "reviewed_at" {
    null    = true
    type    = timestamptz
    comment = "Timestamp of admin review"
  }
  column "rejection_message" {
    null    = true
    type    = text
    comment = "Admin-provided rejection reason"
  }
  column "recaptcha_score" {
    null    = true
    type    = numeric(3,2)
    comment = "reCAPTCHA v3 score (0.0-1.0) for audit purposes"
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_reg_tokens_clerk_user" {
    columns = [column.existing_clerk_user_id]
    where   = "(existing_clerk_user_id IS NOT NULL)"
  }
  index "idx_reg_tokens_email" {
    columns = [column.registrant_email]
  }
  index "idx_reg_tokens_status_expires" {
    columns = [column.status, column.expires_at]
  }
  index "idx_reg_tokens_status_verified" {
    columns = [column.status]
    where   = "(status = 'verified'::text)"
  }
  index "idx_reg_tokens_token" {
    columns = [column.token]
  }
  unique "publisher_registration_tokens_token_key" {
    columns = [column.token]
  }
}
table "publisher_requests" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "email" {
    null = false
    type = text
  }
  column "name" {
    null = false
    type = text
  }
  column "organization" {
    null = true
    type = text
  }
  column "message" {
    null = true
    type = text
  }
  column "status_id" {
    null = false
    type = smallint
  }
  column "reviewed_by" {
    null = true
    type = text
  }
  column "reviewed_at" {
    null = true
    type = timestamptz
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_requests_status_id_fkey" {
    columns     = [column.status_id]
    ref_columns = [table.request_statuses.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_publisher_requests_email_pending" {
    unique  = true
    columns = [column.email]
    where   = "(status_id = 1)"
  }
  index "idx_publisher_requests_status" {
    columns = [column.status_id]
  }
}
table "publisher_roles" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "permissions" {
    null = true
    type = jsonb
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_publisher_roles_key" {
    columns = [column.key]
  }
}
table "publisher_snapshots" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "description" {
    null = true
    type = text
  }
  column "snapshot_data" {
    null = false
    type = jsonb
  }
  column "created_by" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_snapshots_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_snapshots_publisher_created" {
    on {
      column = column.publisher_id
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
}
table "publisher_statuses" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "color" {
    null = true
    type = character_varying(7)
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_publisher_statuses_key" {
    columns = [column.key]
  }
}
table "publisher_zman_aliases" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_zman_id" {
    null = false
    type = integer
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "alias_hebrew" {
    null = false
    type = text
  }
  column "alias_english" {
    null = true
    type = text
  }
  column "alias_transliteration" {
    null = true
    type = text
  }
  column "context" {
    null = true
    type = character_varying(100)
  }
  column "is_primary" {
    null    = false
    type    = boolean
    default = false
  }
  column "sort_order" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_zman_aliases_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_zman_aliases_publisher_zman_id_fkey" {
    columns     = [column.publisher_zman_id]
    ref_columns = [table.publisher_zmanim.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_zman_aliases_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_publisher_zman_aliases_zman" {
    columns = [column.publisher_zman_id]
  }
  unique "publisher_zman_aliases_unique" {
    columns = [column.publisher_id, column.alias_hebrew]
  }
}
table "publisher_zman_day_types" {
  schema = schema.public
  column "publisher_zman_id" {
    null = false
    type = integer
  }
  column "day_type_id" {
    null = false
    type = integer
  }
  column "override_formula_dsl" {
    null = true
    type = text
  }
  column "override_hebrew_name" {
    null = true
    type = text
  }
  column "override_english_name" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.publisher_zman_id, column.day_type_id]
  }
  foreign_key "publisher_zman_day_types_day_type_id_fkey" {
    columns     = [column.day_type_id]
    ref_columns = [table.day_types.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_zman_day_types_publisher_zman_id_fkey" {
    columns     = [column.publisher_zman_id]
    ref_columns = [table.publisher_zmanim.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_pub_zman_day_types_day" {
    columns = [column.day_type_id]
  }
  index "idx_pub_zman_day_types_zman" {
    columns = [column.publisher_zman_id]
  }
}
table "publisher_zman_events" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_zman_id" {
    null = false
    type = integer
  }
  column "jewish_event_id" {
    null = false
    type = integer
  }
  column "override_formula_dsl" {
    null = true
    type = text
  }
  column "override_hebrew_name" {
    null = true
    type = text
  }
  column "override_english_name" {
    null = true
    type = text
  }
  column "is_enabled" {
    null    = false
    type    = boolean
    default = true
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_zman_events_jewish_event_id_fkey" {
    columns     = [column.jewish_event_id]
    ref_columns = [table.jewish_events.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_zman_events_publisher_zman_id_fkey" {
    columns     = [column.publisher_zman_id]
    ref_columns = [table.publisher_zmanim.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_zman_events_composite" {
    columns = [column.publisher_zman_id, column.jewish_event_id]
  }
  index "idx_publisher_zman_events_event" {
    columns = [column.jewish_event_id]
  }
  index "idx_publisher_zman_events_zman" {
    columns = [column.publisher_zman_id]
  }
  unique "publisher_zman_events_unique" {
    columns = [column.publisher_zman_id, column.jewish_event_id]
  }
}
table "publisher_zman_tags" {
  schema = schema.public
  column "publisher_zman_id" {
    null = false
    type = integer
  }
  column "tag_id" {
    null = false
    type = integer
  }
  column "is_negated" {
    null    = false
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.publisher_zman_id, column.tag_id]
  }
  foreign_key "publisher_zman_tags_publisher_zman_id_fkey" {
    columns     = [column.publisher_zman_id]
    ref_columns = [table.publisher_zmanim.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_zman_tags_tag_id_fkey" {
    columns     = [column.tag_id]
    ref_columns = [table.zman_tags.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_zman_tags_covering" {
    columns = [column.publisher_zman_id, column.tag_id]
    comment = "Covering index for GetZmanTags query - avoids heap lookups"
    include = [column.is_negated]
  }
  index "idx_publisher_zman_tags_negated" {
    columns = [column.publisher_zman_id, column.is_negated]
  }
  index "idx_publisher_zman_tags_tag" {
    columns = [column.tag_id]
  }
  index "idx_publisher_zman_tags_zman" {
    columns = [column.publisher_zman_id]
  }
}
table "publisher_zman_versions" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_zman_id" {
    null = false
    type = integer
  }
  column "version_number" {
    null = false
    type = integer
  }
  column "hebrew_name" {
    null = false
    type = text
  }
  column "english_name" {
    null = true
    type = text
  }
  column "formula_dsl" {
    null = true
    type = text
  }
  column "halachic_notes" {
    null = true
    type = text
  }
  column "created_by" {
    null = true
    type = text
  }
  column "change_reason" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publisher_zman_versions_publisher_zman_id_fkey" {
    columns     = [column.publisher_zman_id]
    ref_columns = [table.publisher_zmanim.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_publisher_zman_versions_zman_version" {
    on {
      column = column.publisher_zman_id
    }
    on {
      desc   = true
      column = column.version_number
    }
  }
  unique "publisher_zman_versions_unique" {
    columns = [column.publisher_zman_id, column.version_number]
  }
}
table "publisher_zmanim" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "zman_key" {
    null = false
    type = character_varying(100)
  }
  column "hebrew_name" {
    null = false
    type = text
  }
  column "english_name" {
    null    = false
    type    = text
    default = ""
  }
  column "transliteration" {
    null = true
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "formula_dsl" {
    null    = false
    type    = text
    default = ""
  }
  column "ai_explanation" {
    null = true
    type = text
  }
  column "publisher_comment" {
    null = true
    type = text
  }
  column "master_zman_id" {
    null = true
    type = integer
  }
  column "halachic_notes" {
    null = true
    type = text
  }
  column "is_enabled" {
    null    = false
    type    = boolean
    default = true
  }
  column "is_visible" {
    null    = false
    type    = boolean
    default = true
  }
  column "is_published" {
    null    = false
    type    = boolean
    default = true
  }
  column "is_beta" {
    null    = false
    type    = boolean
    default = false
  }
  column "is_custom" {
    null    = false
    type    = boolean
    default = false
  }
  column "time_category_id" {
    null = true
    type = integer
  }
  column "aliases" {
    null    = true
    type    = sql("text[]")
    default = "{}"
  }
  column "dependencies" {
    null    = true
    type    = sql("text[]")
    default = "{}"
  }
  column "linked_publisher_zman_id" {
    null = true
    type = integer
  }
  column "current_version" {
    null    = true
    type    = integer
    default = 1
  }
  column "created_by_action_id" {
    null = true
    type = uuid
  }
  column "updated_by_action_id" {
    null = true
    type = uuid
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "deleted_at" {
    null = true
    type = timestamptz
  }
  column "deleted_by" {
    null = true
    type = text
  }
  column "certified_at" {
    null = true
    type = timestamptz
  }
  column "display_name_hebrew" {
    null = true
    type = text
  }
  column "display_name_english" {
    null = true
    type = text
  }
  column "rounding_mode" {
    null    = false
    type    = character_varying(10)
    default = "math"
    comment = "How to round time when seconds are hidden: floor (always down), math (standard >=30s up), ceil (always up)"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "fk_created_by_action" {
    columns     = [column.created_by_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "fk_updated_by_action" {
    columns     = [column.updated_by_action_id]
    ref_columns = [table.actions.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "publisher_zmanim_linked_publisher_zman_id_fkey" {
    columns     = [column.linked_publisher_zman_id]
    ref_columns = [table.publisher_zmanim.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  foreign_key "publisher_zmanim_master_zman_id_fkey" {
    columns     = [column.master_zman_id]
    ref_columns = [table.master_zmanim_registry.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "publisher_zmanim_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "publisher_zmanim_time_category_id_fkey" {
    columns     = [column.time_category_id]
    ref_columns = [table.time_categories.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_publisher_zmanim_active" {
    columns = [column.publisher_id]
    where   = "(deleted_at IS NULL)"
  }
  index "idx_publisher_zmanim_active_enabled" {
    columns = [column.publisher_id, column.is_enabled]
    where   = "(deleted_at IS NULL)"
  }
  index "idx_publisher_zmanim_beta" {
    columns = [column.publisher_id, column.is_beta]
    where   = "(is_beta = true)"
  }
  index "idx_publisher_zmanim_category" {
    columns = [column.time_category_id]
  }
  index "idx_publisher_zmanim_custom" {
    columns = [column.publisher_id, column.is_custom]
    where   = "(is_custom = true)"
  }
  index "idx_publisher_zmanim_deleted" {
    columns = [column.publisher_id, column.deleted_at]
    where   = "(deleted_at IS NOT NULL)"
  }
  index "idx_publisher_zmanim_enabled" {
    columns = [column.publisher_id, column.is_enabled]
    where   = "(is_enabled = true)"
  }
  index "idx_publisher_zmanim_english_name_trgm" {
    type  = GIN
    where = "((is_published = true) AND (is_visible = true))"
    on {
      column = column.english_name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_publisher_zmanim_hebrew_name_trgm" {
    type  = GIN
    where = "((is_published = true) AND (is_visible = true))"
    on {
      column = column.hebrew_name
      ops    = "public.gin_trgm_ops"
    }
  }
  index "idx_publisher_zmanim_key_lookup" {
    columns = [column.publisher_id, column.zman_key]
    where   = "(deleted_at IS NULL)"
  }
  index "idx_publisher_zmanim_linked" {
    columns = [column.linked_publisher_zman_id]
  }
  index "idx_publisher_zmanim_master" {
    columns = [column.master_zman_id]
  }
  index "idx_publisher_zmanim_public_search" {
    columns = [column.is_published, column.is_visible, column.time_category_id]
    where   = "((is_published = true) AND (is_visible = true))"
  }
  index "idx_publisher_zmanim_published" {
    columns = [column.publisher_id, column.is_published]
    where   = "(is_published = true)"
  }
  check "publisher_zmanim_rounding_mode_check" {
    expr = "((rounding_mode)::text = ANY ((ARRAY['floor'::character varying, 'math'::character varying, 'ceil'::character varying])::text[]))"
  }
  unique "publisher_zmanim_unique_key" {
    columns = [column.publisher_id, column.zman_key]
  }
}
table "publishers" {
  schema  = schema.public
  comment = "Publishers are organizations (e.g., \"Orthodox Union\", \"Chabad\") that publish zmanim calculations. They are NOT users - users (people) authenticate via Clerk and can belong to multiple publishers."
  column "id" {
    null = false
    type = serial
  }
  column "name" {
    null    = false
    type    = text
    comment = "Organization name (e.g., \"Orthodox Union\", \"Chabad of Los Angeles\")"
  }
  column "contact_email" {
    null    = false
    type    = text
    comment = "Public contact email for inquiries about this organization. This is NOT a login email - users authenticate via Clerk."
  }
  column "phone" {
    null = true
    type = text
  }
  column "website" {
    null    = true
    type    = text
    comment = "Publisher organization website URL"
  }
  column "description" {
    null = true
    type = text
  }
  column "logo_url" {
    null    = true
    type    = text
    comment = "Publisher organization logo (external URL)"
  }
  column "location" {
    null = true
    type = sql("public.geography(Point,4326)")
  }
  column "latitude" {
    null = true
    type = double_precision
  }
  column "longitude" {
    null = true
    type = double_precision
  }
  column "timezone" {
    null = true
    type = text
  }
  column "status_id" {
    null    = false
    type    = smallint
    comment = "Publisher verification status (pending, active, suspended, verified)"
  }
  column "verification_token" {
    null = true
    type = text
  }
  column "verified_at" {
    null = true
    type = timestamptz
  }
  column "clerk_user_id" {
    null    = true
    type    = text
    comment = "LEGACY: Primary owner user ID from Clerk. Current system has 1:1 relationship between user and publisher. Future: Multi-user support via user_publishers junction table."
  }
  column "is_published" {
    null    = false
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "updated_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  column "bio" {
    null    = true
    type    = text
    comment = "Public-facing description of the publisher organization"
  }
  column "slug" {
    null = true
    type = text
  }
  column "is_verified" {
    null    = false
    type    = boolean
    default = false
    comment = "Quick check: Is this publisher verified by admin?"
  }
  column "logo_data" {
    null    = true
    type    = text
    comment = "Publisher organization logo (base64-encoded data URI)"
  }
  column "is_certified" {
    null    = false
    type    = boolean
    default = false
    comment = "Is this a certified/premium publisher?"
  }
  column "suspension_reason" {
    null = true
    type = text
  }
  column "deleted_at" {
    null    = true
    type    = timestamptz
    comment = "Soft delete timestamp (NULL = active, timestamp = deleted)"
  }
  column "deleted_by" {
    null    = true
    type    = text
    comment = "Clerk user ID who performed soft delete"
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "publishers_status_id_fkey" {
    columns     = [column.status_id]
    ref_columns = [table.publisher_statuses.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_publishers_clerk_user_id" {
    columns = [column.clerk_user_id]
  }
  index "idx_publishers_deleted_at" {
    columns = [column.deleted_at]
    where   = "(deleted_at IS NULL)"
  }
  index "idx_publishers_id_name" {
    columns = [column.id]
    include = [column.name, column.status_id, column.is_verified]
  }
  index "idx_publishers_is_certified" {
    columns = [column.is_certified]
  }
  index "idx_publishers_location" {
    columns = [column.location]
    type    = GIST
  }
  index "idx_publishers_slug" {
    unique  = true
    columns = [column.slug]
    where   = "(slug IS NOT NULL)"
  }
  index "idx_publishers_status" {
    columns = [column.status_id]
  }
  index "idx_publishers_verified" {
    columns = [column.is_verified]
    where   = "(is_verified = true)"
  }
  unique "publishers_email_key" {
    columns = [column.contact_email]
  }
}
table "request_statuses" {
  schema = schema.public
  column "id" {
    null = false
    type = smallint
    identity {
      generated = ALWAYS
    }
  }
  column "key" {
    null = false
    type = character_varying(20)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "color" {
    null = true
    type = character_varying(7)
  }
  column "sort_order" {
    null    = false
    type    = smallint
    default = 0
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_request_statuses_key" {
    columns = [column.key]
  }
}
table "schema_migrations" {
  schema = schema.public
  column "version" {
    null = false
    type = text
  }
  column "applied_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.version]
  }
}
table "tag_event_mappings" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "tag_id" {
    null = false
    type = integer
  }
  column "hebcal_event_pattern" {
    null = true
    type = character_varying(100)
  }
  column "hebrew_month" {
    null = true
    type = integer
  }
  column "hebrew_day_start" {
    null = true
    type = integer
  }
  column "hebrew_day_end" {
    null = true
    type = integer
  }
  column "priority" {
    null    = true
    type    = integer
    default = 100
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "tag_event_mappings_tag_id_fkey" {
    columns     = [column.tag_id]
    ref_columns = [table.zman_tags.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  index "idx_tag_event_mappings_date_range" {
    comment = "Optimizes BETWEEN queries on hebrew_day_start and hebrew_day_end"
    where   = "(hebrew_month IS NOT NULL)"
    on {
      column = column.hebrew_month
    }
    on {
      column = column.hebrew_day_start
    }
    on {
      expr = "COALESCE(hebrew_day_end, hebrew_day_start)"
    }
  }
  index "idx_tag_event_mappings_hebrew_date" {
    columns = [column.hebrew_month, column.hebrew_day_start]
    where   = "(hebrew_month IS NOT NULL)"
  }
  index "idx_tag_event_mappings_pattern" {
    columns = [column.hebcal_event_pattern]
    where   = "(hebcal_event_pattern IS NOT NULL)"
  }
  index "idx_tag_event_mappings_priority" {
    comment = "Optimizes ORDER BY priority DESC in GetTagsForHebrewDate query"
    where   = "(hebrew_month IS NOT NULL)"
    on {
      desc   = true
      column = column.priority
    }
  }
  index "idx_tag_event_mappings_tag" {
    columns = [column.tag_id]
  }
  check "valid_mapping" {
    expr = "((hebcal_event_pattern IS NOT NULL) OR ((hebrew_month IS NOT NULL) AND (hebrew_day_start IS NOT NULL)))"
  }
  unique "tag_event_mappings_tag_id_hebcal_key" {
    columns = [column.tag_id, column.hebcal_event_pattern]
  }
}
table "tag_types" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "key" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = character_varying(100)
  }
  column "display_name_english" {
    null = false
    type = character_varying(100)
  }
  column "color" {
    null = true
    type = character_varying(255)
  }
  column "description" {
    null = true
    type = text
  }
  column "sort_order" {
    null = false
    type = integer
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_tag_types_key" {
    columns = [column.key]
  }
  index "idx_tag_types_sort" {
    columns = [column.sort_order]
  }
  unique "tag_types_key_key" {
    columns = [column.key]
  }
}
table "time_categories" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "key" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = character_varying(100)
  }
  column "display_name_english" {
    null = false
    type = character_varying(100)
  }
  column "description" {
    null = true
    type = character_varying(255)
  }
  column "icon_name" {
    null = true
    type = character_varying(50)
  }
  column "color" {
    null = true
    type = character_varying(50)
  }
  column "sort_order" {
    null = false
    type = integer
  }
  column "is_everyday" {
    null    = true
    type    = boolean
    default = true
  }
  column "created_at" {
    null    = true
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  index "idx_time_categories_key" {
    columns = [column.key]
  }
  index "idx_time_categories_sort" {
    columns = [column.sort_order]
  }
  unique "time_categories_key_key" {
    columns = [column.key]
  }
}
table "zman_display_contexts" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "master_zman_id" {
    null = false
    type = integer
  }
  column "context_code" {
    null = false
    type = character_varying(50)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "sort_order" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "zman_display_contexts_master_zman_id_fkey" {
    columns     = [column.master_zman_id]
    ref_columns = [table.master_zmanim_registry.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  unique "zman_display_contexts_unique" {
    columns = [column.master_zman_id, column.context_code]
  }
}
table "zman_registry_requests" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "publisher_id" {
    null = false
    type = integer
  }
  column "requested_key" {
    null = false
    type = character_varying(100)
  }
  column "requested_hebrew_name" {
    null = false
    type = text
  }
  column "requested_english_name" {
    null = false
    type = text
  }
  column "requested_formula_dsl" {
    null = true
    type = text
  }
  column "time_category_id" {
    null = false
    type = integer
  }
  column "status_id" {
    null = false
    type = smallint
  }
  column "reviewed_by" {
    null = true
    type = character_varying(255)
  }
  column "reviewed_at" {
    null = true
    type = timestamptz
  }
  column "reviewer_notes" {
    null = true
    type = text
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  column "transliteration" {
    null = true
    type = text
  }
  column "description" {
    null = true
    type = text
  }
  column "halachic_notes" {
    null = true
    type = text
  }
  column "halachic_source" {
    null = true
    type = text
  }
  column "publisher_email" {
    null = true
    type = text
  }
  column "publisher_name" {
    null = true
    type = text
  }
  column "auto_add_on_approval" {
    null    = true
    type    = boolean
    default = true
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "zman_registry_requests_publisher_id_fkey" {
    columns     = [column.publisher_id]
    ref_columns = [table.publishers.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "zman_registry_requests_status_id_fkey" {
    columns     = [column.status_id]
    ref_columns = [table.request_statuses.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  foreign_key "zman_registry_requests_time_category_id_fkey" {
    columns     = [column.time_category_id]
    ref_columns = [table.time_categories.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_zman_registry_requests_pending" {
    where = "(status_id = 1)"
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_zman_registry_requests_publisher" {
    columns = [column.publisher_id]
  }
  index "idx_zman_registry_requests_publisher_created" {
    on {
      column = column.publisher_id
    }
    on {
      desc   = true
      column = column.created_at
    }
  }
  index "idx_zman_registry_requests_status" {
    columns = [column.status_id]
  }
}
table "zman_request_tags" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "request_id" {
    null = false
    type = integer
  }
  column "tag_id" {
    null = true
    type = integer
  }
  column "requested_tag_name" {
    null = true
    type = text
  }
  column "requested_tag_type" {
    null = true
    type = text
  }
  column "is_new_tag_request" {
    null    = false
    type    = boolean
    default = false
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "zman_request_tags_request_id_fkey" {
    columns     = [column.request_id]
    ref_columns = [table.zman_registry_requests.column.id]
    on_update   = NO_ACTION
    on_delete   = CASCADE
  }
  foreign_key "zman_request_tags_tag_id_fkey" {
    columns     = [column.tag_id]
    ref_columns = [table.zman_tags.column.id]
    on_update   = NO_ACTION
    on_delete   = SET_NULL
  }
  index "idx_zman_request_tags_request" {
    columns = [column.request_id]
  }
  index "idx_zman_request_tags_tag" {
    columns = [column.tag_id]
    where   = "(tag_id IS NOT NULL)"
  }
  check "tag_reference_check" {
    expr = "(((tag_id IS NOT NULL) AND (requested_tag_name IS NULL) AND (is_new_tag_request = false)) OR ((tag_id IS NULL) AND (requested_tag_name IS NOT NULL) AND (is_new_tag_request = true)))"
  }
  check "zman_request_tags_requested_tag_type_check" {
    expr = "((requested_tag_type IS NULL) OR (requested_tag_type = ANY (ARRAY['event'::text, 'timing'::text, 'behavior'::text, 'shita'::text, 'method'::text])))"
  }
  unique "zman_request_tags_unique" {
    columns = [column.request_id, column.tag_id]
  }
}
table "zman_tags" {
  schema = schema.public
  column "id" {
    null = false
    type = serial
  }
  column "tag_key" {
    null = false
    type = character_varying(50)
  }
  column "name" {
    null = false
    type = character_varying(100)
  }
  column "display_name_hebrew" {
    null = false
    type = text
  }
  column "display_name_english" {
    null = false
    type = text
  }
  column "tag_type_id" {
    null = false
    type = integer
  }
  column "description" {
    null = true
    type = text
  }
  column "color" {
    null = true
    type = character_varying(7)
  }
  column "sort_order" {
    null    = true
    type    = integer
    default = 0
  }
  column "created_at" {
    null    = false
    type    = timestamptz
    default = sql("now()")
  }
  primary_key {
    columns = [column.id]
  }
  foreign_key "zman_tags_tag_type_id_fkey" {
    columns     = [column.tag_type_id]
    ref_columns = [table.tag_types.column.id]
    on_update   = NO_ACTION
    on_delete   = NO_ACTION
  }
  index "idx_zman_tags_tag_key" {
    columns = [column.tag_key]
  }
  index "idx_zman_tags_type" {
    columns = [column.tag_type_id]
  }
  unique "zman_tags_tag_key_key" {
    columns = [column.tag_key]
  }
}
schema "public" {
  comment = "standard public schema"
}
