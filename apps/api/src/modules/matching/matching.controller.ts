import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { MatchingService } from './matching.service';
class MatchDto {
  @IsString() languageId!:string;
  @IsOptional() @IsString() currentLevel?:string;
  @IsString() learningGoal!:string;
  @IsOptional() @IsString() targetLevel?:string;
  @IsOptional() @IsNumber() @Min(0) @Max(9) targetBand?:number;
  @IsOptional() @IsNumber() @Min(0) @Max(9) currentBand?:number;
  @IsOptional() @IsDateString() examDate?:string;
  @IsArray() @IsString({each:true}) weakSkills!:string[];
  @IsNumber() @Min(1) budget!:number;
  @IsArray() @IsInt({each:true}) suitableDays!:number[];
  @IsOptional() @IsString() preferredTime?:string;
  @IsOptional() @IsString() preferredTeacherGender?:string;
  @IsBoolean() trialRequired!:boolean;
  @IsString() classType!:string;
  @IsOptional() @IsObject() availability?:object;
  @IsString() timezone!:string;
}
@Controller('matching')
export class MatchingController { constructor(private s:MatchingService){} @Post()create(@CurrentUser()u:AuthUser,@Body()d:MatchDto){return this.s.create(u.id,d)} @Get('history')history(@CurrentUser()u:AuthUser){return this.s.history(u.id)} }
