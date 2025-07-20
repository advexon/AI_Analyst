import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserSettingsDocument = UserSettings & Document;

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      // Never expose encrypted API keys in JSON response
      if (ret.encryptedApiKeys) {
        delete ret.encryptedApiKeys;
      }
      return ret;
    },
  },
})
export class UserSettings {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId: Types.ObjectId;

  @Prop({ type: Object })
  encryptedApiKeys?: {
    openai?: string;
    gemini?: string;
    claude?: string;
    grok?: string;
  };

  @Prop({ default: 'gpt-3.5-turbo' })
  defaultAiModel?: string;

  @Prop({ default: true })
  emailNotifications?: boolean;

  @Prop({ default: 'light' })
  theme?: string;

  @Prop({ default: 'en' })
  language?: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings); 