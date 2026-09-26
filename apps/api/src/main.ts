import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppEnv } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = app.get(ConfigService<AppEnv, true>).get('PORT', { infer: true });
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
}

void bootstrap();
