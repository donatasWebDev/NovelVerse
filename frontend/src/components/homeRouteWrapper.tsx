import { Navigate, useLocation } from "react-router-dom";
import { HomePage } from "../pages/homePage";

export function HomeRouteWrapper() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);

    if (!params.has("page")) {
        return <Navigate to="/?page=1" replace />;
    }

    return <HomePage />;
}
