import { Module } from '@nestjs/common';
import { MyLoggerService } from './service/logger/my-logger.service';
import { MyConfigModule } from './config-module/config.module';
import { RabbitMQService } from './service/rabbitmq/rabbitmq.service';
import { EmailService } from './service/email/email.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigInterface } from './config-module/configuration';
import { JwtModule } from '@nestjs/jwt';
import { CustomJwtService } from './service/token/jwt.service';
import { TokenService } from './service/token/token.service';
import { AuthService } from './service/auth/auth.service';
import { UserService } from './service/user/user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth.guard';
import { RoleGuard } from './common/guards/role.guard';
import { User } from './model/entity/user.entity';
import { Token } from './model/entity/token.entity';
import { Verification } from './model/entity/verification.entity';
import { RbacService } from './service/rbac/rbac.service';
import { PugAdapter } from '@nestjs-modules/mailer/dist/adapters/pug.adapter';
import { MailerModule, MailerOptions } from '@nestjs-modules/mailer';
import { VerificationService } from './service/verification/verification.service';
import { EmailEvent } from './service/email/email-event.service';
import { AuthController } from './controller/auth.controller';
import { UserController } from './controller/user.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionFilter } from './all-exception.filter';
import AppDataSource from './config/typeorm.config';

@Module({
  imports: [
    MyConfigModule,
    // ConfigModule.forRoot({ isGlobal: true }), // MyConfigModule already exports ConfigModule
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ConfigInterface>) => {
        const appConfig = configService.get('app', { infer: true });
        const databaseConfig = configService.get('database', { infer: true });

        if (!appConfig || !databaseConfig) {
          throw new Error('Missing configuration.');
        }

        return {
          type: 'postgres',
          host: databaseConfig.host,
          port: databaseConfig.port,
          username: databaseConfig.username,
          password: databaseConfig.password,
          database: databaseConfig.name,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: appConfig.env === 'dev',
          autoLoadEntities: true,
          logging: appConfig.env === 'dev',
          ssl: appConfig.env === 'prod' ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ConfigInterface>) => {
        const tokenToken = configService.get('token', { infer: true });
        if (!tokenToken) throw new Error('Token config missing');
        return {
          secret: tokenToken.secret,
          signOptions: {
            expiresIn: tokenToken.jwtExpire as any,
          },
        };
      },
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<ConfigInterface>): MailerOptions => {
        const emailConfig = configService.get('email', { infer: true });
        const appConfig = configService.get('app', { infer: true });
        if (!emailConfig) throw new Error('Email config missing');
        return {
          transport: {
            host: emailConfig.host,
            port: emailConfig.port,
            secure: false,
            auth: {
              user: emailConfig.username,
              pass: emailConfig.password,
            },
            requireTLS: true,
            logger: appConfig?.env === 'dev',
            debug: appConfig?.env === 'dev',
            tls: { rejectUnauthorized: false },
          },
          defaults: {
            from: emailConfig.sender,
          },
          template: {
            dir: __dirname + '/templates',
            adapter: new PugAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    TypeOrmModule.forFeature([
      User,
      Token,
      Verification,
    ]),
  ],
  controllers: [
    AuthController,
    UserController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionFilter,
    },
    MyLoggerService,
    EmailService,
    RabbitMQService,
    TokenService,
    CustomJwtService,
    AuthService,
    UserService,
    RbacService,
    VerificationService,
    EmailEvent,
  ],
  exports: [RbacService, CustomJwtService],
})
export class AppModule { }
