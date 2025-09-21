import { LogOut, Settings } from "lucide-react";
import { useAuth } from "../uttils/AuthContex";
export const UserProfile = () => {
  const { user, handleUserLogout } = useAuth();
  const nameCapitalized = user.name.charAt(0).toUpperCase() + user.name.slice(1);
  return <div className="mt-auto border-t border-gray-700 pt-6">
    <div className="flex items-center gap-3 mb-6">
      <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100" alt="User profile" className="w-10 h-10 rounded-full" />
      <div>
        <h3 className="text-sm font-medium text-gray-100">{nameCapitalized}</h3>
        <p className="text-xs text-gray-400">{`@${user.name}`}</p>
      </div>
    </div>
    <div className="flex flex-col gap-2">
      <button className="flex items-center gap-3 text-gray-400 hover:bg-gray-700 p-3 rounded-lg transition-colors">
        <Settings className="w-5 h-5" />
        <span className="text-sm">Settings</span>
      </button>
      <button className="flex items-center gap-3 text-red-400 hover:bg-gray-700 p-3 rounded-lg transition-colors"
        onClick={handleUserLogout}
        >
        <LogOut className="w-5 h-5" />
        <span className="text-sm">Logout</span>
      </button>
    </div>
  </div>;
};