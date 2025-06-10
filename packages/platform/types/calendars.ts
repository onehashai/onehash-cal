import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Transform } from "class-transformer";
import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, Validate } from "class-validator";

import { IsYearMonthDays } from "./validators/isYearMonthDays";

export class Calendar {
  @ApiProperty({
    description: "The credential ID for the calendar",
    type: Number,
  })
  @Transform(({ value }: { value: string }) => value && parseInt(value))
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
    type: String,
    required: true,
    description: "The timezone of the logged in user represented as a string",
    example: "America/New_York",
  })
  @IsString()
  loggedInUsersTz!: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The starting date for the busy times query",
    example: "2023-10-01",
  })
  @IsString()
  @IsOptional()
  @Validate(IsYearMonthDays)
  dateFrom?: string | null;

  @ApiProperty({
    description: "The end date in YYYY-MM-DD format",
    type: String,
    required: false,
    example: "2023-10-31",
  })
  @IsString()
  @IsOptional()
  @Validate(IsYearMonthDays)
  dateTo?: string | null;

  @ApiProperty({
    type: [Calendar],
    isArray: true,
    required: true,
    description: "An array of Calendar objects representing the calendars to be loaded",
    example: `[{ credentialId: "1", externalId: "AQgtJE7RnHEeyisVq2ENs2gAAAgEGAAAACgtJE7RnHEeyisVq2ENs2gAAAhSDAAAA" }, { credentialId: "2", externalId: "AQM7RnHEeyisVq2ENs2gAAAhFDBBBBB" }]`,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Calendar)
  calendarsToLoad!: Calendar[];
}
