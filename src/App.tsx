import { Button, Icon, Layout } from "@stellar/design-system";
import ConnectAccount from "./components/ConnectAccount.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";
import { Routes, Route, Outlet, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Debugger from "./pages/Debugger.tsx";

const AppLayout: React.FC = () => (
  <main>
    <Layout.Header
      projectId="Splicers"
      projectTitle="Splicers"
      contentRight={
        <>
          <nav>
            <NavLink
              to="/debug"
              style={{
                textDecoration: "none",
              }}
            >
              {({ isActive }) => (
                <Button
                  variant="tertiary"
                  size="md"
                  onClick={() => (window.location.href = "/debug")}
                  disabled={isActive}
                >
                  <Icon.Code02 size="md" />
                  Debugger
                </Button>
              )}
            </NavLink>
          </nav>
          <ConnectAccount />
        </>
      }
    />
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  </main>
);

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/debug" element={<Debugger />} />
        <Route path="/debug/:contractName" element={<Debugger />} />
      </Route>
    </Routes>
  );
}

export default App;
