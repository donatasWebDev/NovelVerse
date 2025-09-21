import React from "react";
import { LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {useAuth} from "../uttils/AuthContex.tsx";
export const RegisterLogin = () => {
    const navigate = useNavigate();
    const {user, handleUserLogout} = useAuth();

  return <div className="mt-auto border-t border-gray-700 pt-6">
      {
        user? (
          <div className="flex flex-col-reverse items-center gap-5 mb-6">
            <div className="flex items-center gap-5">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100" alt="User profile" className="w-10 h-10 rounded-full" />
              <h3 className="text-sm font-medium text-gray-100">{user.email}</h3>
            </div>
            <button className="text-sm text-gray-400 hover:text-gray-300" onClick={handleUserLogout}>
              <LogOut />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
          <button className="flex items-center gap-3 bg-purple-600 bg-opacity-100 text-gray-300 hover:bg-opacity-80 p-3 rounded-lg transition-colors"
          onClick={ () => navigate("/login")}
          >
            <span className="text-xl font-bold text-center w-full">Login</span>
          </button>
          <button className="flex items-center gap-3 text-gray-400 hover:bg-gray-700 p-3 rounded-lg transition-colors"
          onClick={ () => navigate("/signup")}
          >
            <span className="text-xl font-bold text-center w-full">Sing up</span>
          </button>
        </div>
        )
      }
    </div>;
};