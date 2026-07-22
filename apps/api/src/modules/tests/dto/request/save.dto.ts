import { IsArray } from 'class-validator';

export class SaveDto {
  @IsArray() answers!: { questionId: string; value?: unknown; textValue?: string; fileId?: string; flagged?: boolean }[];
}
