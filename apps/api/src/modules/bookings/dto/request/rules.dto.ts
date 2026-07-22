import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { RuleItemDto } from './rule-item.dto';

export class RulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleItemDto)
  rules!: RuleItemDto[];
}
