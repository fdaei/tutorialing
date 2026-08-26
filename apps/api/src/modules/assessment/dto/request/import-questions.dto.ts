import { ArrayNotEmpty, IsArray, IsObject } from 'class-validator';

export class ImportQuestionsDto {
  /**
   * Raw question rows. Each row's fields are validated field-by-field by
   * `TestsService.questionData()`, which builds an explicit allow-list, so the
   * DTO only constrains the envelope.
   */
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  rows!: Record<string, unknown>[];
}
