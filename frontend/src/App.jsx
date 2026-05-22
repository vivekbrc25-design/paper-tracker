import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ConfigPage } from "./components/Config.jsx";
import { FeedbackProvider } from "./components/Feedback.jsx";
import { AppShell } from "./components/Layout.jsx";
import { PapersPage } from "./components/Papers.jsx";
import { ReportsPage } from "./components/Reports.jsx";
import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";

function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <WorkspaceProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate replace to="/papers" />} />
              <Route path="/papers" element={<PapersPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/config" element={<ConfigPage />} />
            </Route>
          </Routes>
        </WorkspaceProvider>
      </FeedbackProvider>
    </BrowserRouter>
  );
}

export default App;
