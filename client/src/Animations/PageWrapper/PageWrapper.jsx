import React from 'react'
import { motion } from "framer-motion";

const PageWrapper = ({ children }) => {
    return (
        <motion.div 
          initial={{ y: "-100vh", opacity: 0 }} // Početna pozicija (iznad ekrana)
          animate={{ y: "0", opacity: 1 }} // Pada na svoje mjesto
          exit={{ y: "100vh", opacity: 0 }} // Nestaje prema dolje
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="PageWraper"
        >
          {children}
        </motion.div>
      );
}

export default PageWrapper