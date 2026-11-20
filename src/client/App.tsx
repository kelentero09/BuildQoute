import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout";
import { Login, Register } from "./routes/AuthPages";
import { Home } from "./routes/Home";
import { Privacy, Terms } from "./routes/Legal";
import { NotFound } from "./routes/NotFound";

// Rarely visited pages are loaded on demand to keep the first page light.
const Settings = lazy(() => import("./routes/Settings").then((module) => ({ default: module.Settings })));
const Admin = lazy(() => import("./routes/Admin").then((module) => ({ default: module.Admin })));

export function App() {
  return (
    <Layout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
