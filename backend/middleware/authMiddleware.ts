import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import {PrismaClient} from "@prisma/client" // Assuming you have an IUser interface

interface AuthRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
}
type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

const prisma = new PrismaClient();

const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // get token from header
      token = req.headers.authorization.split(" ")[1];

      // verify token
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "");

      // get user form token
      const userData = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, email: true, emailVerified: true},
      });
      if (!userData) {
        res.status(401).json({ message: "User not Found" })
        return;
      }
      req.user = userData
      next();
    } catch (err: any) {
      console.log(err + " middleware");
      res.status(401).json({ message: err.message });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Unauthorized, no token" });
  }
};

export { protect };