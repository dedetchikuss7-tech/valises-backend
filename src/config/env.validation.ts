// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().allow('').default(''),

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
});
