import { Expose, Type } from 'class-transformer';

export class BlogCommentAuthorDto {
  @Expose() id!: string;
  @Expose() name!: string | null;
  @Expose() avatarKey!: string | null;
}

export class BlogCommentResponseDto {
  @Expose() id!: string;
  @Expose() body!: string;
  @Expose() status!: string;
  @Expose() parentId!: string | null;
  @Expose() createdAt!: Date;
  @Expose() @Type(() => BlogCommentAuthorDto) user!: BlogCommentAuthorDto | null;
  @Expose() @Type(() => BlogCommentResponseDto) replies!: BlogCommentResponseDto[];
}
