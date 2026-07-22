import{Module}from'@nestjs/common';import{AdminController}from'./admin.controller';import{AdminService}from'./admin.service';
import{AdminRepository}from'./admin.repository';import{TeachersModule}from'../teachers/teachers.module';@Module({imports:[TeachersModule],controllers:[AdminController],providers:[AdminService,AdminRepository]})export class AdminModule{}
