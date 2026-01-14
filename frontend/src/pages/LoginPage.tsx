import React, { useEffect, useState } from "react";
import { useAuth } from "../uttils/AuthContex";
import {Link} from "react-router-dom"

interface LoginInfo {
  email: string;
  password: string;
}

// interface loginStateData {
//   [key: string]: string | undefined
// }

interface LoginInfo {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const { handleLogin } = useAuth()!;
  const [loginInfo, setLoginInfo] = useState<LoginInfo>({ email: "", password: "" });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.type
    const value = e.target.value;
    setLoginInfo((prevState) => ({
      ...prevState,
      [id]: value
    }));

  }
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleLogin(loginInfo);
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
            <input type="email" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none" 
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input type="password" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none" 
              onChange={handleChange}
            />
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