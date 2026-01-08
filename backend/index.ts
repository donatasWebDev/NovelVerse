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

const corsOptions = {
  origin: ["http://localhost:5173","http://192.168.0.242:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};;

app.use(express.json({ limit: "100mb" })); 
app.use(express.urlencoded({ limit: "100mb", extended: true }));


  app.use(cors(corsOptions));
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
