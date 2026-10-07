import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import GalleryPage from "./pages/GalleryPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import ReportPage from "./pages/ReportPage.jsx";
import NavigatePage from "./pages/NavigatePage.jsx";

function DriveAlias() {
  const [params] = useSearchParams();
  const sim = params.get("sim") ? "?sim=1" : "";
  return <Navigate to={`/navigate${sim}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<MapPage />} />
        <Route path="/navigate" element={<NavigatePage />} />
        <Route path="/route" element={<NavigatePage />} />
        <Route path="/ride" element={<NavigatePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/photos" element={<GalleryPage />} />
        <Route path="/records" element={<GalleryPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="/drive" element={<DriveAlias />} />
      <Route path="/capture" element={<DriveAlias />} />
      <Route path="/map" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
