import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateDto {
    @ApiPropertyOptional({
        description: 'This is the id of the record returned',
    })
    id?: string;

    @ApiPropertyOptional({
        type: Date,
        description: 'This is the timestamp for the time the record was created',
    })
    createdAt?: Date;

    @ApiPropertyOptional({
        type: Date,
        description:
            'This is the timestamp for the time the record was last updated',
    })
    updatedAt?: Date;

    @ApiPropertyOptional({
        type: Date,
        description: 'This is the timestamp for the time the record was deleted',
    })
    deletedAt?: Date;
}
