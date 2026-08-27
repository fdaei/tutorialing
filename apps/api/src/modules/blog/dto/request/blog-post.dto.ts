import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * Request bodies for the blog write surface.
 *
 * `status`, `authorId`, `publishedAt` and every relation id other than the two
 * named below are deliberately absent from these classes. The global
 * `ValidationPipe` runs with `forbidNonWhitelisted`, so a body carrying one is
 * rejected outright rather than silently stripped — and `BlogService` maps
 * field by field, so even a change here cannot reach Prisma unless the mapping
 * is changed too. Authorship comes from the access token and status only moves
 * through `BlogService.transition`.
 */

/** Lowercase, digits and single hyphens: what can safely appear in a public URL. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_BODY = 100_000;

export class CreateBlogPostDto {
  @IsString() @Length(1, 160) @Matches(SLUG) slug!: string;
  @IsString() @Length(1, 200) titleFa!: string;
  @IsString() @Length(1, 200) titleEn!: string;
  @IsString() @Length(1, 500) excerptFa!: string;
  @IsString() @Length(1, 500) excerptEn!: string;
  @IsString() @Length(1, MAX_BODY) contentFa!: string;
  @IsString() @Length(1, MAX_BODY) contentEn!: string;
  @IsOptional() @IsString() @Length(1, 2_000) coverImage?: string;
  @IsOptional() @IsString() @Length(1, 64) categoryId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Length(1, 64, { each: true })
  tagIds?: string[];
  @IsOptional() @IsString() @Length(1, 200) seoTitleFa?: string;
  @IsOptional() @IsString() @Length(1, 200) seoTitleEn?: string;
  @IsOptional() @IsString() @Length(1, 400) seoDescriptionFa?: string;
  @IsOptional() @IsString() @Length(1, 400) seoDescriptionEn?: string;
}

/** Every field optional; the same allowlist, minus nothing and plus nothing. */
export class UpdateBlogPostDto {
  @IsOptional() @IsString() @Length(1, 160) @Matches(SLUG) slug?: string;
  @IsOptional() @IsString() @Length(1, 200) titleFa?: string;
  @IsOptional() @IsString() @Length(1, 200) titleEn?: string;
  @IsOptional() @IsString() @Length(1, 500) excerptFa?: string;
  @IsOptional() @IsString() @Length(1, 500) excerptEn?: string;
  @IsOptional() @IsString() @Length(1, MAX_BODY) contentFa?: string;
  @IsOptional() @IsString() @Length(1, MAX_BODY) contentEn?: string;
  @IsOptional() @IsString() @Length(1, 2_000) coverImage?: string;
  @IsOptional() @IsString() @Length(1, 64) categoryId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @Length(1, 64, { each: true })
  tagIds?: string[];
  @IsOptional() @IsString() @Length(1, 200) seoTitleFa?: string;
  @IsOptional() @IsString() @Length(1, 200) seoTitleEn?: string;
  @IsOptional() @IsString() @Length(1, 400) seoDescriptionFa?: string;
  @IsOptional() @IsString() @Length(1, 400) seoDescriptionEn?: string;
}

export class ListBlogPostsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
  @IsOptional() @IsString() @Length(1, 160) @Matches(SLUG) category?: string;
  @IsOptional() @IsString() @Length(1, 120) search?: string;
}
