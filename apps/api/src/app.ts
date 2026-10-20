import 'reflect-metadata';
import { Controller, Get, Global, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { Database } from './database';
import { AuthController, SessionGuard } from './auth';
import { ReservationsController, ReservationsService } from './reservations';
import { Worker } from './worker';
import { Request, Response, NextFunction } from 'express';

@Global()
@Module({ providers: [Database], exports: [Database] })
class DatabaseModule {}

@Module({ controllers: [AuthController], providers: [SessionGuard], exports: [SessionGuard] })
class AuthModule {}

@Module({
  imports: [AuthModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, Worker],
})
class ReservationsModule {}
@Controller('health')
class HealthController {
  constructor(private readonly db: Database) {}
  @Get() async health() {
    await this.db.pool.query('SELECT 1');
    return { status: 'ok' };
  }
}
@Module({
  imports: [DatabaseModule, AuthModule, ReservationsModule],
  controllers: [HealthController],
})
class AppModule {}
export async function createApp(quiet = false) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const app = await NestFactory.create(AppModule, {
    logger: quiet ? false : ['log', 'warn', 'error'],
  });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  const attempts = new Map<string, { count: number; until: number }>();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const started = performance.now();
    res.on('finish', () => {
      if (!quiet)
        console.log(
          JSON.stringify({
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Math.round(performance.now() - started),
          }),
        );
    });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && origin !== (process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5178'))
        return res.status(403).json({ message: 'Origem não permitida.' });
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return res.status(403).json({ message: 'Requisição entre sites não permitida.' });
    }
    if (req.path === '/api/auth/login') {
      const now = Date.now();
      for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
      const key = req.ip ?? 'unknown';
      const item = attempts.get(key) ?? { count: 0, until: now + 60000 };
      item.count++;
      attempts.set(key, item);
      if (item.count > 20) {
        res.setHeader('Retry-After', Math.ceil((item.until - now) / 1000));
        return res.status(429).json({ message: 'Muitas tentativas. Aguarde um minuto.' });
      }
    }
    next();
  });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Slotline API')
      .setDescription(
        'Resource reservations with PostgreSQL exclusion constraints and transactional outbox. Calendar timezone: America/Sao_Paulo.',
      )
      .setVersion('0.1.0')
      .addCookieAuth('slotline')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
  app.enableShutdownHooks();
  return app;
}
