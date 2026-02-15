import { Type } from 'class-transformer';
import {
    IsOptional,
    IsPositive,
    IsInt,
    Min,
    IsString,
    IsIn,
} from 'class-validator';
import { FindOptionsWhere, ILike } from 'typeorm';
import AppConstants from './app-constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationAndSortingResult<T> {
    data: T[];
    meta: PaginationMeta;
}

export class PaginationMeta {
    @ApiProperty({ type: 'integer' })
    totalItems: number;

    @ApiProperty({ type: 'integer' })
    itemCount: number;

    @ApiProperty({ type: 'integer' })
    itemsPerPage: number;

    @ApiProperty({ type: 'integer' })
    totalPages: number;

    @ApiProperty({ type: 'integer' })
    currentPage: number;

    @ApiProperty({ type: 'boolean' })
    hasNextPage: boolean;

    @ApiProperty({ type: 'boolean' })
    hasPreviousPage: boolean;
}

export class PaginationQueryDto {
    @ApiPropertyOptional({
        type: 'string',
        default: '',
        description: 'This is the search query field',
    })
    @IsOptional()
    @IsString()
    search?: string = AppConstants.PAGE_SEARCH;

    @ApiPropertyOptional({
        type: 'number',
        default: 1,
        description: 'This is the page number query field',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = AppConstants.PAGE;

    @ApiPropertyOptional({
        type: 'integer',
        default: 10,
        description: 'This is the limit query field',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    @Min(1)
    limit?: number = AppConstants.PAGE_LIMIT;

    @ApiPropertyOptional({
        type: 'string',
        default: 'createdAt',
        description: 'This is the sort query field',
    })
    @IsOptional()
    @IsString()
    sortBy?: string = AppConstants.PAGE_SORT;

    @ApiPropertyOptional({
        type: 'string',
        default: 'ASC',
        description: 'This is the order query field',
    })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    order?: 'ASC' | 'DESC' = AppConstants.PAGE_ORDER;
}

export class PaginationAndSorting {
    public static createFindOptions<T>(
        searchColumn: string | string[] | null,
        queryDto: PaginationQueryDto,
        additionalWhere: FindOptionsWhere<T> = {},
        compulsoryWhere: FindOptionsWhere<T> = {},
        relations: string[] = [],
    ) {
        const {
            page = AppConstants.PAGE,
            limit = AppConstants.PAGE_LIMIT,
            sortBy = AppConstants.PAGE_SORT,
            order = AppConstants.PAGE_ORDER,
            search = AppConstants.PAGE_SEARCH,
        }: PaginationQueryDto = queryDto;

        const validatedLimit: number = Math.min(limit, AppConstants.PAGE_LIMIT);

        const searchConditions = searchColumn
            ? Array.isArray(searchColumn)
                ? searchColumn.map((column) => ({
                    ...compulsoryWhere,
                    [column]: ILike(`%${search}%`),
                }))
                : [{ ...compulsoryWhere, [searchColumn]: ILike(`%${search}%`) }]
            : null;

        const hasSearch = !!(search && search.trim().length > 0);

        return {
            where:
                hasSearch && searchConditions
                    ? [
                        ...searchConditions!,
                        // If additionalWhere is provided, do we combine it with search?
                        // The reference logic:
                        // ...(Object.keys(additionalWhere).length > 0 ? [{ ...additionalWhere, ...compulsoryWhere }] : []),
                        // This seems to append additionalWhere as an OR condition? 
                        // Or maybe it means "match search conditions OR match additionalWhere".
                        // Let's assume we want AND behavior usually, but TypeORM [] is OR.
                        // If we want AND, we should merge additionalWhere into searchConditions.
                        // But reference implementation returns an array.
                        // Let's stick to reference implementation logic.
                        ...(Object.keys(additionalWhere).length > 0
                            ? [{ ...additionalWhere, ...compulsoryWhere }]
                            : []),
                    ]
                    : [{ ...additionalWhere, ...compulsoryWhere }],
            skip: (page - 1) * limit,
            take: validatedLimit,
            order: { [sortBy]: order },
            relations,
        };
    }

    public static getPaginateResult<T, R>(
        data: T[],
        total: number,
        queryDto: PaginationQueryDto,
        convertToDto: (data: T) => R,
        isBypass: boolean = false,
    ): PaginationAndSortingResult<R> {
        const { page = AppConstants.PAGE, limit = AppConstants.PAGE_LIMIT } =
            queryDto;
        const validatedLimit = !isBypass
            ? Math.min(limit, AppConstants.PAGE_LIMIT)
            : limit;
        const totalPages = Math.ceil(total / validatedLimit);

        const newData = data.map((item) => convertToDto(item));

        return {
            data: newData,
            meta: {
                totalItems: total,
                itemCount: data.length,
                itemsPerPage: validatedLimit,
                totalPages,
                currentPage: page,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
            },
        };
    }
}
