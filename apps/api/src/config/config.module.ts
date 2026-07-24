import { Module } from '@nestjs/common';
import { config } from './index';

@Module({})
export class ConfigModule {
  constructor() {
    config();
  }
}
