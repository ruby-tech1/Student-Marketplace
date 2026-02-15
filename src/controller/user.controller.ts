import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../service/user/user.service';
import { ApiResponse } from '../utility/api-response';
import { UserDto } from '../model/dto/user.dto';
import { SwaggerApiResponseData } from '../common/decorator/swagger.decorator';
import type { Request } from 'express';

@ApiTags('User API')
@Controller('users')
@ApiBearerAuth('access-token')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @ApiOperation({ summary: 'Api endpoint for getting authenticated user profile' })
    @SwaggerApiResponseData({
        dataClass: UserDto,
        status: HttpStatus.OK,
        description: 'User profile retrieved successfully',
    })
    @Get('profile')
    @HttpCode(HttpStatus.OK)
    async getProfile(@Req() request: Request): Promise<ApiResponse<UserDto>> {
        const user = request.user as any; // Cast to any or define interface extending Request if possible, but AuthGuard attaches user.
        // Ideally we use a custom decorator @CurrentUser() but @Req() works.
        // AuthGuard ensures request.user is populated.

        // UserInfo interface from AuthGuard: { userId: string; roles: UserRole[] }
        // We can assume user.userId exists.

        const userProfile = await this.userService.findSingleUser(user.userId);
        return ApiResponse.success(userProfile, HttpStatus.OK);
    }
}
