import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'node:http';
import path from 'path';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

import userRouter from "./routs/user/userRouts"; // Correct import
import libraryRouter from "./routs/library/libraryRouts"; // Correct import


dotenv.config();
const app = express();
const server = createServer(app);
const PORT = process.env.BACKEND_PORT || 5000;

const allowedOrigins = [
  'https://novelverse.cv',
  'https://www.novelverse.cv',
  'https://novel-verse-three.vercel.app',
  'http://localhost:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204 // for old browsers
}));

// preflight OPTIONS globally (important!)
app.options('*', cors());

app.use(express.json({ limit: "100mb" })); 
app.use(express.urlencoded({ limit: "100mb", extended: true }));


server.listen(PORT, () => {
  console.log(`server running at localhost:${PORT}`);
});
  
// app.use(bodyParser.json());
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});


const url: string | undefined = process.env.DATABASE_URL;

if (!url) {
    console.error("DATABASE_URL is not defined in .env file");
    process.exit(1); // Exit the process
}

mongoose.set("strictQuery", false);
mongoose
  .connect(url)
  .then(() => {
    console.log("Connected to mongoose");
  })
  .catch((err) => {
    console.log("Unable to connect to MongoDB. Error: " + err);
  });


app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/user', userRouter )
app.use("/api/lib", libraryRouter)
