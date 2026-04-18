-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('waiter', 'manager');

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('waiter', 'bill');

-- CreateEnum
CREATE TYPE "BillLineSource" AS ENUM ('guest', 'waiter');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('expo', 'ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "FloorTableShape" AS ENUM ('square', 'round', 'rect');

-- CreateEnum
CREATE TYPE "FloorTableSizePreset" AS ENUM ('sm', 'md', 'lg');

-- CreateEnum
CREATE TYPE "ActivityActorRole" AS ENUM ('guest', 'waiter', 'manager', 'system');

-- CreateEnum
CREATE TYPE "WaiterTaskType" AS ENUM ('waiter_call', 'bill_request', 'follow_up');

-- CreateEnum
CREATE TYPE "WaiterTaskPriority" AS ENUM ('urgent', 'normal');

-- CreateEnum
CREATE TYPE "WaiterTaskStatus" AS ENUM ('open', 'acknowledged', 'in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" INTEGER NOT NULL,
    "label" TEXT,
    "shape" "FloorTableShape" NOT NULL DEFAULT 'square',
    "sizePreset" "FloorTableSizePreset" NOT NULL DEFAULT 'md',
    "floorX" DOUBLE PRECISION,
    "floorY" DOUBLE PRECISION,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAssignment" (
    "id" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "waiterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TableAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "waiterCooldownUntil" TIMESTAMP(3),
    "billCooldownUntil" TIMESTAMP(3),
    "doneCooldownUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "type" "ServiceRequestType" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "dishId" TEXT,
    "title" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "source" "BillLineSource" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waiterOrderBatchId" TEXT,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiterTask" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "waiterId" TEXT,
    "type" "WaiterTaskType" NOT NULL,
    "priority" "WaiterTaskPriority" NOT NULL DEFAULT 'normal',
    "status" "WaiterTaskStatus" NOT NULL DEFAULT 'open',
    "sourceRequestId" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "note" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completionMutationKey" TEXT,

    CONSTRAINT "WaiterTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiterShortcutPreference" (
    "waiterId" TEXT NOT NULL,
    "favoriteDishIds" JSONB NOT NULL,
    "noteTemplates" JSONB NOT NULL,
    "quickOrderPresets" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiterShortcutPreference_pkey" PRIMARY KEY ("waiterId")
);

-- CreateTable
CREATE TABLE "WaiterOrderBatch" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "waiterId" TEXT NOT NULL,
    "clientMutationKey" TEXT,
    "repeatedFromBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiterOrderBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewPrompt" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "waiterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestReview" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" INTEGER NOT NULL,
    "waiterId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceActivityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorRole" "ActivityActorRole" NOT NULL,
    "actorId" TEXT,
    "tableId" INTEGER,
    "tableSessionId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "deviceId" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRefreshSession" (
    "id" TEXT NOT NULL,
    "staffUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logo" TEXT NOT NULL,
    "banner" TEXT NOT NULL,
    "wifiName" TEXT NOT NULL,
    "wifiPassword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "managerSoundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "floorPlan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "nameIt" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "image" TEXT NOT NULL,
    "portion" TEXT NOT NULL,
    "energyKcal" INTEGER NOT NULL,
    "badgeLabel" TEXT,
    "badgeTone" TEXT,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_login_key" ON "StaffUser"("login");

-- CreateIndex
CREATE INDEX "RestaurantTable_archivedAt_id_idx" ON "RestaurantTable"("archivedAt", "id");

-- CreateIndex
CREATE INDEX "TableAssignment_tableId_endedAt_idx" ON "TableAssignment"("tableId", "endedAt");

-- CreateIndex
CREATE INDEX "TableAssignment_waiterId_endedAt_idx" ON "TableAssignment"("waiterId", "endedAt");

-- CreateIndex
CREATE INDEX "TableSession_tableId_closedAt_startedAt_idx" ON "TableSession"("tableId", "closedAt", "startedAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_tableId_resolvedAt_type_idx" ON "ServiceRequest"("tableId", "resolvedAt", "type");

-- CreateIndex
CREATE INDEX "ServiceRequest_tableSessionId_resolvedAt_idx" ON "ServiceRequest"("tableSessionId", "resolvedAt");

-- CreateIndex
CREATE INDEX "BillLine_tableId_createdAt_idx" ON "BillLine"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "BillLine_tableSessionId_createdAt_idx" ON "BillLine"("tableSessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaiterTask_sourceRequestId_key" ON "WaiterTask"("sourceRequestId");

-- CreateIndex
CREATE INDEX "WaiterTask_waiterId_status_priority_createdAt_idx" ON "WaiterTask"("waiterId", "status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "WaiterTask_tableSessionId_status_createdAt_idx" ON "WaiterTask"("tableSessionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WaiterTask_tableId_status_createdAt_idx" ON "WaiterTask"("tableId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaiterOrderBatch_clientMutationKey_key" ON "WaiterOrderBatch"("clientMutationKey");

-- CreateIndex
CREATE INDEX "WaiterOrderBatch_tableSessionId_createdAt_idx" ON "WaiterOrderBatch"("tableSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "WaiterOrderBatch_waiterId_createdAt_idx" ON "WaiterOrderBatch"("waiterId", "createdAt");

-- CreateIndex
CREATE INDEX "WaiterOrderBatch_tableId_createdAt_idx" ON "WaiterOrderBatch"("tableId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionNote_tableSessionId_key" ON "SessionNote"("tableSessionId");

-- CreateIndex
CREATE INDEX "ReviewPrompt_tableId_expiresAt_resolvedAt_idx" ON "ReviewPrompt"("tableId", "expiresAt", "resolvedAt");

-- CreateIndex
CREATE INDEX "ReviewPrompt_tableSessionId_expiresAt_idx" ON "ReviewPrompt"("tableSessionId", "expiresAt");

-- CreateIndex
CREATE INDEX "GuestReview_tableId_createdAt_idx" ON "GuestReview"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceActivityEvent_createdAt_idx" ON "ServiceActivityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ServiceActivityEvent_tableId_createdAt_idx" ON "ServiceActivityEvent"("tableId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceActivityEvent_actorId_createdAt_idx" ON "ServiceActivityEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceActivityEvent_type_createdAt_idx" ON "ServiceActivityEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_token_key" ON "PushDevice"("token");

-- CreateIndex
CREATE INDEX "PushDevice_staffUserId_updatedAt_idx" ON "PushDevice"("staffUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "StaffRefreshSession_staffUserId_revokedAt_idx" ON "StaffRefreshSession"("staffUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "StaffRefreshSession_expiresAt_idx" ON "StaffRefreshSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Dish_categoryId_sortOrder_idx" ON "Dish"("categoryId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAssignment" ADD CONSTRAINT "TableAssignment_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_waiterOrderBatchId_fkey" FOREIGN KEY ("waiterOrderBatchId") REFERENCES "WaiterOrderBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterTask" ADD CONSTRAINT "WaiterTask_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterTask" ADD CONSTRAINT "WaiterTask_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterTask" ADD CONSTRAINT "WaiterTask_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterShortcutPreference" ADD CONSTRAINT "WaiterShortcutPreference_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterOrderBatch" ADD CONSTRAINT "WaiterOrderBatch_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterOrderBatch" ADD CONSTRAINT "WaiterOrderBatch_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterOrderBatch" ADD CONSTRAINT "WaiterOrderBatch_repeatedFromBatchId_fkey" FOREIGN KEY ("repeatedFromBatchId") REFERENCES "WaiterOrderBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPrompt" ADD CONSTRAINT "ReviewPrompt_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPrompt" ADD CONSTRAINT "ReviewPrompt_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestReview" ADD CONSTRAINT "GuestReview_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestReview" ADD CONSTRAINT "GuestReview_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRefreshSession" ADD CONSTRAINT "StaffRefreshSession_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

