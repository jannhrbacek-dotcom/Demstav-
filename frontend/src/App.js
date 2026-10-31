import { AppLock } from "@/components/AppLock";
import LaunchScreen from "@/components/LaunchScreen";
import React from "react";
import { ThemeProvider } from "next-themes";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth, atLeast } from "@/lib/auth";
import { LanguageProvider } from "@/lib/language";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import ChangePassword from "@/pages/ChangePassword";
import Today from "@/pages/Today";
import RecordForm from "@/pages/RecordForm";
import Records from "@/pages/Records";
import RecordImport from "@/pages/RecordImport";
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
import Production from "@/pages/Production";
import Guide, { guideKey } from "@/pages/Guide";
import Machines from "@/pages/Machines";
import TeamCalendar from "@/pages/TeamCalendar";
import AssistantDemo from "@/pages/AssistantDemo";

function Guard({ children, role, bare }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.must_change_password && loc.pathname !== "/zmena-hesla") return <Navigate to="/zmena-hesla" replace />;
  if (!user.must_change_password && loc.pathname !== "/jak-na-to" && !localStorage.getItem(guideKey(user.id))) return <Navigate to="/jak-na-to" replace state={{ returnTo: loc.pathname }} />;
  if (role && !atLeast(user, role)) return <Navigate to="/dnes" replace />;
  return bare ? children : <Layout>{children}</Layout>;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={"/dnes"} replace />;
}

export default function App() {
  return (
    <div className="App">
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="demstav-theme">
      <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppLock><LaunchScreen />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/ai-ukazka" element={<AssistantDemo />} />
            <Route path="/zmena-hesla" element={<Guard bare><ChangePassword /></Guard>} />
            <Route path="/jak-na-to" element={<Guard><Guide /></Guard>} />
            <Route path="/dnes" element={<Guard><Today /></Guard>} />
            <Route path="/zapis/novy" element={<Guard><RecordForm /></Guard>} />
            <Route path="/zapis/:id" element={<Guard><RecordForm /></Guard>} />
            <Route path="/zapisy" element={<Guard><Records /></Guard>} />
            <Route path="/zapisy/import" element={<Guard><RecordImport /></Guard>} />
            <Route path="/detail/:id" element={<Guard><RecordDetail /></Guard>} />
            <Route path="/dochazka" element={<Guard><Attendance /></Guard>} />
            <Route path="/fronta" element={<Guard><Queue /></Guard>} />
            <Route path="/vykazy-vazeni" element={<Guard><Production /></Guard>} />
            <Route path="/vice" element={<Guard><More /></Guard>} />
            <Route path="/exporty" element={<Guard><Exports /></Guard>} />
            <Route path="/prehledy" element={<Guard><MyOverview /></Guard>} />
            <Route path="/nepritomnost" element={<Guard><Absence /></Guard>} />
            <Route path="/kalendar" element={<Guard><TeamCalendar /></Guard>} />
            <Route path="/prehled" element={<Guard role="manager"><Overview /></Guard>} />
            <Route path="/kontrola" element={<Guard role="manager"><Review /></Guard>} />
            <Route path="/vsechny-zapisy" element={<Guard role="manager"><Records all /></Guard>} />
            <Route path="/pracoviste" element={<Guard role="manager"><Workplaces /></Guard>} />
            <Route path="/pracoviste/:id/qr" element={<Guard role="manager" bare><QrDisplay /></Guard>} />
            <Route path="/servis" element={<Guard><Machines serviceOnly /></Guard>} />
            <Route path="/stroje" element={<Guard><Machines /></Guard>} />
            <Route path="/uzivatele" element={<Guard role="manager"><UsersPage /></Guard>} />
            <Route path="*" element={<Home />} />
          </Routes>
            <Toaster position="top-center" richColors />
          </AppLock>
        </BrowserRouter>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
    </div>
  );
}
