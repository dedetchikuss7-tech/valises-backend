// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().allow('').default(''),
  CORS_ALLOW_FLUTTERFLOW: Joi.boolean().truthy('true').falsy('false').default(false),

  SENTRY_DSN: Joi.string().uri().optional(),

  PAYMENT_PROVIDER: Joi.string().valid('MOCK', 'CINETPAY').default('MOCK'),

  CINETPAY_API_KEY: Joi.string().when('PAYMENT_PROVIDER', {
    is: 'CINETPAY',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  CINETPAY_SITE_ID: Joi.string().when('PAYMENT_PROVIDER', {
    is: 'CINETPAY',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  CINETPAY_NOTIFY_URL: Joi.string().uri().when('PAYMENT_PROVIDER', {
    is: 'CINETPAY',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  CINETPAY_ENV: Joi.string().valid('sandbox', 'production').default('sandbox'),

  CINETPAY_RETURN_URL: Joi.string().uri().optional(),

  STORAGE_PROVIDER: Joi.string().valid('MOCK_STORAGE', 'S3').default('MOCK_STORAGE'),

  S3_BUCKET: Joi.string().when('STORAGE_PROVIDER', {
    is: 'S3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  S3_REGION: Joi.string().when('STORAGE_PROVIDER', {
    is: 'S3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  AWS_ACCESS_KEY_ID: Joi.string().when('STORAGE_PROVIDER', {
    is: 'S3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  AWS_SECRET_ACCESS_KEY: Joi.string().when('STORAGE_PROVIDER', {
    is: 'S3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  KYC_PROVIDER: Joi.string().valid('STRIPE_IDENTITY', 'SMILE_ID').default('STRIPE_IDENTITY'),

  STRIPE_SECRET_KEY: Joi.string().optional(),

  KYC_STRIPE_RETURN_URL: Joi.string().uri().optional(),

  SMILE_ID_PARTNER_ID: Joi.string().when('KYC_PROVIDER', {
    is: 'SMILE_ID',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  SMILE_ID_API_KEY: Joi.string().when('KYC_PROVIDER', {
    is: 'SMILE_ID',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  SMILE_ID_CALLBACK_URL: Joi.string().uri().when('KYC_PROVIDER', {
    is: 'SMILE_ID',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  PROVIDER_WEBHOOK_SECRET_CINETPAY: Joi.string().optional(),
  WEBHOOK_REPLAY_WINDOW_SECONDS: Joi.number().integer().positive().default(300),

  NOTIFICATIONS_PROVIDER: Joi.string().valid('MOCK', 'SENDGRID').default('MOCK'),

  SENDGRID_API_KEY: Joi.string().when('NOTIFICATIONS_PROVIDER', {
    is: 'SENDGRID',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  SENDGRID_FROM_EMAIL: Joi.string().email().when('NOTIFICATIONS_PROVIDER', {
    is: 'SENDGRID',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});
