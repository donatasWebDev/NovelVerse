import multer, { StorageEngine, FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { format } from 'date-fns';
import { Request, Response, NextFunction } from 'express';

// Define a type for the uploaded file
interface CustomRequest extends Request {
  body: {
    user_id: string;
    filename?: string;
  };
}

// Set up storage configuration
const storage: StorageEngine = multer.diskStorage({
  destination: (req: CustomRequest, file: Express.Multer.File, cb: (error: null | Error, destination: string) => void) => {
    const userDir = path.resolve(__dirname, '..', 'uploads', req.body.user_id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir); // Store files in the `uploads/{user_id}` folder
  },
  filename: (req: CustomRequest, file: Express.Multer.File, cb: (error: null | Error, filename: string) => void) => {
    // Use a unique filename (timestamp + file extension)
    const date = new Date();
    const formattedDate = format(date, 'yyyy-MM-dd_HH-mm-ss');
    console.log(formattedDate + path.extname(file.originalname));
    const uniqueName = formattedDate + path.extname(file.originalname);
    cb(null, uniqueName);
  },
  // filename: function (req, file, cb) {
  //   // Use a unique filename (timestamp + original file extension)
  //   const customName = req.body.filename || Date.now(); // Use a fallback timestamp if no name is provided
  //   const fileExtension = path.extname(file.originalname); // Get file extension
  //   const finalFilename = `${customName}${fileExtension}`; // Combine name and extension
  //   cb(null, finalFilename); // Set the file name
  // }
});

// Define file size limit (50MB max)
const limits = { fileSize: 50 * 1024 * 1024 };

// File filter function to only accept .wav files
const fileFilter = (req: CustomRequest, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (file.mimetype === 'audio/wav') {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Invalid file type, only .wav is allowed') as any, false); // Reject the file with an Error object and type assertion
  }
};
// Initialize multer with storage, file filter, and size limit
const upload = multer({ storage, fileFilter, limits });

export default upload;