DO $$ BEGIN
  CREATE TYPE "todo_priority" AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "todos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "input" text NOT NULL,
  "title" text NOT NULL,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "context" text,
  "priority" "todo_priority" DEFAULT 'normal' NOT NULL,
  "due_date" date,
  "completed" boolean DEFAULT false NOT NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "todos_completed_created_at_idx"
  ON "todos" USING btree ("completed", "created_at");

CREATE INDEX IF NOT EXISTS "todos_due_date_idx"
  ON "todos" USING btree ("due_date");
