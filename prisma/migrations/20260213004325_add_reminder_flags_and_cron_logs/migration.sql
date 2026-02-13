-- CreateEnum
CREATE TYPE "CronStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'TIMEOUT');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "reminder_24h_error" TEXT,
ADD COLUMN     "reminder_24h_failed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_24h_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_24h_sent_at" TIMESTAMP(3),
ADD COLUMN     "reminder_same_day_error" TEXT,
ADD COLUMN     "reminder_same_day_failed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_same_day_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_same_day_sent_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cron_logs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" "CronStatus" NOT NULL DEFAULT 'RUNNING',
    "appointments_checked" INTEGER NOT NULL DEFAULT 0,
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "reminders_failed" INTEGER NOT NULL DEFAULT 0,
    "retries_attempted" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_stack" TEXT,
    "duration_ms" INTEGER,
    "request_id" TEXT,
    "triggered_by" TEXT NOT NULL DEFAULT 'cron',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_logs_job_name_started_at_idx" ON "cron_logs"("job_name", "started_at");

-- CreateIndex
CREATE INDEX "cron_logs_status_idx" ON "cron_logs"("status");

-- CreateIndex
CREATE INDEX "cron_logs_created_at_idx" ON "cron_logs"("created_at");

-- CreateIndex
CREATE INDEX "cron_logs_started_at_idx" ON "cron_logs"("started_at");

-- CreateIndex
CREATE INDEX "appointments_reminder_24h_sent_reminder_24h_failed_idx" ON "appointments"("reminder_24h_sent", "reminder_24h_failed");

-- CreateIndex
CREATE INDEX "appointments_reminder_same_day_sent_reminder_same_day_faile_idx" ON "appointments"("reminder_same_day_sent", "reminder_same_day_failed");
