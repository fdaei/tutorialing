import { IsInt, Min } from 'class-validator';

export class ProposalDto {
  @IsInt() @Min(10000) proposedTrialPrice!: number;
  @IsInt() @Min(10000) proposedRegularPrice!: number;
}
