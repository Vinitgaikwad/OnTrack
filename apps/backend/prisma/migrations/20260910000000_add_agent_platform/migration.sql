-- CreateEnum
CREATE TYPE "AgentTriggerType" AS ENUM ('manual', 'schedule');

-- CreateEnum
CREATE TYPE "AgentOutputType" AS ENUM ('message', 'note', 'email');

-- AlterTable
ALTER TABLE "Agent"
    ADD COLUMN "templateId" TEXT,
    ADD COLUMN "triggerType" "AgentTriggerType" NOT NULL DEFAULT 'manual',
    ADD COLUMN "schedule" TEXT,
    ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
    ADD COLUMN "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "output" "AgentOutputType" NOT NULL DEFAULT 'message',
    ADD COLUMN "prompt" TEXT,
    ADD COLUMN "draftOnly" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "modelKeyId" TEXT,
    ADD COLUMN "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    ADD COLUMN "lastRunAt" TIMESTAMP(3),
    ADD COLUMN "nextRunAt" TIMESTAMP(3),
    ADD COLUMN "runCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "AgentTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "requiresOAuth" TEXT,
    "defaultRole" TEXT NOT NULL,
    "defaultPrompt" TEXT NOT NULL,
    "defaultSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultOutput" "AgentOutputType" NOT NULL DEFAULT 'message',
    "configSchema" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "baseUrl" TEXT,
    "defaultModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTool" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,

    CONSTRAINT "AgentTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "inputSnap" TEXT,
    "outputSnap" TEXT,
    "toolCalls" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "email" TEXT,
    "scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenEnc" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTemplate_slug_key" ON "AgentTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelKey_userId_provider_label_key" ON "ModelKey"("userId", "provider", "label");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTool_agentId_toolName_key" ON "AgentTool"("agentId", "toolName");

-- CreateIndex
CREATE INDEX "AgentTool_agentId_idx" ON "AgentTool"("agentId");

-- CreateIndex
CREATE INDEX "AgentRun_userId_agentId_startedAt_idx" ON "AgentRun"("userId", "agentId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentMessage_userId_read_idx" ON "AgentMessage"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccount_userId_provider_email_key" ON "IntegrationAccount"("userId", "provider", "email");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_modelKeyId_fkey" FOREIGN KEY ("modelKeyId") REFERENCES "ModelKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelKey" ADD CONSTRAINT "ModelKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTool" ADD CONSTRAINT "AgentTool_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccount" ADD CONSTRAINT "IntegrationAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;