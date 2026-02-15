import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { User } from '../../model/entity/user.entity';
import { UserDto } from '../../model/dto/user.dto';
import { MyLoggerService } from '../logger/my-logger.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import {
    PaginationAndSorting,
    PaginationAndSortingResult,
    PaginationQueryDto,
} from '../../utility/pagination-and-sorting';
import { UpdateUserRequestDto } from '../../model/request/update-user-request.dto';
import { UpdatePasswordRequestDto } from '../../model/request/update-password-request.dto';
import { HashUtility } from '../../utility/hash-utility';

@Injectable()
export class UserService {
    private readonly logger: MyLoggerService = new MyLoggerService(
        UserService.name,
    );

    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        // private readonly fileService: FileService, // Removed dependency
    ) { }

    async findAll(
        userQuery: PaginationQueryDto,
    ): Promise<PaginationAndSortingResult<UserDto>> {
        const findOptions = PaginationAndSorting.createFindOptions<User>(
            ['firstName', 'lastName', 'email'],
            userQuery,
            {},
            {},
            [], // No relations for now
        );
        const [users, count] = await this.userRepository.findAndCount(findOptions);

        return PaginationAndSorting.getPaginateResult<User, UserDto>(
            users,
            count,
            userQuery,
            (user: User) => this.convertToDto(user),
        );
    }

    async findSingleUser(userId: string): Promise<UserDto> {
        const user: User = await this.findById(userId, []);

        this.logger.log(`Retrieved user with id: ${user.id}`, UserService.name);
        return this.convertToDto(user);
    }

    async updateUser(
        userId: string,
        updateRequest: UpdateUserRequestDto,
    ): Promise<UserDto> {
        const {
            firstName,
            lastName,
            // email, // Typically email update requires verification, keeping it simple
        }: UpdateUserRequestDto = updateRequest;

        let user: User = await this.findById(userId, []);

        if (firstName) {
            user.firstName = firstName;
        }

        if (lastName) {
            user.lastName = lastName;
        }

        // Address and profile image logic removed

        user = await this.userRepository.save(user);

        this.logger.log(
            `User with id: ${user.id} was updated successfully.`,
            UserService.name,
        );
        return this.convertToDto(user);
    }

    async updatePassword(
        userId: string,
        passwordRequest: UpdatePasswordRequestDto,
    ): Promise<string> {
        const {
            oldPassword,
            newPassword,
            confirmPassword,
        }: UpdatePasswordRequestDto = passwordRequest;

        const user: User = await this.findById(userId);

        if (newPassword !== confirmPassword) {
            throw new BadRequestException('Password field are not the same');
        }

        if (user.passwordHash && !(await HashUtility.compareHash(oldPassword, user.passwordHash))) {
            throw new BadRequestException('Incorrect old password');
        }

        user.passwordHash = await HashUtility.generateHashValue(newPassword);
        await this.userRepository.save(user);

        this.logger.log(`User changed password`, UserService.name);
        return 'Password changed successfully';
    }

    async findById(id: string, relations: string[] = []): Promise<User> {
        const user: User | null = await this.userRepository.findOne({
            where: { id },
            relations,
        });

        if (!user) {
            throw new NotFoundException(`User with id ${id} not found`);
        }

        return user;
    }

    async findByEmail(email: string, relations: string[] = []): Promise<User> {
        const user: User | null = await this.userRepository.findOne({
            where: { email },
            relations,
        });

        if (!user) {
            throw new NotFoundException(`User with email ${email} not found`);
        }

        return user;
    }

    convertToDto(user: User): UserDto {
        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            roles: user.roles,
            status: user.status,
            lastLogin: user.lastLogin,
            emailVerifiedAt: user.emailVerifiedAt,
            // Defaulting others to null/false as needed or removing them from DTO if not present
            // But DTO has them as properties.
            // I should update UserDto to match exactly what I have, or map defaults.
            // User entity has: firstName, lastName, email, roles, status, emailVerifiedAt, lastLogin
        };
    }
}
