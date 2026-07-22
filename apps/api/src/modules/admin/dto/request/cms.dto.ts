import { IsObject } from 'class-validator';

export class CmsDto {
  @IsObject()
  content!: Record<string, unknown>;
}
