import { ConsoleLogger, Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLoggerService extends ConsoleLogger {
    log(message: any, context?: string) {
        // Custom logic if needed, reference just extends ConsoleLogger mostly
        super.log(message, context);
    }

    error(message: any, trace?: string, context?: string) {
        super.error(message, trace, context);
    }

    warn(message: any, context?: string) {
        super.warn(message, context);
    }

    debug(message: any, context?: string) {
        super.debug(message, context);
    }

    verbose(message: any, context?: string) {
        super.verbose(message, context);
    }
}
