import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { RateLimitGuard, RequestIdMiddleware } from './common';
import { AuthorizationGuard } from './modules/auth/authorization';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { SystemModule } from './system/system.module';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessGuard } from './modules/auth/access-token.guard';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { MatchingModule } from './modules/matching/matching.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { CommerceModule } from './modules/commerce/commerce.module';
import { SupportModule } from './modules/support/support.module';
import { AdminDashboardModule } from './application/admin-dashboard/admin-dashboard.module';
import { FilesModule } from './modules/files/files.module';
import { LearningModule } from './modules/learning/learning.module';
import { LanguagesModule } from './modules/languages/languages.module';
import { SearchModule } from './application/search/search.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ContentModule } from './modules/content/content.module';
import { BlogModule } from './modules/blog/blog.module';
import { CoursesModule } from './modules/courses/courses.module';
@Module({
  imports: [
    ConfigModule,
    InfrastructureModule,
    ScheduleModule.forRoot(),
    SystemModule,
    SettingsModule,
    FilesModule,
    AuthModule,
    UsersModule,
    LanguagesModule,
    SearchModule,
    TeachersModule,
    MatchingModule,
    BookingsModule,
    AssessmentModule,
    CommerceModule,
    SupportModule,
    NotificationsModule,
    ContentModule,
    BlogModule,
    CoursesModule,
    LearningModule,
    AdminDashboardModule,
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
