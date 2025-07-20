import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserSettingsService } from './user-settings.service';
import { UserSettingsController } from './user-settings.controller';
import { User, UserSchema } from './schemas/user.schema';
import { UserSettings, UserSettingsSchema } from './schemas/user-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
  ],
  controllers: [UserController, UserSettingsController],
  providers: [UserService, UserSettingsService],
  exports: [UserService, UserSettingsService],
})
export class UserModule {} 