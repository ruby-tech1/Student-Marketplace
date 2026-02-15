import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { MyLoggerService } from './service/logger/my-logger.service';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
    private logger = new MyLoggerService(AllExceptionFilter.name);

    constructor(private readonly httpAdapterHost: HttpAdapterHost) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        const { httpAdapter } = this.httpAdapterHost;

        const ctx = host.switchToHttp();

        const httpStatus =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const responseBody = {
            statusCode: httpStatus,
            timestamp: new Date().toISOString(),
            path: httpAdapter.getRequestUrl(ctx.getRequest()),
            message:
                exception instanceof HttpException
                    ? exception.message
                    : 'Internal Server Error',
            error:
                exception instanceof HttpException
                    ? exception.name
                    : 'InternalServerError',
        };

        if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `Exception Filter : ${JSON.stringify(responseBody)}`,
                exception instanceof Error ? exception.stack : '',
            );
        } else {
            this.logger.error(
                `Exception Filter : ${JSON.stringify(responseBody)}`
            );
        }

        httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
    }
}
