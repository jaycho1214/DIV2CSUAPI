import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreatePointDto {
  @IsOptional()
  giverId?: string;

  @IsOptional()
  receiverId?: string;

  @IsNumber()
  value: number;

  @IsNotEmpty()
  reason: string;

  @IsDateString()
  givenAt: string;
}

export class VerifyPointDto {
  @IsUUID()
  id?: string;

  @IsBoolean()
  value?: boolean;

  @IsOptional()
  rejectReason?: string;
}
