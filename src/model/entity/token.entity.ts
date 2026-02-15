import { User } from './user.entity';
import { Auditable } from '../../utility/autitable.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('tokens')
export class Token extends Auditable {
    @Column({ type: 'character varying' })
    @Index('idx_refreshToken') // Changed from tokenHash to refreshToken
    refreshToken: string;

    @Column({ type: 'timestamp with time zone' })
    expireAt: Date; // Changed from expiresAt to expireAt

    @Column({ type: 'timestamp with time zone', nullable: true })
    revokedAt: Date | null;

    @Column({ type: 'character varying', nullable: true })
    ip: string;

    @Column({ type: 'character varying', nullable: true })
    userAgent: string;

    //@Column({ type: 'uuid' }) // Explicit foreign key column not strictly needed if ManyToOne handles it, keeping it for clarity if needed
    // But Typescript might complain if duplicate.
    // Let's rely on relation.

    @ManyToOne(() => User, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'userId' })
    user: User;

    // Computed valid property
    get valid(): boolean {
        return !this.revokedAt;
    }

    // For TypeORM to actually load it? No, it's just logic. 
    // But properties on Entity that are not columns are treated as ignored.
    // If I use `token.valid` in code, it works on the object instance.
    // But `token.valid = false` in service implies setter that updates `revokedAt`?
    set valid(isValid: boolean) {
        if (!isValid) {
            this.revokedAt = new Date();
        } else {
            this.revokedAt = null;
        }
    }
}
