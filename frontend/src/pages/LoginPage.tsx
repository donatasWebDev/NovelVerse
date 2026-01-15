import React, { useEffect, useState } from "react";
import { useAuth } from "../uttils/AuthContex";
import { Link } from "react-router-dom"
import { error } from "console";
import { LoginInfo } from "../types";



export const LoginPage = () => {
  const { handleLogin } = useAuth()!;
  const [loginInfo, setLoginInfo] = useState<LoginInfo>({
    email: {
      text: "",
      err: ""
    },
    password: {
      text: "",
      err: ""
    }
  })

  useEffect(() => {
    console.log(loginInfo)
  }, [loginInfo])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {

    const name = e.target.name
    const value = e.target.value;
    setLoginInfo((prev: any) => ({
      ...prev,
      [name]: {
        err: "",
        text: value
      }
    }));
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidEmail(loginInfo.email.text)) {
      setFieldError('email', "Invalid Email");
      return
    }

    // if (validatePassword(loginInfo.password.text) !== "") {
    //   setFieldError("password", validatePassword(loginInfo.password.text))
    //   return
    // }


    const error: any | undefined = await handleLogin(loginInfo);
    if (error) {
      setFieldError('email', "Invalid Email");
      setFieldError('password', "Invalid Password");
    }
  }

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const setFieldError = (field: 'email' | 'password', message: string) =>
    setLoginInfo(prev => ({
      ...prev,
      [field]: { ...prev[field], err: message },
    }));

  const validatePassword = (password: string): string => {
    if (!password.trim()) {
      return "Password is required";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }

    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }

    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }

    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    return ""
  }

  // if (!handleLogin) {
  //   // Handle case where context is not available
  //   return <div>Loading...</div>;
  // }
  return <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
    <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
        Welcome to NovelVerse
      </h2>
      <form className="space-y-4"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Email
          </label>
          <input type="email" name="email" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
            onChange={handleChange}
          />
          <span className="text-sm text-red-500">{loginInfo.email.err}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Password
          </label>
          <input type="password" name="password" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none"
            onChange={handleChange}
          />
          <span className="text-sm text-red-500">{loginInfo.password.err}</span>
        </div>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 transition-colors"
          type="submit"
        >
          Login
        </button>
      </form>
      {/* <p className="mt-4 text-center text-gray-400">
          Don't have an account?{" "}
          <Link to="/signup" className="text-purple-500 hover:text-purple-400">
            Sign up
          </Link>
        </p> */}
    </div>
  </div>;
};