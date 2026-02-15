import { Auditable } from '../../utility/autitable.entity';
import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { VerificationType } from '../enum/verification-type';
import { User } from './user.entity';

@Entity('verifications')
export class Verification extends Auditable {
    @Column({ type: 'character varying', unique: true }) // Hashed token
    token: string;

    @Column({ type: 'enum', enum: VerificationType })
    verificationType: VerificationType; // Changed from type

    @Column({ type: 'timestamp with time zone' })
    expireAt: Date; // Changed from expiresAt

    @Column({ type: 'boolean', default: false })
    verified: boolean; // Changed from used

    @Column({ type: 'character varying', nullable: true })
    destination: string; // Changed from email

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;
}
