import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
@Module({ imports: [AuthModule, FilesModule], controllers: [UsersController, AdminUsersController], providers: [UsersService, AdminUsersService], exports: [UsersService] })
export class UsersModule {}
