import { IsArray, IsString } from 'class-validator';

export class ReorderDto {
  @IsArray() @IsString({ each: true }) questionIds!: string[];
}
