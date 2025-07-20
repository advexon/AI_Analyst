import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [FileModule, AiModule],
})
export class AnalysisModule {} 