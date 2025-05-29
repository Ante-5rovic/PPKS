import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Home from "../../Pages/Home/Home";
import Online from "../../Pages/Online/Online";
import Patreon from "../../Pages/Patreon/Patreon";
import Lobby from "../../Pages/Lobby/Lobby";
import NotFound from "../../Pages/NotFound/NotFound";
import PageWrapper from "../PageWrapper/PageWrapper";

const AnimatedRoutes = () => {
    const location = useLocation();

    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
          <Route path="/online" element={<PageWrapper><Online /></PageWrapper>} />
          <Route path="/lobby" element={<PageWrapper><Lobby /></PageWrapper>} />
          <Route path="/patreon" element={<PageWrapper><Patreon /></PageWrapper>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    );
}

export default AnimatedRoutes