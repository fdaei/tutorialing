import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
@Module({imports:[BookingsModule],controllers:[MatchingController],providers:[MatchingService]})
export class MatchingModule {}
