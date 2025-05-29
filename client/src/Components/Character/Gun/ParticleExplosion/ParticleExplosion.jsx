import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import "./particleExplosion.scss"

const ParticleExplosion = ({ position }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false);
    }, 300); 

    return () => clearTimeout(timeout);
  }, []);

  const style = {
    left: position.x - 10,
    top: position.y - 10,
  };

  return visible ? (
    <motion.div
      className="ParticleExplosion"
      style={style}
      initial={{ scale: 1 }}
      animate={{ scale: 2.5}}
      exit={{scale: 3 }}
      transition={{ duration: 0.3 }}
    />
  ) : null;
};

export default ParticleExplosion;
