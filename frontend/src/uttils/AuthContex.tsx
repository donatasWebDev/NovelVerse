import { ReactNode, createContext, useContext, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios, { isAxiosError } from "axios";
import Cookies from "js-cookie";
import { UserType, LoginInfo } from "../types"

const url = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001"

console.log("API Base URL:", url);

interface AuthContextType {
  user: UserType | null;
  loading: boolean;
  handleLogin: (loginInfo: LoginInfo) => Promise<unknown | undefined>;
  handleRegister: (registerInfo: {
    email: string;
    username: string;
    password: string;
  }) => Promise<boolean | undefined>;
  handleUserLogout: () => void;
  getToken: () => string | undefined;
  isEmailTaken: (email: string) => Promise<boolean | undefined>;
  isUsernameTaken: (username: string) => Promise<boolean | undefined>;
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
      const token = getToken();
      console.log("usertoken", token);
      console.log(token)
      if (!token) {
        setLoading(false)
        navigate("/login");
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
          token: res.data.user.token || token
        };

        if (!userData.id) {
          console.log("no user id found")
          navigate("/login");
        } else {
          console.log(userData)
          setUser(userData);
        }
      }
      setLoading(false);
    } catch (error: unknown) {
      console.log(error);
      if (isAxiosError(error) && error.response?.status === 401) {
        const token = getToken();
        if (token) Cookies.remove("userToken")
        setUser(null)
        navigate("/login")
      }
      setLoading(false);
    }
  };


  const getToken = () => {
    return Cookies.get("userToken");
  };

  const handleLogin = async (loginInfo: LoginInfo) => {
    try {
      const apiRes = await axios.post(`${url}/user/login`, {
        email: loginInfo.email.text,
        password: loginInfo.password.text,
      });

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
        return
      }
    } catch (err) {
      console.log("error: ", err);
      return err
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
      if (res.data.token) {
        Cookies.set("userToken", res.data.token);
        const userData: UserType = {
          email: res.data.email,
          name: res.data.name,
          id: res.data._id,
          token: res.data.token,
          avatarUrl: res.data.avatarUrl,
        };
        setUser(userData);
        navigate("/");
        return true;
      }
      return false;

    }
    catch (err) {
      console.log("error: ", err);
      return false;
    }
  }

  const handleUserLogout = () => {
    setUser(null);
    Cookies.remove("userToken");
    navigate("/login");
  };


  const isEmailTaken = async (email: string) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/exist/email`, {
        email: email
      });
      if (res) {
        return res.data.isTaken as boolean;
      }
    } catch (err) {
      console.log(err);
    }
  }

  const isUsernameTaken = async (username: string) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/exist/username`, {
        name: username
      });
      if (res) {
        return res.data.isTaken as boolean;
      }
    } catch (err) {
      console.log(err);
    }
  }

  const handleEmailVerification = async (email: string) => {
    try {
      console.log("calling api");
      const res = await axios.post(`${url}/user/verify/email`, {
        email: email
      });
      if (res.data) {
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

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;