import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from './api';
import GatePage from './pages/GatePage';
import HomePage from './pages/HomePage';
import DebatePage from './pages/DebatePage';
import HistoryPage from './pages/HistoryPage';
import PersonaLibraryPage from './pages/PersonaLibraryPage';

function NavBar() {
  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded text-sm transition-colors ${
      isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <nav className="flex items-center gap-1 px-6 py-3 border-b border-white/10">
      <span className="text-white font-semibold mr-6 text-lg">DebateForge</span>
      <NavLink to="/" className={linkClass} end>Home</NavLink>
      <NavLink to="/history" className={linkClass}>History</NavLink>
      <NavLink to="/personas" className={linkClass}>Personas</NavLink>
    </nav>
  );
}

function AuthShell() {
  const [authed, setAuthed] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.get('/auth/check')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return <div className="flex items-center justify-center h-screen text-gray-500">Loading…</div>;
  }

  // Authenticated user on /gate → redirect to home
  if (authed && location.pathname === '/gate') {
    return <Navigate to="/" replace />;
  }

  // Unauthenticated user on any page except /gate → redirect to gate
  if (!authed && location.pathname !== '/gate') {
    return <Navigate to="/gate" replace />;
  }

  return (
    <>
      {authed && <NavBar />}
      <Routes>
        <Route path="/gate" element={<GatePage onAuth={() => setAuthed(true)} />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/debate/:id" element={<DebatePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/personas" element={<PersonaLibraryPage />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthShell />
    </BrowserRouter>
  );
}
