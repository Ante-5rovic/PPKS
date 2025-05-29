import React, { useEffect, useState, useMemo,forwardRef  } from "react";
import "./character.scss";
import Gun from "./Gun/Gun";
import { motion } from "framer-motion";

const Character = forwardRef((props,ref) => {
  const {
    canvasRef,
    healthPoints,
    topShield,
    sideShield,
    guns,
    dodgeChance,
    armor,
    attackPoints,
    ammunition,
    ammunitionMax,
    CAModifier,
    attackSpeed,
    bulletSpeed,
    movemantSpeed,
    style,
    boxShadow,
    bodyColor,
    rotate,
    rotateInverse,
    displayType,
    onShoot,
    recoil,
    ...rest
  } = props;

  const [shootSignal, setShootSignal] = useState(0);
  // console.log("🔁 Character render", shootSignal);

  const handleGunShoot = (newBullet) => {
    if (props.onShoot) {
      props.onShoot(newBullet);
    }
  };

  const handleShootAllGuns = () => {
    setShootSignal((prev) => prev + 1);
  };

  useEffect(() => {
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        handleShootAllGuns();
      }
    };

    const handleMouseUp = (e) => {
      if (e.button === 0) {
        handleShootAllGuns();
      }
    };

    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const gunComponents = useMemo(
    () =>
      Array.from({ length: guns }).map((_, index) => (
        <Gun
          key={index}
          boxShadow={boxShadow}
          attackPoints={attackPoints}
          attackSpeed={attackSpeed}
          CAModifier={CAModifier}
          movemantSpeed={movemantSpeed}
          bulletSpeed={bulletSpeed}
          rotation={rotate}
          onShoot={handleGunShoot}
          canvasRef={canvasRef}
          shootSignal={shootSignal}
        />
      )),
    [
      guns,
      boxShadow,
      attackPoints,
      attackSpeed,
      CAModifier,
      movemantSpeed,
      bulletSpeed,
      rotate,
      shootSignal,
    ]
  );

  const gridSize = Math.floor(1 + armor / 5);

  const gridElement = useMemo(
    () =>
      Array.from({ length: gridSize ** 2 }, (_, i) => (
        <div
          key={i}
          className="Character-gridElement"
          style={{
            backgroundColor: bodyColor,
          }}
        ></div>
      )),
    [gridSize, bodyColor]
  );

  // --- Style Calculations ---
  const gunWrapperStyle = useMemo(
    () => ({
      transform: `translateY(${10 + topShield + recoil}px)`,
      margin: `0px ${sideShield * 1.5}px`,
    }),
    [topShield, sideShield,recoil]
  );

  const characterBodySize = 70 + healthPoints / 30;
  const characterBodyStyle = useMemo(
    () => ({
      width: `${characterBodySize}px`,
      height: `${characterBodySize}px`,
      borderTop: `${topShield * 1.5}px solid transparent`,
      borderLeft: `${sideShield * 1.5}px solid transparent`,
      borderRight: `${sideShield * 1.5}px solid transparent`,
      borderRadius: `${5 + dodgeChance}px`,
      boxShadow: boxShadow,
      backgroundColor: bodyColor,
      gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
      gridTemplateRows: `repeat(${gridSize}, 1fr)`,
    }),
    [
      characterBodySize,
      topShield,
      sideShield,
      dodgeChance,
      boxShadow,
      bodyColor,
      gridSize,
    ]
  );

  const ammoStyle = useMemo(
    () => ({
      rotate: rotateInverse,
      backgroundColor: bodyColor,
    }),
    [rotateInverse, bodyColor]
  );

  return (
    <div className="Character" style={style} {...rest} ref={ref}>
      <div className="Character-guns" style={gunWrapperStyle}>
        {gunComponents}
      </div>
      <motion.div className="Character-body" style={characterBodyStyle}>
        <div className="Character-amunitionWrap">
          <motion.h1 className="Character-amunition" style={ammoStyle}>
            {displayType ? ammunition : ammunitionMax}
          </motion.h1>
        </div>
        {gridElement}
      </motion.div>
    </div>
  );
});

export default Character;
