import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, atLeast } from "@/lib/auth";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import ChangePassword from "@/pages/ChangePassword";
import Today from "@/pages/Today";
import RecordForm from "@/pages/RecordForm";
import Records from "@/pages/Records";
import RecordDetail from "@/pages/RecordDetail";
import Attendance from "@/pages/Attendance";
import Queue from "@/pages/Queue";
import More from "@/pages/More";
import MyOverview from "@/pages/MyOverview";
import Absence from "@/pages/Absence";
import Exports from "@/pages/Exports";
import Overview from "@/pages/Overview";
import Review from "@/pages/Review";
import Workplaces from "@/pages/Workplaces";
import QrDisplay from "@/pages/QrDisplay";
import UsersPage from "@/pages/Users";
import Guide, { guideKey } from "@/pages/Guide";
import Breaks from "@/pages/Breaks";
import Machines from "@/pages/Machines";

function Guard({ children, role, bare }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.must_change_password && loc.pathname !== "/zmena-hesla") return <Navigate to="/zmena-hesla" replace />;
  let guideSeen = false;
  try { guideSeen = localStorage.getItem(guideKey(user.id)) === "1"; } catch (_) { guideSeen = true; }
  if (!user.must_change_password && !guideSeen && loc.pathname !== "/jak-na-to") return <Navigate to="/jak-na-to" replace />;
  if (role && !atLeast(user, role)) return <Navigate to="/dnes" replace />;
  return bare ? children : <Layout>{children}</Layout>;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={atLeast(user, "manager") && window.innerWidth >= 1024 ? "/prehled" : "/dnes"} replace />;
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/zmena-hesla" element={<Guard bare><ChangePassword /></Guard>} />
            <Route path="/dnes" element={<Guard><Today /></Guard>} />
            <Route path="/zapis/novy" element={<Guard><RecordForm /></Guard>} />
            <Route path="/zapis/:id" element={<Guard><RecordForm /></Guard>} />
            <Route path="/zapisy" element={<Guard><Records /></Guard>} />
            <Route path="/detail/:id" element={<Guard><RecordDetail /></Guard>} />
            <Route path="/dochazka" element={<Guard><Attendance /></Guard>} />
            <Route path="/fronta" element={<Guard><Queue /></Guard>} />
            <Route path="/jak-na-to" element={<Guard><Guide /></Guard>} />
            <Route path="/prestavky" element={<Guard><Breaks /></Guard>} />
            <Route path="/vice" element={<Guard><More /></Guard>} />
            <Route path="/exporty" element={<Guard><Exports /></Guard>} />
            <Route path="/prehledy" element={<Guard><MyOverview /></Guard>} />
            <Route path="/nepritomnost" element={<Guard><Absence /></Guard>} />
            <Route path="/prehled" element={<Guard role="manager"><Overview /></Guard>} />
            <Route path="/kontrola" element={<Guard role="manager"><Review /></Guard>} />
            <Route path="/vsechny-zapisy" element={<Guard role="manager"><Records all /></Guard>} />
            <Route path="/pracoviste" element={<Guard role="manager"><Workplaces /></Guard>} />
            <Route path="/pracoviste/:id/qr" element={<Guard role="manager" bare><QrDisplay /></Guard>} />
            <Route path="/stroje" element={<Guard role="manager"><Machines /></Guard>} />
            <Route path="/uzivatele" element={<Guard role="manager"><UsersPage /></Guard>} />
            <Route path="*" element={<Home />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}
