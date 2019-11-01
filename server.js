const dotenv = require('dotenv');
const mongoose = require('mongoose');
const app = require('./app');

process.on('uncaughtException', err => {
  console.log(err.name, err.message);
  console.log('UNHANDLED EXCEEPTION -------- SHUTTING DOWN......');
});

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('DB Conneciton was successful');
  })
  .catch(err => {
    console.log(`DB Connection Error: ${err.message}`);
  });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`this is the ${port} here`);
});

process.on('unhandledRejection', err => {
  console.log(err.name, err.message);
  console.log('UNHANDLED REJECTION -------- SHUTTING DOWN......');
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('🔥SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('🔥Process terminated');
  });
});
