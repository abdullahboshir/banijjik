import dotenv from "dotenv";
import path from "path";
import { z } from "zod";
/**
 * =============================================================================
 * manoxen - ENTERPRISE CONFIGURATION
 * All-in-One: ERP | CRM | HRM | POS | E-Commerce | Logistics | Governance
 * =============================================================================
 */
// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env") });
// ======================== ZOD SCHEMA ========================
const envSchema = z.object({
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    PORT: z.string().default("5000"),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    BACKEND_URL: z.string().url().default("http://localhost:5000"),
    DB_URL: z.string(),
    BCRYPT_SALT_ROUNDS: z.string().default("12"),
    DEFAULT_PASS: z.string().min(6),
    COOKIE_SECRET: z.string(),
    CORS_ORIGIN: z.string().default("*"),
    MAX_UPLOAD_SIZE: z.string().default("10mb"),
    TRUST_PROXY: z.string().default("false"),
    JWT_ACCESS_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),
    JWT_ACCESS_EXPIRED_IN: z.string().default("1d"),
    JWT_REFRESH_EXPIRED_IN: z.string().default("30d"),
    RESET_PASS_UI_LINK: z.string().url(),
    // Super Admin
    SUPER_ADMIN_EMAIL: z.string(),
    SUPER_ADMIN_PASS: z.string(),
    SYSTEM_USER_ID: z.string(),
    // File Storage (Cloudinary - Optional if using Local/S3)
    CLOUD_NAME: z.string().default(""),
    CLOUD_API_KEY: z.string().default(""),
    CLOUD_API_SECRET: z.string().default(""),
    // Cache & Queue (Redis - Optional default)
    REDIS_URL: z.string().default("redis://localhost:6379"),
    WORKERS: z.string().default("2"),
    ENABLE_QUEUE: z.string().default("true"),
    CACHE_TTL_SECONDS: z.string().default("3600"),
    // Email (SMTP)
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.string().default("587"),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    SMTP_FROM: z.string().default(""),
    SMTP_FROM_NAME: z.string().default("Manoxen"),
    // SMS Gateway (Optional)
    SMS_PROVIDER: z.string().default(""),
    SMS_API_KEY: z.string().default(""),
    SMS_SENDER_ID: z.string().default(""),
    // Payment Gateways (Optional)
    STRIPE_SECRET_KEY: z.string().default(""),
    STRIPE_WEBHOOK_SECRET: z.string().default(""),
    BKASH_APP_KEY: z.string().default(""),
    BKASH_APP_SECRET: z.string().default(""),
    BKASH_USERNAME: z.string().default(""),
    BKASH_PASSWORD: z.string().default(""),
    BKASH_BASE_URL: z.string().default(""),
    NAGAD_MERCHANT_ID: z.string().default(""),
    NAGAD_MERCHANT_KEY: z.string().default(""),
    NAGAD_BASE_URL: z.string().default(""),
    SSLCOMMERZ_STORE_ID: z.string().default(""),
    SSLCOMMERZ_STORE_PASSWORD: z.string().default(""),
    SSLCOMMERZ_IS_SANDBOX: z.string().default("true"),
    // Courier / Logistics (Optional)
    STEADFAST_API_KEY: z.string().default(""),
    STEADFAST_SECRET_KEY: z.string().default(""),
    STEADFAST_BASE_URL: z.string().default(""),
    PATHAO_CLIENT_ID: z.string().default(""),
    PATHAO_CLIENT_SECRET: z.string().default(""),
    PATHAO_BASE_URL: z.string().default(""),
    REDX_API_KEY: z.string().default(""),
    REDX_BASE_URL: z.string().default(""),
    // Marketplace Integrations (Optional)
    DARAZ_APP_KEY: z.string().default(""),
    DARAZ_APP_SECRET: z.string().default(""),
    DARAZ_ACCESS_TOKEN: z.string().default(""),
    FACEBOOK_APP_ID: z.string().default(""),
    FACEBOOK_APP_SECRET: z.string().default(""),
    FACEBOOK_ACCESS_TOKEN: z.string().default(""),
    // Analytics & Monitoring (Optional)
    GOOGLE_ANALYTICS_ID: z.string().default(""),
    SENTRY_DSN: z.string().default(""),
    LOG_LEVEL: z.string().default("info"),
    // Feature Flags
    ENABLE_FRAUD_DETECTION: z.string().default("true"),
    ENABLE_REAL_TIME_SYNC: z.string().default("false"),
    ENABLE_AI_FEATURES: z.string().default("false"),
    // File Storage
    STORAGE_PROVIDER: z.string().default("cloudinary"),
    CDN_URL: z.string().default(""),
    AWS_ACCESS_KEY_ID: z.string().default(""),
    AWS_SECRET_ACCESS_KEY: z.string().default(""),
    AWS_REGION: z.string().default("ap-southeast-1"),
    AWS_S3_BUCKET: z.string().default(""),
    // Backup & Security
    ENABLE_AUTO_BACKUP: z.string().default("false"),
    BACKUP_S3_BUCKET: z.string().default(""),
    BACKUP_SCHEDULE_CRON: z.string().default("0 0 * * *"),
    AUDIT_LOG_RETENTION_DAYS: z.string().default("90"),
    // OAuth / Social Login
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    GOOGLE_CALLBACK_URL: z
        .string()
        .default("http://localhost:5000/api/auth/google/callback"),
    FACEBOOK_OAUTH_APP_ID: z.string().default(""),
    FACEBOOK_OAUTH_APP_SECRET: z.string().default(""),
    FACEBOOK_OAUTH_CALLBACK_URL: z
        .string()
        .default("http://localhost:5000/api/auth/facebook/callback"),
    // Messaging / Notifications
    WHATSAPP_API_KEY: z.string().default(""),
    WHATSAPP_PHONE_NUMBER_ID: z.string().default(""),
    WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(""),
    TELEGRAM_BOT_TOKEN: z.string().default(""),
    TELEGRAM_CHAT_ID: z.string().default(""),
    FIREBASE_PROJECT_ID: z.string().default(""),
    FIREBASE_PRIVATE_KEY: z.string().default(""),
    FIREBASE_CLIENT_EMAIL: z.string().default(""),
    // AI / ML Services
    OPENAI_API_KEY: z.string().default(""),
    GEMINI_API_KEY: z.string().default(""),
    // Marketing & Tracking
    GOOGLE_MAPS_API_KEY: z.string().default(""),
    FACEBOOK_PIXEL_ID: z.string().default(""),
    // DevOps & Admin
    MAINTENANCE_MODE: z.string().default("false"),
    ADMIN_REGISTRATION_SECRET: z.string().default(""),
    // Misc
    TZ: z.string().default("Asia/Dhaka"),
    RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
    RATE_LIMIT_MAX_REQUESTS: z.string().default("100"),
    DEFAULT_PAGE_SIZE: z.string().default("20"),
    MAX_PAGE_SIZE: z.string().default("100"),
});
const parsedEnv = envSchema.parse(process.env);
// ======================== CONFIG OBJECT ========================
const appConfig = {
    // Core
    NODE_ENV: parsedEnv.NODE_ENV,
    port: parsedEnv.PORT,
    frontend_url: parsedEnv.FRONTEND_URL,
    backend_url: parsedEnv.BACKEND_URL,
    // Database
    db_url: parsedEnv.DB_URL,
    // Security
    bcrypt_salt_rounds: parsedEnv.BCRYPT_SALT_ROUNDS,
    default_pass: parsedEnv.DEFAULT_PASS,
    cookie_secret: parsedEnv.COOKIE_SECRET,
    cors_origin: parsedEnv.CORS_ORIGIN.split(","),
    max_upload_size: parsedEnv.MAX_UPLOAD_SIZE,
    trust_proxy: parsedEnv.TRUST_PROXY === "true",
    jwt_access_secret: parsedEnv.JWT_ACCESS_SECRET,
    jwt_refresh_secret: parsedEnv.JWT_REFRESH_SECRET,
    jwt_access_expired_in: parsedEnv.JWT_ACCESS_EXPIRED_IN,
    jwt_refresh_expired_in: parsedEnv.JWT_REFRESH_EXPIRED_IN,
    reset_pass_ui_link: parsedEnv.RESET_PASS_UI_LINK,
    // Super Admin
    super_admin_email: parsedEnv.SUPER_ADMIN_EMAIL,
    super_admin_pass: parsedEnv.SUPER_ADMIN_PASS,
    system_user_id: parsedEnv.SYSTEM_USER_ID,
    // File Storage
    cloud_name: parsedEnv.CLOUD_NAME,
    cloud_api_key: parsedEnv.CLOUD_API_KEY,
    cloud_api_secret: parsedEnv.CLOUD_API_SECRET,
    // Cache & Queue
    redis_url: parsedEnv.REDIS_URL,
    workers: parseInt(parsedEnv.WORKERS),
    enable_queue: parsedEnv.ENABLE_QUEUE === "true",
    cache_ttl_seconds: parseInt(parsedEnv.CACHE_TTL_SECONDS),
    // Email (SMTP)
    smtp_host: parsedEnv.SMTP_HOST,
    smtp_port: parseInt(parsedEnv.SMTP_PORT),
    smtp_user: parsedEnv.SMTP_USER,
    smtp_pass: parsedEnv.SMTP_PASS,
    smtp_from: parsedEnv.SMTP_FROM,
    smtp_from_name: parsedEnv.SMTP_FROM_NAME,
    // SMS Gateway
    sms: {
        provider: parsedEnv.SMS_PROVIDER,
        api_key: parsedEnv.SMS_API_KEY,
        sender_id: parsedEnv.SMS_SENDER_ID,
    },
    // Payment Gateways (Centralized)
    payment: {
        stripe: {
            secret_key: parsedEnv.STRIPE_SECRET_KEY,
            webhook_secret: parsedEnv.STRIPE_WEBHOOK_SECRET,
        },
        bkash: {
            app_key: parsedEnv.BKASH_APP_KEY,
            app_secret: parsedEnv.BKASH_APP_SECRET,
            username: parsedEnv.BKASH_USERNAME,
            password: parsedEnv.BKASH_PASSWORD,
            base_url: parsedEnv.BKASH_BASE_URL,
        },
        nagad: {
            merchant_id: parsedEnv.NAGAD_MERCHANT_ID,
            merchant_key: parsedEnv.NAGAD_MERCHANT_KEY,
            base_url: parsedEnv.NAGAD_BASE_URL,
        },
        sslcommerz: {
            store_id: parsedEnv.SSLCOMMERZ_STORE_ID,
            store_password: parsedEnv.SSLCOMMERZ_STORE_PASSWORD,
            is_sandbox: parsedEnv.SSLCOMMERZ_IS_SANDBOX === "true",
        },
    },
    // Courier / Logistics (Centralized)
    courier: {
        steadfast: {
            api_key: parsedEnv.STEADFAST_API_KEY,
            secret_key: parsedEnv.STEADFAST_SECRET_KEY,
            base_url: parsedEnv.STEADFAST_BASE_URL,
        },
        pathao: {
            client_id: parsedEnv.PATHAO_CLIENT_ID,
            client_secret: parsedEnv.PATHAO_CLIENT_SECRET,
            base_url: parsedEnv.PATHAO_BASE_URL,
        },
        redx: {
            api_key: parsedEnv.REDX_API_KEY,
            base_url: parsedEnv.REDX_BASE_URL,
        },
    },
    // Marketplace Integrations (Centralized)
    marketplace: {
        daraz: {
            app_key: parsedEnv.DARAZ_APP_KEY,
            app_secret: parsedEnv.DARAZ_APP_SECRET,
            access_token: parsedEnv.DARAZ_ACCESS_TOKEN,
        },
        facebook: {
            app_id: parsedEnv.FACEBOOK_APP_ID,
            app_secret: parsedEnv.FACEBOOK_APP_SECRET,
            access_token: parsedEnv.FACEBOOK_ACCESS_TOKEN,
        },
    },
    // Analytics & Monitoring
    analytics: {
        google_analytics_id: parsedEnv.GOOGLE_ANALYTICS_ID,
        sentry_dsn: parsedEnv.SENTRY_DSN,
        log_level: parsedEnv.LOG_LEVEL,
    },
    // Feature Flags
    features: {
        fraud_detection: parsedEnv.ENABLE_FRAUD_DETECTION === "true",
        real_time_sync: parsedEnv.ENABLE_REAL_TIME_SYNC === "true",
        ai_features: parsedEnv.ENABLE_AI_FEATURES === "true",
    },
    // File Storage (Centralized)
    storage: {
        provider: parsedEnv.STORAGE_PROVIDER,
        cdn_url: parsedEnv.CDN_URL,
        cloudinary: {
            cloud_name: parsedEnv.CLOUD_NAME,
            api_key: parsedEnv.CLOUD_API_KEY,
            api_secret: parsedEnv.CLOUD_API_SECRET,
        },
        s3: {
            access_key_id: parsedEnv.AWS_ACCESS_KEY_ID,
            secret_access_key: parsedEnv.AWS_SECRET_ACCESS_KEY,
            region: parsedEnv.AWS_REGION,
            bucket: parsedEnv.AWS_S3_BUCKET,
        },
    },
    // Backup & Security (Enterprise)
    backup: {
        enabled: parsedEnv.ENABLE_AUTO_BACKUP === "true",
        s3_bucket: parsedEnv.BACKUP_S3_BUCKET,
        schedule: parsedEnv.BACKUP_SCHEDULE_CRON,
        audit_retention_days: parseInt(parsedEnv.AUDIT_LOG_RETENTION_DAYS),
    },
    // OAuth / Social Login (Centralized)
    oauth: {
        google: {
            client_id: parsedEnv.GOOGLE_CLIENT_ID,
            client_secret: parsedEnv.GOOGLE_CLIENT_SECRET,
            callback_url: parsedEnv.GOOGLE_CALLBACK_URL,
        },
        facebook: {
            app_id: parsedEnv.FACEBOOK_OAUTH_APP_ID,
            app_secret: parsedEnv.FACEBOOK_OAUTH_APP_SECRET,
            callback_url: parsedEnv.FACEBOOK_OAUTH_CALLBACK_URL,
        },
    },
    // Messaging / Notifications (Centralized)
    messaging: {
        whatsapp: {
            api_key: parsedEnv.WHATSAPP_API_KEY,
            phone_number_id: parsedEnv.WHATSAPP_PHONE_NUMBER_ID,
            business_account_id: parsedEnv.WHATSAPP_BUSINESS_ACCOUNT_ID,
        },
        telegram: {
            bot_token: parsedEnv.TELEGRAM_BOT_TOKEN,
            chat_id: parsedEnv.TELEGRAM_CHAT_ID,
        },
        firebase: {
            project_id: parsedEnv.FIREBASE_PROJECT_ID,
            private_key: parsedEnv.FIREBASE_PRIVATE_KEY,
            client_email: parsedEnv.FIREBASE_CLIENT_EMAIL,
        },
    },
    // AI / ML Services (Centralized)
    ai: {
        openai_api_key: parsedEnv.OPENAI_API_KEY,
        gemini_api_key: parsedEnv.GEMINI_API_KEY,
    },
    // Marketing & Tracking
    marketing: {
        google_maps_api_key: parsedEnv.GOOGLE_MAPS_API_KEY,
        facebook_pixel_id: parsedEnv.FACEBOOK_PIXEL_ID,
    },
    // Security (Admin & Ops)
    security: {
        admin_registration_secret: parsedEnv.ADMIN_REGISTRATION_SECRET,
        maintenance_mode: parsedEnv.MAINTENANCE_MODE === "true",
    },
    // Misc / Defaults
    misc: {
        timezone: parsedEnv.TZ,
        rate_limit: {
            window_ms: parseInt(parsedEnv.RATE_LIMIT_WINDOW_MS),
            max_requests: parseInt(parsedEnv.RATE_LIMIT_MAX_REQUESTS),
        },
        pagination: {
            default_page_size: parseInt(parsedEnv.DEFAULT_PAGE_SIZE),
            max_page_size: parseInt(parsedEnv.MAX_PAGE_SIZE),
        },
    },
    // Dynamic Access (Legacy Support)
    [Symbol.for("nodejs.util.inspect.custom")]: () => "[AppConfig]",
};
export { appConfig };
//# sourceMappingURL=app.config.js.map