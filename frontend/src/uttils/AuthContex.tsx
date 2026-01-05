import { ReactNode, createContext, useContext, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";
import {UserType} from "../types"


const isDev = import.meta.env.DEV;
const url = isDev 
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001') 
  : '' + "/api";
  
  

console.log("API Base URL:", url);


interface AuthContextType {
  user: UserType | null;
  loading: boolean;
  handleLogin: (loginInfo: { email: string; password: string }) => Promise<boolean | undefined>;
  handleRegister: (registerInfo: {
    email: string;
    username: string;
    password: string;
  }) => Promise<boolean | undefined>;
  handleUserLogout: () => void;
  getToken: () => string | undefined;
  isEmailTaken: (email: string) => Promise<boolean>;
  isUsernameTaken: (username: string) => Promise<boolean>;
  handleEmailVerification: (email: string) => Promise<void>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserType | null>(null);

  useEffect(() => {
    getUserOnLoad();
  }, [])

  const getUserOnLoad = async () => {
    try {
      const token =  getToken();
      console.log("usertoken", token);
      console.log(token)
      if (!token) {
        setLoading(false)
        navigate("/login"); // Redirect if no token (meaning user is not logged in)
        return
      }

      const res = await axios.get(`${url}/user/`, {
        headers: { Authorization: "Bearer " + token },
      });
      console.log(res)
      if (res && res.data) {
        const userData: UserType = {
          email: res.data.user.email,
          name: res.data.user.name,
          id: res.data.user.id,
          token: res.data.user.token,
        };

      if (!userData.id) {
        navigate("/login"); // Redirect if no user ID (meaning login failed)
      } else {
        console.log(userData)
        setUser(userData); // Set user state if login is successful
      }
      setLoading(false);
    }
    } catch (error: any) {
      console.log(error);
      if (error.response.status === 401) {
         Cookies.remove("userToken")
         setUser(null)
         navigate("/login")
      }
    }
  };


  const getToken = () => {
    return Cookies.get("userToken");
  };

  const handleLogin = async (
    loginInfo: { email: string; password: string } // Type for login info
  ) => {
    try {
      const apiRes = await axios.post(`${url}/user/login`, {
        email: loginInfo.email,
        password: loginInfo.password,
      });

      // if (apiRes.data.message.includes("notverified")) {
      //   console.log("user is not authenticated")
      //   navigate("/user/verify")
      // }

      if (apiRes.data.token !== "" && apiRes.data.token) {
        Cookies.set("userToken", apiRes.data.token);
        const userData: UserType = {
          email: apiRes.data.email,
          name: apiRes.data.name,
          id: apiRes.data._id,
          token: apiRes.data.token,
          avatarUrl: apiRes.data.avatarUrl,
        };
        navigate("/");
        setUser(userData);
        console.log(userData)
      }
    } catch (err) {
      console.log("error: ", err);
      return true;
    }
  };
  const handleRegister = async (registerInfo: {
    email: string;
    username: string;
    password: string;
  }) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/`, {
        name: registerInfo.username,
        email: registerInfo.email,
        password: registerInfo.password,

      });
      if (res.data.token !== "" && res.data.token){
        const userData: UserType = {
          email: res.data.email,
          name: res.data.name,
          id: res.data._id,
          token: res.data.token,
          avatarUrl: res.data.avatarUrl,
        };
        setUser(userData);

        navigate("/");

      }

    }
    catch (err) {
      console.log("error: ", err);
      return true;
    }
  }
  const handleUserLogout = async () => {
    // e.preventDefault();
    setUser(null);
    Cookies.remove("userToken");
    navigate("/login");
  };


  const isEmailTaken = async (email: String) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/exist/email`, {
        email: email
      });
      if (res) {
        return res.data.isTaken;
      }
    } catch (err) {
      console.log(err);
    }
  }

  const isUsernameTaken = async (username: String) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/exist/username`, {
        name: username
      });
      if (res) {
        return res.data.isTaken;
      }
    } catch (err) {
      console.log(err);
    }
  }

  const handleEmailVerification = async (email: String) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/verify/email`, {
        email: email
      });
      if(res.data){
        navigate("/")
      }
      navigate("/")
    } catch (err) {
      console.log(err);
    }
  }

  const contextData: AuthContextType = useMemo(
    () => ({
      user,
      loading,
      handleLogin,
      handleRegister,
      handleUserLogout,
      getToken,
      isEmailTaken,
      isUsernameTaken,
      handleEmailVerification,
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={contextData}>
      {loading ? (
        <div className="w-8 aspect-square animate-spin bg-gradient-to-t from-black to-fuchsia-500">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
};
export const useAuth = () => {
  return useContext(AuthContext);
};
export default AuthContext;
