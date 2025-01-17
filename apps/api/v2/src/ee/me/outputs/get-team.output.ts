import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNotEmptyObject, IsOptional, IsString, ValidateNested } from "class-validator";

import { SUCCESS_STATUS, ERROR_STATUS } from "@calcom/platform-constants";
import { MembershipRole } from "@calcom/platform-libraries";

export class TeamOutput {
  @IsInt()
  teamId!: number;

  @IsString()
  teamName!: string;

  @IsOptional()
  @IsString()
  teamSlug?: string;

  @IsString()
  @ApiProperty({ enum: ["MEMBER", "OWNER", "ADMIN"] })
  role!: MembershipRole;
}

export class GetTeamOutput {
  @ApiProperty({ example: SUCCESS_STATUS, enum: [SUCCESS_STATUS, ERROR_STATUS] })
  @IsEnum([SUCCESS_STATUS, ERROR_STATUS])
  status!: typeof SUCCESS_STATUS | typeof ERROR_STATUS;

  @ValidateNested({ each: true })
  @Type(() => TeamOutput)
  data!: TeamOutput[];
}
