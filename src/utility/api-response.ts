import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T> {
    @ApiProperty()
    status: string;

    @ApiProperty()
    message: string;

    @ApiProperty()
    data: T | null;

    constructor(status: string, message: string, data: T | null) {
        this.status = status;
        this.message = message;
        this.data = data;
    }

    static success<T>(data: T, status: number = 200, message = 'Success') {
        return new ApiResponse<T>(status.toString(), message, data);
    }

    static error<T>(message: string, status: number = 400, data: T | null = null) {
        return new ApiResponse<T>(status.toString(), message, data);
    }
}
