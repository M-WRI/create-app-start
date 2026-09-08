"""Initial schema — mirrors apps/api Prisma migration 20260308120000_init."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260308120000_init"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS "public"')
    op.execute("""
    DO $$ BEGIN
        CREATE TYPE "UserRole" AS ENUM ('user', 'admin');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" "UserRole" NOT NULL DEFAULT 'user',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "User_pkey" PRIMARY KEY ("id")
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS "RefreshSession" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
    );
    """)
    op.execute("""
    CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "method" TEXT NOT NULL,
        "path" TEXT NOT NULL,
        "statusCode" INTEGER NOT NULL,
        "responseBody" JSONB NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
    );
    """)
    op.execute('CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")')
    op.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash")'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS "RefreshSession_userId_idx" ON "RefreshSession"("userId")'
    )
    op.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key")'
    )
    op.execute("""
    DO $$ BEGIN
        ALTER TABLE "RefreshSession"
            ADD CONSTRAINT "RefreshSession_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;
    """)


def downgrade() -> None:
    op.execute('ALTER TABLE "RefreshSession" DROP CONSTRAINT IF EXISTS "RefreshSession_userId_fkey"')
    op.execute('DROP TABLE IF EXISTS "IdempotencyRecord"')
    op.execute('DROP TABLE IF EXISTS "RefreshSession"')
    op.execute('DROP TABLE IF EXISTS "User"')
    op.execute('DROP TYPE IF EXISTS "UserRole"')
