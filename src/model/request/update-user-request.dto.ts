import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateUserRequestDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    firstName: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    lastName: string;

    // Removed address/profileImage related fields for now
}
