import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIService } from './ai.service';
import { LocalAiService } from './local-ai.service';
import { LocalAiController } from './local-ai.controller';
import { UserModule } from '../user/user.module';
import { UserSettings, UserSettingsSchema } from '../user/schemas/user-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
    UserModule,
  ],
  controllers: [LocalAiController],
  providers: [AIService, LocalAiService],
  exports: [AIService, LocalAiService],
})
export class AiModule {} 