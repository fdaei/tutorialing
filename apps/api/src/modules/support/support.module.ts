import{Module}from'@nestjs/common';import{SupportController}from'./support.controller';
import{NotificationsController}from'./notifications.controller';import{SupportService}from'./support.service';@Module({controllers:[SupportController,NotificationsController],providers:[SupportService]})export class SupportModule{}
