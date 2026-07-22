import { IsIn, IsString } from 'class-validator';

export class DocumentDto {
  @IsIn(['identity', 'certificate', 'experience', 'demo-lesson']) kind!: string;
  @IsString() fileId!: string;
}
