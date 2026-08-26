import { IsBoolean, IsDefined } from 'class-validator';

export class SettingDto {
  /** Arbitrary JSON payload for the setting; shape is per-key and not constrained here. */
  @IsDefined()
  value!: unknown;

  /** Whether the setting is served by the public `GET /support/settings` endpoint. */
  @IsBoolean()
  public!: boolean;
}
