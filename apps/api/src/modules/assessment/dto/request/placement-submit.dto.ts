import { Type } from 'class-transformer';
import { Allow, ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class PlacementAnswerDto {
  @IsString() @IsNotEmpty() questionId!: string;
  @Allow()
  value!: unknown;
}

export class PlacementSubmitDto {
  @IsString() @IsNotEmpty() testId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PlacementAnswerDto)
  answers!: PlacementAnswerDto[];
}
