import { BrowserRouter as Router } from "react-router-dom";
import "./App.css";
import AnimatedRoutes from "./Animations/AnimatedRoutes/AnimatedRoutes";

function App() {

  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}

export default App;
