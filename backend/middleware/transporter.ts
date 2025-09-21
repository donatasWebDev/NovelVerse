import nodemailer from 'nodemailer';
import { Request, Response, NextFunction } from 'express';

// Define a type for the transporter (optional, but recommended)
type Transporter = ReturnType<typeof nodemailer.createTransport>;

const transporter: Transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

// Extend the Request interface to include the transporter
interface CustomRequest extends Request {
  transporter?: Transporter;
}

const attachTransporter = (req: CustomRequest, res: Response, next: NextFunction) => {
  req.transporter = transporter;
  next();
};

export { attachTransporter };