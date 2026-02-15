import { UserRole } from '../enum/role.enum';
import { DateDto } from '../../utility/date.dto';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../entity/user.entity';

export class UserDto extends DateDto {
    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string | null;

    @ApiProperty()
    roles: UserRole[];

    @ApiProperty()
    email: string;

    @ApiProperty()
    status: UserStatus;

    @ApiProperty()
    lastLogin: Date | null;

    @ApiProperty()
    emailVerifiedAt: Date | null;
}
