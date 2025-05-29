import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./home.scss";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="HomePage">
      <section className="HomePage-buttonContainer">
        <motion.button
          className="HomePage-button"
          type="button"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0 }}
          onClick={() => navigate("/online")}
        >
          ONLINE
        </motion.button>
        <motion.button
          className="HomePage-button"
          type="button"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 10, delay: 0.3 }}
          onClick={() => navigate("/lobby")}
        >
          PLAY WITH FRIEND
        </motion.button>
        <motion.button
          className="HomePage-button"
          type="button"
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 5, delay: 0.6 }}
          onClick={() => navigate("/patreon")}
        >
          PATREON
        </motion.button>
      </section>
    </div>
  );
};

export default Home;
