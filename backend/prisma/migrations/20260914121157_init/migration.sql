-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RegistrationType" AS ENUM ('self_service', 'staff_invitation', 'oauth');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('ar', 'en', 'fr', 'tl');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('pending_verification', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "AuthProviderType" AS ENUM ('local', 'google', 'microsoft');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('email', 'sms', 'whatsapp');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('registration', 'login_2fa', 'password_reset', 'phone_change');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "InstructorAccountStatus" AS ENUM ('active_pending_approval', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('university', 'professional', 'prep', 'short');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('full', 'restricted', 'suspended');

-- CreateEnum
CREATE TYPE "CustomRequestStatus" AS ENUM ('draft', 'submitted', 'under_review', 'clarification_needed', 'priced', 'awaiting_student_approval', 'awaiting_payment', 'approved', 'assigned', 'in_production', 'in_internal_review', 'revision_requested', 'delivered', 'completed', 'disputed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('stripe', 'paypal', 'tabby', 'tamara');

-- CreateEnum
CREATE TYPE "PaymentPlanRelatedType" AS ENUM ('course_enrollment', 'custom_request');

-- CreateEnum
CREATE TYPE "PaymentPlanStatus" AS ENUM ('active', 'completed', 'defaulted', 'cancelled');

-- CreateEnum
CREATE TYPE "InstallmentManagement" AS ENUM ('internal', 'gateway_managed');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('upcoming', 'due', 'paid', 'overdue', 'failed', 'waived');

-- CreateEnum
CREATE TYPE "PaymentPlanAdjustmentType" AS ENUM ('reschedule', 'reduce_amount', 'waive_installment', 'extend_grace');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "GatewayPaymentMethod" AS ENUM ('card', 'paypal_wallet', 'bnpl');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('requested', 'approved', 'rejected', 'completed');

-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('pending_clearance', 'cleared', 'held', 'clawed_back');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('calculated', 'pending_second_approval', 'approved', 'rejected', 'awaiting_manual_confirmation', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('stripe_connect', 'paypal', 'manual_bank_transfer');

-- CreateEnum
CREATE TYPE "DeductionReason" AS ENUM ('refund_after_payout', 'dispute_chargeback', 'policy_violation');

-- CreateEnum
CREATE TYPE "DeductionStatus" AS ENUM ('pending', 'deducted', 'waived');

-- CreateEnum
CREATE TYPE "VideoSecurityEventType" AS ENUM ('devtools_opened', 'screen_recording_detected', 'multiple_tab_playback', 'rapid_seek_pattern', 'right_click_attempt', 'download_attempt_blocked');

-- CreateEnum
CREATE TYPE "SecurityCaseType" AS ENUM ('multi_region_access', 'account_sharing_pattern', 'repeated_devtools_detection', 'excessive_security_events', 'contact_leak_attempt');

-- CreateEnum
CREATE TYPE "SecurityCaseSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SecurityCaseStatus" AS ENUM ('open', 'under_review', 'dismissed', 'action_taken');

-- CreateEnum
CREATE TYPE "SecurityCaseResolution" AS ENUM ('false_positive', 'warning_sent', 'account_suspended', 'device_reset_forced');

-- CreateEnum
CREATE TYPE "MessageContextType" AS ENUM ('custom_request_thread', 'course_qa', 'lesson_comment', 'support_ticket');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('clean', 'flagged', 'blocked', 'under_review');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ViolationAction" AS ENUM ('content_masked', 'message_blocked', 'warning_sent', 'escalated');

-- CreateEnum
CREATE TYPE "AiUserRole" AS ENUM ('student', 'instructor', 'marketing', 'staff');

-- CreateEnum
CREATE TYPE "UsageLimitScope" AS ENUM ('per_user', 'per_role_pooled');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'true_false', 'short_answer', 'essay');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "QuestionBankStatus" AS ENUM ('draft', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('academic', 'administrative', 'financial');

-- CreateEnum
CREATE TYPE "ReportScope" AS ENUM ('self', 'managed_students', 'managed_courses', 'all');

-- CreateEnum
CREATE TYPE "GeneratedReportStatus" AS ENUM ('generating', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('email', 'in_app');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "registration_type" "RegistrationType" NOT NULL,
    "preferred_locale" "Locale" NOT NULL DEFAULT 'en',
    "status" "UserStatus" NOT NULL DEFAULT 'pending_verification',
    "email_verified_at" TIMESTAMP(3),
    "phone_verified_at" TIMESTAMP(3),
    "last_login_device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthProviderType" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "device_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "identifier" TEXT NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "staff_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invited_role_id" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_profiles" (
    "user_id" TEXT NOT NULL,
    "account_status" "InstructorAccountStatus" NOT NULL DEFAULT 'active_pending_approval',
    "bio" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "payout_frequency" "PayoutFrequency" NOT NULL DEFAULT 'monthly',
    "minimum_payout_threshold" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "is_payout_eligible" BOOLEAN NOT NULL DEFAULT true,
    "preferred_payout_method" "PayoutMethod",
    "stripe_connect_account_id" TEXT,
    "paypal_payout_email" TEXT,
    "last_payout_generated_at" TIMESTAMP(3),

    CONSTRAINT "instructor_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "level" "CourseLevel" NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'draft',
    "thumbnail_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_translations" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,

    CONSTRAINT "course_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "video_asset_id" TEXT,
    "order_index" INTEGER NOT NULL,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_content" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "progress_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "access_status" "AccessStatus" NOT NULL DEFAULT 'full',
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_requests" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "assigned_instructor_id" TEXT,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "proposed_price" DECIMAL(10,2),
    "final_price" DECIMAL(10,2),
    "estimated_delivery_days" INTEGER,
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_files" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_request_status_log" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_request_status_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_status_transitions" (
    "id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "allowed_roles" JSONB NOT NULL,
    "requires_condition" TEXT,

    CONSTRAINT "request_status_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL DEFAULT 'USD',
    "target_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_exchange_rates" (
    "target_currency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "current_exchange_rates_pkey" PRIMARY KEY ("target_currency")
);

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "supported_countries" JSONB NOT NULL,
    "supported_currencies" JSONB NOT NULL,
    "display_priority" INTEGER NOT NULL DEFAULT 0,
    "min_amount" DECIMAL(10,2),
    "max_amount" DECIMAL(10,2),

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_payment_methods" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "gateway_id" TEXT NOT NULL,
    "gateway_customer_id" TEXT NOT NULL,
    "gateway_payment_method_id" TEXT NOT NULL,
    "card_last4" TEXT,
    "card_brand" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plans" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "related_type" "PaymentPlanRelatedType" NOT NULL,
    "related_id" TEXT NOT NULL,
    "total_amount_usd" DECIMAL(10,2) NOT NULL,
    "billing_currency" TEXT NOT NULL,
    "locked_exchange_rate" DECIMAL(18,8) NOT NULL,
    "billing_amount_total" DECIMAL(12,2) NOT NULL,
    "down_payment_amount" DECIMAL(10,2),
    "installments_count" INTEGER NOT NULL,
    "installment_management" "InstallmentManagement" NOT NULL,
    "status" "PaymentPlanStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "payment_plan_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount_billing_currency" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'upcoming',
    "paid_at" TIMESTAMP(3),
    "grace_period_ends_at" DATE,
    "reminder_sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_plan_adjustments" (
    "id" TEXT NOT NULL,
    "payment_plan_id" TEXT NOT NULL,
    "adjustment_type" "PaymentPlanAdjustmentType" NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "requested_by" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_plan_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "related_type" "PaymentPlanRelatedType" NOT NULL,
    "related_id" TEXT NOT NULL,
    "installment_id" TEXT,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "gateway_id" TEXT NOT NULL,
    "gateway_payment_method" "GatewayPaymentMethod",
    "gateway_transaction_id" TEXT,
    "gateway_fee_usd" DECIMAL(10,2),
    "gateway_raw_response" JSONB,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "processed_by" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_policies" (
    "id" TEXT NOT NULL,
    "course_level" "CourseLevel" NOT NULL,
    "instructor_share_percent" DECIMAL(5,2) NOT NULL,
    "platform_share_percent" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "commission_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_commission_agreements" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "course_id" TEXT,
    "instructor_share_percent" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "approved_by" TEXT NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "instructor_commission_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_earnings" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "course_id" TEXT,
    "custom_request_id" TEXT,
    "gross_amount_usd" DECIMAL(10,2) NOT NULL,
    "gateway_fee_usd" DECIMAL(10,2) NOT NULL,
    "net_after_gateway_usd" DECIMAL(10,2) NOT NULL,
    "commission_percent_applied" DECIMAL(5,2) NOT NULL,
    "instructor_earning_usd" DECIMAL(10,2) NOT NULL,
    "platform_fee_usd" DECIMAL(10,2) NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'pending_clearance',
    "clearance_date" DATE,
    "payout_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_payouts" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "gross_amount" DECIMAL(10,2) NOT NULL,
    "net_amount_usd" DECIMAL(10,2) NOT NULL,
    "requires_dual_approval" BOOLEAN NOT NULL DEFAULT false,
    "first_approval_by" TEXT,
    "first_approval_at" TIMESTAMP(3),
    "second_approval_by" TEXT,
    "second_approval_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'calculated',
    "payout_method" "PayoutMethod",
    "execution_reference" TEXT,
    "proof_of_transfer_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instructor_deductions" (
    "id" TEXT NOT NULL,
    "instructor_id" TEXT NOT NULL,
    "earning_id" TEXT NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "reason" "DeductionReason" NOT NULL,
    "status" "DeductionStatus" NOT NULL DEFAULT 'pending',
    "applied_to_payout_id" TEXT,

    CONSTRAINT "instructor_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dual_approval_thresholds" (
    "id" TEXT NOT NULL,
    "min_amount_usd" DECIMAL(10,2) NOT NULL,
    "required_roles" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dual_approval_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_playback_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "device_fingerprint" TEXT NOT NULL,
    "playback_token" TEXT NOT NULL,
    "ip_address" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "suspicious_flag" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "video_playback_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_security_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "event_type" "VideoSecurityEventType" NOT NULL,
    "device_fingerprint" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_review_cases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_type" "SecurityCaseType" NOT NULL,
    "severity" "SecurityCaseSeverity" NOT NULL,
    "related_events" JSONB,
    "status" "SecurityCaseStatus" NOT NULL DEFAULT 'open',
    "assigned_to" TEXT,
    "reviewer_notes" TEXT,
    "resolution" "SecurityCaseResolution",
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_review_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "context_type" "MessageContextType" NOT NULL,
    "context_id" TEXT NOT NULL,
    "raw_content" TEXT NOT NULL,
    "sanitized_content" TEXT,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'clean',
    "detection_layer" TEXT,
    "detected_patterns" JSONB,
    "confidence_score" DECIMAL(3,2),
    "sender_is_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_violations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "violation_type" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "action_taken" "ViolationAction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" "AiUserRole" NOT NULL,
    "feature_type" TEXT NOT NULL,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "model_used" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "related_resource_type" TEXT,
    "related_resource_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_limits" (
    "id" TEXT NOT NULL,
    "role" "AiUserRole" NOT NULL,
    "feature_type" TEXT NOT NULL,
    "scope" "UsageLimitScope" NOT NULL DEFAULT 'per_user',
    "daily_request_limit" INTEGER,
    "monthly_request_limit" INTEGER,
    "monthly_token_budget" INTEGER,
    "monthly_cost_cap_usd" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_limit_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature_type" TEXT NOT NULL,
    "custom_daily_limit" INTEGER,
    "custom_monthly_budget" INTEGER,
    "reason" TEXT,
    "approved_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "ai_usage_limit_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_tracking" (
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "requests_count" INTEGER NOT NULL DEFAULT 0,
    "tokens_consumed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_usage_tracking_pkey" PRIMARY KEY ("user_id","date")
);

-- CreateTable
CREATE TABLE "ai_model_routing" (
    "id" TEXT NOT NULL,
    "feature_type" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "max_tokens" INTEGER NOT NULL,
    "temperature" DECIMAL(2,1) NOT NULL DEFAULT 0.7,
    "requires_human_review" BOOLEAN NOT NULL DEFAULT false,
    "fallback_model_id" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_routing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_moderation_flags" (
    "id" TEXT NOT NULL,
    "interaction_id" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "action_taken" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_moderation_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB,
    "correct_answer" TEXT NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "generated_by" TEXT NOT NULL DEFAULT 'manual',
    "reviewed_by_instructor" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuestionBankStatus" NOT NULL DEFAULT 'draft',
    "locale" "Locale" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_content_embeddings" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "chunk_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_content_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "applicable_roles" JSONB NOT NULL,
    "data_source_query" TEXT NOT NULL,
    "supports_export_formats" JSONB NOT NULL,
    "supports_scheduling" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "filters" JSONB,
    "scope" "ReportScope" NOT NULL,
    "file_url" TEXT,
    "status" "GeneratedReportStatus" NOT NULL DEFAULT 'generating',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "report_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "delivery_channel" "DeliveryChannel" NOT NULL,
    "filters" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_provider_provider_user_id_key" ON "auth_providers"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_session_token_key" ON "user_devices"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "otp_verifications_identifier_purpose_idx" ON "otp_verifications"("identifier", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "staff_invitations_token_key" ON "staff_invitations"("token");

-- CreateIndex
CREATE INDEX "activity_logs_actor_id_created_at_idx" ON "activity_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_resource_type_resource_id_idx" ON "activity_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_translations_course_id_locale_key" ON "course_translations"("course_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "course_translations_locale_slug_key" ON "course_translations"("locale", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_content_lesson_id_locale_key" ON "lesson_content"("lesson_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_student_id_course_id_key" ON "enrollments"("student_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_status_transitions_from_status_to_status_key" ON "request_status_transitions"("from_status", "to_status");

-- CreateIndex
CREATE INDEX "exchange_rates_target_currency_fetched_at_idx" ON "exchange_rates"("target_currency", "fetched_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_provider_key" ON "payment_gateways"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_earnings_payment_id_key" ON "instructor_earnings"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_playback_sessions_playback_token_key" ON "video_playback_sessions"("playback_token");

-- CreateIndex
CREATE INDEX "video_playback_sessions_user_id_lesson_id_idx" ON "video_playback_sessions"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "video_security_events_user_id_created_at_idx" ON "video_security_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "security_review_cases_status_severity_idx" ON "security_review_cases"("status", "severity");

-- CreateIndex
CREATE INDEX "messages_thread_id_idx" ON "messages"("thread_id");

-- CreateIndex
CREATE INDEX "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "communication_violations_user_id_created_at_idx" ON "communication_violations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_interactions_user_id_created_at_idx" ON "ai_interactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_interactions_feature_type_created_at_idx" ON "ai_interactions"("feature_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_limits_role_feature_type_key" ON "ai_usage_limits"("role", "feature_type");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_routing_feature_type_key" ON "ai_model_routing"("feature_type");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_report_key_key" ON "report_definitions"("report_key");

-- AddForeignKey
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_role_id_fkey" FOREIGN KEY ("invited_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invitations" ADD CONSTRAINT "staff_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_profiles" ADD CONSTRAINT "instructor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_translations" ADD CONSTRAINT "course_translations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_content" ADD CONSTRAINT "lesson_content_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_requests" ADD CONSTRAINT "custom_requests_assigned_instructor_id_fkey" FOREIGN KEY ("assigned_instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_files" ADD CONSTRAINT "custom_request_files_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_request_status_log" ADD CONSTRAINT "custom_request_status_log_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "custom_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_payment_methods" ADD CONSTRAINT "saved_payment_methods_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_plan_adjustments" ADD CONSTRAINT "payment_plan_adjustments_payment_plan_id_fkey" FOREIGN KEY ("payment_plan_id") REFERENCES "payment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_gateway_id_fkey" FOREIGN KEY ("gateway_id") REFERENCES "payment_gateways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_commission_agreements" ADD CONSTRAINT "instructor_commission_agreements_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_earnings" ADD CONSTRAINT "instructor_earnings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_earnings" ADD CONSTRAINT "instructor_earnings_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_earnings" ADD CONSTRAINT "instructor_earnings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "instructor_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_payouts" ADD CONSTRAINT "instructor_payouts_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_payouts" ADD CONSTRAINT "instructor_payouts_first_approval_by_fkey" FOREIGN KEY ("first_approval_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_payouts" ADD CONSTRAINT "instructor_payouts_second_approval_by_fkey" FOREIGN KEY ("second_approval_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_deductions" ADD CONSTRAINT "instructor_deductions_applied_to_payout_id_fkey" FOREIGN KEY ("applied_to_payout_id") REFERENCES "instructor_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_playback_sessions" ADD CONSTRAINT "video_playback_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_playback_sessions" ADD CONSTRAINT "video_playback_sessions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_security_events" ADD CONSTRAINT "video_security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_review_cases" ADD CONSTRAINT "security_review_cases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_review_cases" ADD CONSTRAINT "security_review_cases_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

