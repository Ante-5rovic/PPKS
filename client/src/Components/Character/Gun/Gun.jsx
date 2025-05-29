// Gun.jsx
import React, { useEffect, useRef, useMemo, useState, useCallback } from "react"; // Dodaj useCallback
import "./gun.scss";
import { motion } from "framer-motion";

const Gun = ({
  boxShadow,
  attackPoints,
  CAModifier,
  attackSpeed,
  bulletSpeed,
  rotation,
  onShoot,
  canvasRef,
  shootSignal,
}) => {
  const gunRef = useRef(null);
  const [isReady, setIsReady] = useState(false);


  const handleShoot = useCallback(() => {
    if (!isReady || !gunRef.current || !canvasRef?.current) {

      return;
    }

    const gunRect = gunRef.current.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();

    if (isNaN(gunRect.left) || isNaN(gunRect.top) || gunRect.width === 0 || gunRect.height === 0) {
      console.warn("Gun.jsx: Nevaljan gunRect", gunRect);
      return;
    }
    if (isNaN(canvasRect.left) || isNaN(canvasRect.top) || canvasRect.width === 0 || canvasRect.height === 0) {
        console.warn("Gun.jsx: Nevaljan canvasRect", canvasRect);
        return;
    }


    const gunCenterXonCanvas = gunRect.left + gunRect.width / 2 - canvasRect.left;
    const gunCenterYonCanvas = gunRect.top + gunRect.height / 2 - canvasRect.top;
    
    const currentRotationRad = (typeof rotation === "number" ? rotation : rotation.get?.() ?? 0) * (Math.PI / 180);
    

    const barrelOffset = gunRect.height / 2; 

 
    const angleForBulletPos = currentRotationRad; 

    const bulletX = gunCenterXonCanvas - Math.sin(-angleForBulletPos) * (gunRect.width / 2); 
    const bulletY = gunCenterYonCanvas - Math.cos(-angleForBulletPos) * barrelOffset;

    if (isNaN(bulletX) || isNaN(bulletY)) {
      console.warn("Gun.jsx: Metak (pozicija) nije validan – preskačem");
      return;
    }

    const bullet = {
      id: crypto.randomUUID(),
      position: { x: bulletX , y: bulletY }, // Uklonjen hardkodirani offset +2.5, dodaj poslje
      rotation: typeof rotation === "number" ? rotation : rotation.get?.() ?? 0,
      speed: bulletSpeed,
    };

    onShoot(bullet);
  }, [isReady, canvasRef, rotation, bulletSpeed, onShoot, attackPoints]); 


  useEffect(() => {

    if (isReady) return;

    let rafId;
    const checkReady = () => {
      const el = gunRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setIsReady(true); 
        } else {
          rafId = requestAnimationFrame(checkReady);
        }
      } else {
        rafId = requestAnimationFrame(checkReady);
      }
    };


    const initialTimeoutId = setTimeout(() => {

        rafId = requestAnimationFrame(checkReady);
    }, 50); 

    return () => {
      clearTimeout(initialTimeoutId);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isReady]); 


  function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
      ref.current = value;
    }, [value]); 
    return ref.current;
  }
  
  const prevSignal = usePrevious(shootSignal);


  useEffect(() => {
    if (isReady && prevSignal !== undefined && shootSignal !== prevSignal && shootSignal > 0) {
      handleShoot();
    }
  }, [shootSignal, prevSignal, isReady, handleShoot]); 

  // --- Styles ---
  const gunStyle = useMemo(
    () => ({
      boxShadow: boxShadow,
      borderTop: `${(attackPoints || 0) / 10 - 2}px solid #00224D`, 
      height: `${40 + ((bulletSpeed || 1) - 1) * 10}px`,
    }),
    [boxShadow, attackPoints, bulletSpeed]
  );

  const camodifierStyle = useMemo(
    () => ({
      border: `${(CAModifier || 0) * 5}px solid #F93827`, 
    }),
    [CAModifier]
  );

  const attackSpeedStyle = useMemo(
    () => ({
      borderBottom: `${
        ((attackSpeed || 1) - 1) * 10 + Math.floor((attackSpeed || 1) / 1.1) * 20
      }px solid #FFEB00`, 
    }),
    [attackSpeed]
  );

  return (
    <motion.div className="Gun" ref={gunRef} style={gunStyle}>
      <div className="Gun-CAModifier" style={camodifierStyle}></div>
      <div className="Gun-attackSpeed" style={attackSpeedStyle}></div>
    </motion.div>
  );
};

export default React.memo(Gun); 