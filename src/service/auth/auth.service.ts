import { BadRequestException, Injectable } from '@nestjs/common';
import { MyLoggerService } from '../logger/my-logger.service';
import { User, UserStatus } from '../../model/entity/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserService } from '../user/user.service';
import { RegisterRequestDto } from '../../model/request/register-request.dto';
import { HashUtility } from '../../utility/hash-utility';
import { UserRole } from '../../model/enum/role.enum';
import { VerificationType } from '../../model/enum/verification-type';
import { VerificationService } from '../verification/verification.service';
import { AuthResponseDto } from '../../model/response/auth-response.dto';
import { VerifyRegistrationDto } from '../../model/request/verify-registration.dto';
import { DateUtility } from '../../utility/date-utility';
import { EmailService } from '../email/email.service';
import { EmailType } from '../../model/enum/email-type.enum';
import { Request } from 'express';
import { TokenService } from '../token/token.service';
import { CustomJwtService } from '../token/jwt.service';
import { AuthRequestDto } from '../../model/request/auth-request.dto';
import { LogoutRequestDto } from '../../model/request/logout-request.dto';
// import { UserInfo } from '../../common/guards/auth.guard'; // Need to implement/import this
import { RefreshTokenRequestDto } from '../../model/request/refresh-token-request.dto';
import { VerifyForgotPasswordRequestDto } from '../../model/request/verify-forgot-password-request.dto';
import { ForgotPasswordRequestDto } from '../../model/request/forgot-password-request.dto';
import { ResetPasswordRequestDto } from '../../model/request/reset-password-request.dto';

interface UserInfo {
    userId: string;
    roles: UserRole[];
}

@Injectable()
export class AuthService {
    private readonly logger: MyLoggerService = new MyLoggerService(
        AuthService.name,
    );

    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        private readonly userService: UserService,
        private readonly verificationService: VerificationService,
        private readonly emailService: EmailService,
        private readonly tokenService: TokenService,
        private readonly jwtService: CustomJwtService,
    ) { }

    async registerUser(registerRequestDto: RegisterRequestDto): Promise<string> {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            // username, isAgreed ignored
        }: RegisterRequestDto = registerRequestDto;

        const existingUser: User | null = await this.userRepository.findOne({
            where: {
                email,
            },
        });

        if (existingUser) {
            // If user exists and verified, error.
            // If user exists and NOT verified, strictly following reference:
            // "If user && !user.isEnabled ... remove(user) ... create new"
            // Reference logic:
            if (existingUser.isEnabled) {
                throw new BadRequestException('Account with email already exists');
            } else {
                // Delete unverified user to allow re-registration
                await this.userRepository.remove(existingUser);
            }
        }

        if (password !== confirmPassword) {
            throw new BadRequestException('Passwords fields do not match');
        }

        const user = this.userRepository.create({
            firstName,
            lastName,
            email,
            passwordHash: await HashUtility.generateHashValue(password),
            roles: [UserRole.USER],
            status: UserStatus.ACTIVE, // defaulting to active but not verified? Or UNVERIFIED status?
            // Requirement says "Creates user (UNVERIFIED)".
            // User entity has status: ACTIVE | SUSPENDED.
            // And isEnabled (boolean) for verification?
            // My entity has `isEnabled`? Let's check User entity implementation.
            // I added `isEnabled` boolean to User entity in `model/entity/user.entity.ts`.
            // Wait, I should verify if I added `isEnabled`.
            isEnabled: false,
        });

        const newUser: User = await this.userRepository.save(user);

        await this.verificationService.create({
            verificationType: VerificationType.ACCOUNT_VERIFICATION,
            user: newUser,
            tokenType: 'otp', // or 'token' per requirement "Creates email verification token (hashed)". Reference uses 'otp' or 'token'.
        });

        this.logger.log(`User Created: ${newUser.email}`, AuthService.name);
        return 'Confirm your account in the email sent';
    }

    async verifyRegistration(
        verifyRegistration: VerifyRegistrationDto,
        request: Request,
    ): Promise<AuthResponseDto> {
        const { token, email }: VerifyRegistrationDto = verifyRegistration;

        const user: User | null = await this.userRepository.findOne({
            where: {
                email,
            },
        });

        if (!user) {
            throw new BadRequestException('Invalid credentials');
        }

        await this.verificationService.verify(
            {
                user,
                verificationType: VerificationType.ACCOUNT_VERIFICATION,
                tokenType: 'otp',
            },
            token,
        );

        user.isEnabled = true;
        user.emailVerifiedAt = DateUtility.currentDate;
        user.lastLogin = DateUtility.currentDate;

        await this.userRepository.save(user);

        await this.emailService.sendRegistrationNotificationMail({
            type: EmailType.ACCOUNTREGISTRATION,
            to: user.email,
            context: {
                name: user.firstName,
            },
        });

        const tokens = await this.generateToken(user, request, true);

        this.logger.log(`Verified user: ${user.email}`, AuthService.name);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken!,
            user: this.userService.convertToDto(user),
        };
    }

    async login(
        loginRequestDto: AuthRequestDto,
        request: Request,
    ): Promise<AuthResponseDto> {
        const { email, password }: AuthRequestDto = loginRequestDto;

        const user: User | null = await this.userRepository.findOne({
            where: {
                email,
            },
        });

        if (!user) {
            throw new BadRequestException('Invalid credentials');
        }

        // Requirement: "Login Allowed even if unverified, but issue tokens with a claim email_verified=false"
        // Reference: "if (!user.isEnabled) throw ..."
        // USE NEW REQUIREMENT: Allow login.
        // So I skip the check `if (!user.isEnabled)`.

        // But verify password
        if (user.passwordHash && !(await HashUtility.compareHash(password, user.passwordHash))) {
            throw new BadRequestException('Invalid credentials');
        }

        user.lastLogin = DateUtility.currentDate;
        await this.userRepository.save(user);

        const tokens = await this.generateToken(user, request, true);

        this.logger.log(`User: ${user.email} logged in`, AuthService.name);
        return {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken!,
            user: this.userService.convertToDto(user),
        };
    }

    async logout(
        logoutRequestDto: LogoutRequestDto,
        request: any, // Request & { user: UserInfo }
    ): Promise<string> {
        const { refreshToken }: LogoutRequestDto = logoutRequestDto;
        const userInfo: UserInfo = request.user;

        if (!userInfo) {
            // Should be guarded, but safe check
            throw new BadRequestException('User not authenticated');
        }

        await this.tokenService.revokeToken(refreshToken);

        this.logger.log(`User logged out: ${userInfo.userId}`);

        return 'User logged out successfully';
    }

    async refreshToken(
        refershTokenRequest: RefreshTokenRequestDto,
        request: Request,
    ): Promise<AuthResponseDto> {
        const { refreshToken, userId }: RefreshTokenRequestDto =
            refershTokenRequest;

        await this.tokenService.verifyToken(refreshToken, userId);

        const user: User | null = await this.userRepository.findOne({
            where: {
                id: userId,
            },
        });

        if (!user) {
            throw new BadRequestException('Invalid Credentials');
        }

        const tokens = await this.generateToken(user, request, false);

        this.logger.log(`User refreshed token`, AuthService.name);
        return {
            accessToken: tokens.accessToken,
            refreshToken: refreshToken,
            user: this.userService.convertToDto(user),
        };
    }

    async forgotPassword(
        forgotPasswordRequest: ForgotPasswordRequestDto,
    ): Promise<string> {
        const { email }: ForgotPasswordRequestDto = forgotPasswordRequest;

        const user: User | null = await this.userRepository.findOne({
            where: { email },
        });

        if (!user) {
            return 'Reset password link sent to your email';
        }

        await this.verificationService.create({
            verificationType: VerificationType.PASSWORD_RESET,
            tokenType: 'otp',
            user,
        });

        this.logger.log(
            `Password reset request processed for user: ${user.email}`,
            AuthService.name,
        );
        return 'Reset password otp sent to your email';
    }

    async verifyForgotPassword(
        verifyForgotPasswordRequest: VerifyForgotPasswordRequestDto,
    ): Promise<string> {
        const { email, token }: VerifyForgotPasswordRequestDto =
            verifyForgotPasswordRequest;

        const user: User | null = await this.userRepository.findOne({
            where: { email },
        });

        if (!user) {
            throw new BadRequestException('Invalid Verification');
        }

        await this.verificationService.verify(
            {
                verificationType: VerificationType.PASSWORD_RESET,
                tokenType: 'otp',
                user,
            },
            token,
        );

        this.logger.log(
            `Password reset request verified: ${user.email}`,
            AuthService.name,
        );
        return 'Password reset otp verified, Proceed to reset password';
    }

    async resetPassword(
        resetPasswordRequest: ResetPasswordRequestDto,
    ): Promise<string> {
        const { email, password, confirmPassword } = resetPasswordRequest;

        const user: User | null = await this.userRepository.findOne({
            where: { email },
        });

        if (!user) {
            throw new BadRequestException('Invalid email');
        }

        await this.verificationService.delete({
            user,
            verificationType: VerificationType.PASSWORD_RESET,
            tokenType: 'otp',
        });

        if (password !== confirmPassword) {
            throw new BadRequestException('Password fields are not the same');
        }

        user.passwordHash = await HashUtility.generateHashValue(password);
        await this.userRepository.save(user);

        this.logger.log(`User reset password`, AuthService.name);
        return 'Password change successfully';
    }

    private async generateToken(
        user: User,
        request: Request,
        isRefreshTokenRefresh: boolean = false,
    ): Promise<{ accessToken: string; refreshToken: string | null }> {
        return {
            accessToken: this.jwtService.generateJwtToken(user),
            refreshToken: isRefreshTokenRefresh
                ? (await this.tokenService.createToken(user, request)).refreshToken
                : null,
        };
    }
}
