import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AccessGuard, AuthorizationGuard, RateLimitGuard, CoreModule, RequestIdMiddleware } from './common';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { HealthModule } from './modules/health/health.module';
import { ConfigModule } from './config/config.module';
import { config } from './config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { MatchingModule } from './modules/matching/matching.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { TestsModule } from './modules/tests/tests.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { SupportModule } from './modules/support/support.module';
import { AdminModule } from './modules/admin/admin.module';
import { FilesModule } from './modules/files/files.module';
import { QueueModule } from './modules/queue/queue.module';
import { LearningModule } from './modules/learning/learning.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { SearchModule } from './modules/search/search.module';
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    InfrastructureModule,
    CoreModule,
    ScheduleModule.forRoot(),
    HealthModule,
    QueueModule,
    FilesModule,
    JwtModule.register({ global: true, secret: config().JWT_ACCESS_SECRET }),
    AuthModule,
    UsersModule,
    LanguagesModule,
    SearchModule,
    TeachersModule,
    MatchingModule,
    BookingsModule,
    TestsModule,
    CommerceModule,
    SupportModule,
    LearningModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
})
export class AppModule implements NestModule {
  configure(c: MiddlewareConsumer) {
    c.apply(RequestIdMiddleware).forRoutes('*');
  }
}
