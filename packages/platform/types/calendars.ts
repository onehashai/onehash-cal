import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, Validate } from "class-validator";

import { IsYearMonthDays } from "./validators/isYearMonthDays";

export class Calendar {
  @ApiProperty({
    description: "The credential ID for the calendar",
    type: Number,
  })
  @IsNumber()
  credentialId!: number;

  @ApiProperty({
    description: "The external ID for the calendar",
    type: String,
  })
  @IsString()
  externalId!: string;
}

export class CalendarBusyTimesInput {
  @ApiProperty({
    description: "The time zone of the logged-in user",
    type: String,
  })
  @IsString()
  loggedInUsersTz!: string;

  @ApiProperty({
    description: "The start date in YYYY-MM-DD format",
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  @Validate(IsYearMonthDays)
  dateFrom?: string | null;

  @ApiProperty({
    description: "The end date in YYYY-MM-DD format",
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  @Validate(IsYearMonthDays)
  dateTo?: string | null;

  @ApiProperty({
    description: "Array of calendar objects to load",
    type: [Calendar],
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Calendar)
  calendarsToLoad!: Calendar[];
}
