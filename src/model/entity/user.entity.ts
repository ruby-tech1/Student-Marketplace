import { Entity, Column } from 'typeorm';
import { Auditable } from '../../utility/autitable.entity';
import { UserRole } from '../enum/role.enum';

export enum UserStatus {
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
}

@Entity('users')
export class User extends Auditable {

    @Column({ type: 'character varying', nullable: true })
    firstName: string;

    @Column({ type: 'character varying', nullable: true })
    lastName: string;

    @Column({ type: 'character varying', unique: true })
    email: string;

    @Column({ type: 'character varying', nullable: true })
    passwordHash: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        array: true,
        default: [UserRole.USER],
    })
    roles: UserRole[];

    @Column({
        type: 'enum',
        enum: UserStatus,
        default: UserStatus.ACTIVE,
    })
    status: UserStatus;

    @Column({ type: 'timestamp with time zone', nullable: true })
    emailVerifiedAt: Date | null;

    @Column({ type: 'timestamp with time zone', nullable: true })
    lastLogin: Date | null;

    // Computed property for isEnabled used in AuthService
    // Or just a column if we want strict control
    @Column({ type: 'boolean', default: false })
    isEnabled: boolean;

    // Reference mentions company/address relations, skipping for now as not required by current build errors
}
