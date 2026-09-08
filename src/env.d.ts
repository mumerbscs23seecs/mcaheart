/// <reference types="astro/client" />

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person } from './lib/pipeline-auth';

declare global {
  namespace App {
    interface Locals {
      /** Set by src/middleware.ts on authenticated /pipeline requests. */
      supabase: SupabaseClient;
      person: Person;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
  readonly GMAIL_USER?: string;
  readonly GMAIL_APP_PASSWORD?: string;
  readonly RESEND_API_KEY?: string;
  readonly NOTIFY_FROM?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
