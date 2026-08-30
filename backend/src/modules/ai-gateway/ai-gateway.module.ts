import { Module } from '@nestjs/common';
import { AiGatewayController } from './ai-gateway.controller';
import { AiGatewayService } from './ai-gateway.service';
import { AiUsageGuardService } from './ai-usage-guard.service';
import { AiModelRouterService } from './ai-model-router.service';
import { CourseAssistantService } from './course-assistant.service';
import { QuestionBankReviewService } from './question-bank-review.service';
import { PromptInjectionDetectorService } from './prompt-injection-detector.service';
import { CostCalculatorService } from './cost-calculator.service';
import { EmbeddingService } from './rag/embedding.service';
import { ChunkingService } from './rag/chunking.service';
import { ContentIngestionService } from './rag/content-ingestion.service';
import { RetrievalService } from './rag/retrieval.service';

@Module({
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    AiUsageGuardService,
    AiModelRouterService,
    CourseAssistantService,
    QuestionBankReviewService,
    PromptInjectionDetectorService,
    CostCalculatorService,
    EmbeddingService,
    ChunkingService,
    ContentIngestionService,
    RetrievalService,
  ],
  exports: [AiGatewayService, ContentIngestionService],
})
export class AiGatewayModule {}
