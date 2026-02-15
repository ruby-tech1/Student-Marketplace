import { Injectable } from '@nestjs/common';
import { UserRole } from '../../model/enum/role.enum';

interface IsAuthorizedParams {
    currentRole: UserRole;
    requiredRole: UserRole;
}

@Injectable()
export class RbacService {
    private hierarchies: Map<string, number>[] = [];
    private priority: number = 1;

    constructor() {
        this.buildRoles([UserRole.USER, UserRole.ADMIN]);
        // this.buildRoles([UserRole.VENDOR, UserRole.ADMIN]); // Vendor hierarchy?
        // Reference had User, Admin, SuperAdmin.
        // I have USER, VENDOR, ADMIN.
        // Maybe Admin > Vendor? Admin > User?
        // Let's assume Admin > Vendor and Admin > User.
        // Separate hierarchies?
        // Or just priority?
        // Reference: buildRoles([USER, ADMIN, SUPER_ADMIN]) -> USER=1, ADMIN=2, SUPER_ADMIN=3.
        // So if required is USER, Admin (2) >= User (1) -> True.
        // If required is ADMIN, User (1) >= Admin (2) -> False.

        // My roles: USER, VENDOR, ADMIN.
        // Does Admin inherit Vendor? Maybe?
        // Does Vendor inherit User? Probably not in some cases (vendor specific routes).
        // Requirement says "A single account may act as both buyer and vendor." -> implies roles array.
        // So if I have roles=[USER, VENDOR], and required=VENDOR, I pass.
        // If required=USER, I pass.
        // If required=ADMIN, I fail.

        // So simple equality check might be enough if I have roles array.
        // But if I want "Admin can do everything User can", then hierarchy helps.
        // Let's implement hierarchy for Admin > User and Admin > Vendor.

        // Hierarchy 1: USER -> ADMIN
        this.hierarchies.push(this.createHierarchy([UserRole.USER, UserRole.ADMIN]));
        // Hierarchy 2: VENDOR -> ADMIN
        this.hierarchies.push(this.createHierarchy([UserRole.VENDOR, UserRole.ADMIN]));
    }

    private createHierarchy(roles: UserRole[]): Map<string, number> {
        const hierarchy = new Map<string, number>();
        let p = 1;
        roles.forEach(role => {
            hierarchy.set(role, p++);
        });
        return hierarchy;
    }

    private buildRoles(roles: UserRole[]): void {
        // Reference implementation style
        const hierarchy: Map<string, number> = new Map();
        // Reset priority or use local? Reference used `this.priority` which increments globally?
        // "this.priority: number = 1;" initialized.
        // "hierarchy.set(role, this.priority); this.priority++;"
        // So globally unique priorities?
        // If multiple calls to buildRoles, priority keeps increasing.
        // buildRoles([A, B]) -> A=1, B=2.
        // buildRoles([C, D]) -> C=3, D=4.
        // This implies C > B ??? No, they are in different hierarchies map.
        // isAuthorized iterates over `this.hierarchies`.
        // It finds hierarchy that contains BOTH roles?
        // "const priority = hierarchy.get(currentRole); const requiredPriority = hierarchy.get(requiredRole);"
        // If both exist in map, compare.

        // So I should use independent priorities for each hierarchy call?
        // Reference implementation seems to share `this.priority`??
        // Let's look closer at reference:
        // "private priority: number = 1;"
        // buildRoles called twice in constructor.
        // So yes, priorities increment.
        // But `isAuthorized` checks `hierarchy` (Map) from `this.hierarchies` list.
        // Inside one map, priorities are relative.
        // Value of 1 vs 3 matters only if in same map.
        // So global increment doesn't hurt, just values get larger.

        let p = 1; // Use local priority start for each hierarchy
        roles.forEach((role) => {
            hierarchy.set(role, p++);
        });

        this.hierarchies.push(hierarchy);
    }

    public isAuthorized({
        currentRole,
        requiredRole,
    }: IsAuthorizedParams): boolean {
        if (currentRole === requiredRole) return true;

        for (const hierarchy of this.hierarchies) {
            const priority = hierarchy.get(currentRole);
            const requiredPriority = hierarchy.get(requiredRole);

            if (priority && requiredPriority && priority >= requiredPriority) {
                return true;
            }
        }
        return false;
    }
}
