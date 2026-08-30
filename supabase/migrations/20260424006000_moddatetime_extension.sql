-- Fix 1: ensure moddatetime extension is available for all tenants
-- Applied manually to The Mentor (dpxgegdmdusotjiriwrp) on 2026-04-24.
-- This migration ensures future tenant bootstraps also have it.

CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;
