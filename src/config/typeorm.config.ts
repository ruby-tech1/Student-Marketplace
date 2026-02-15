import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { ConfigInterface } from '../config-module/configuration';

config();

const configService = new ConfigService<ConfigInterface>();

const databaseConfig = configService.get<ConfigInterface['database']>('database', { infer: true });

export default new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.APP_ENV === 'dev',
    ssl: process.env.APP_ENV === 'prod' ? { rejectUnauthorized: false } : false,
});
