import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsNotEmptyObject, IsOptional, IsString, ValidateNested } from "class-validator";

import { SUCCESS_STATUS, ERROR_STATUS } from "@calcom/platform-constants";

const MembershipRole = {
  MEMBER: "MEMBER",
  ADMIN: "ADMIN",
  OWNER: "OWNER",
} as const;

type MembershipRoleType = (typeof MembershipRole)[keyof typeof MembershipRole];

export class TeamOutput {
  @IsInt()
  teamId!: number;

  @IsString()
  teamName!: string;

  @IsOptional()
  @IsString()
  teamSlug?: string;

  @IsString()
  @ApiProperty({ enum: Object.values(MembershipRole) })
  role!: MembershipRoleType;
}

export class GetTeamOutput {
  @ApiProperty({ example: SUCCESS_STATUS, enum: [SUCCESS_STATUS, ERROR_STATUS] })
  @IsEnum([SUCCESS_STATUS, ERROR_STATUS])
  status!: typeof SUCCESS_STATUS | typeof ERROR_STATUS;

  @ValidateNested({ each: true })
  @Type(() => TeamOutput)
  data!: TeamOutput[];
}
