import { BrowserRouter, Route, Routes } from "react-router-dom";
import CollectionPage from "./pages/CollectionPage";
import TokenPage from "./pages/TokenPage";
import NotFound from "./pages/NotFound";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<CollectionPage />} />
      <Route path="/token/:tokenId" element={<TokenPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
