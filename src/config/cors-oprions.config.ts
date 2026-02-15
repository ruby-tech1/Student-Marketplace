export const corsOptions = {
    origin: true, // Allow all origins for now, or configure as needed
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        'Origin',
        'X-Requested-With',
    ],
    exposedHeaders: ['Authorization'],
};
