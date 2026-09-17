import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PayDto {
  @IsIn(['booking', 'package']) purpose!: 'booking' | 'package';
  @IsString() referenceId!: string;
  @IsInt() @Min(0) walletAmount!: number;
  @IsOptional() @IsString() discountCode?: string;
  @IsString() idempotencyKey!: string;
}

export class RefundDto {
  @IsInt() @Min(1) amount!: number;
  @IsString() reason!: string;
  @IsString() idempotencyKey!: string;
}

export class WalletTopUpDto {
  @IsInt() @Min(100_000) amount!: number;
  @IsOptional() @IsString() discountCode?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

export class WalletAdjustmentDto {
  @IsInt() @Min(1) amount!: number;
  @IsIn(['CREDIT', 'DEBIT']) direction!: 'CREDIT' | 'DEBIT';
  @IsString() reason!: string;
  @IsString() idempotencyKey!: string;
}

export class ReceiptTopUpDto {
  // Ignored for course receipts: the server charges the course price.
  @IsInt() @Min(0) amount!: number;
  @IsString() receiptFileId!: string;
  @IsString() idempotencyKey!: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseSessionSelectionDto)
  sessions?: CourseSessionSelectionDto[];
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class CourseSessionSelectionDto {
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsString() timezone!: string;
}

export class ReceiptApproveDto {
  @IsOptional() @IsString() @MaxLength(100) reference?: string;
}

export class ReceiptRejectDto {
  @IsString() @MaxLength(500) reason!: string;
}
