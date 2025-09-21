import React from "react";
export const SignupPage = () => {
  return <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
          Create an Account
        </h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <input type="text" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input type="email" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input type="password" className="w-full bg-gray-700 text-gray-100 rounded-lg px-4 py-2 border border-gray-600 focus:border-purple-500 focus:outline-none" />
          </div>
          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 transition-colors">
            Sign Up
          </button>
        </form>
        <p className="mt-4 text-center text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="text-purple-500 hover:text-purple-400">
            Login
          </a>
        </p>
      </div>
    </div>;
};