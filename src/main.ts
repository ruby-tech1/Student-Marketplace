import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionFilter } from './all-exception.filter';
import AppConstants from './utility/app-constants';
import { corsOptions } from './config/cors-oprions.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionFilter(httpAdapterHost));
  app.setGlobalPrefix(AppConstants.APP_GLOBAL_PREFIX);
  app.enableCors(corsOptions);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // Explicitly enable transform
    }),
  );

  const swaggerOptions = new DocumentBuilder()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .setTitle('Student Marketplace API')
    .setDescription('API Documentation for Student Marketplace (User, Vendor, Admin)')
    .setVersion('1.0')
    .addServer('http://localhost:5000', 'Local environment')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerOptions);

  // document.security = [{ 'access-token': [] }]; // This applies global security, optional if using decorators

  SwaggerModule.setup(`/docs`, app, document);

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
