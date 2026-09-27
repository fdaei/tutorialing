import { BlogReactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Reader-facing writes: reaction, rating, and the anonymous view counter. */

export class BlogReactionDto {
  @IsEnum(BlogReactionType) type!: BlogReactionType;
}

export class BlogRatingDto {
  @IsInt() @Min(1) @Max(5) value!: number;
}

export class BlogViewDto {
  /**
   * A client-generated identifier, unauthenticated by definition — it is only
   * a de-duplication key, never an identity. It is bounded and restricted to
   * URL-safe characters because it lands in a unique index on a table anyone
   * can write to: unbounded input there is an index-bloat lever, and the shape
   * check keeps the column to what the browser actually sends (a `randomUUID`).
   */
  @IsString() @Length(8, 128) @Matches(/^[A-Za-z0-9_-]+$/) visitorKey!: string;
}

export class BlogCommentDto {
  @IsString() @MinLength(1) @MaxLength(1500) body!: string;
  @IsOptional() @IsString() parentId?: string;
}

export class ModerateBlogCommentDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
}

export class AdminListBlogCommentsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsIn(['PENDING', 'APPROVED', 'REJECTED']) status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}
