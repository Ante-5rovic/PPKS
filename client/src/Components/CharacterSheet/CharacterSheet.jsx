import React, { useRef, useEffect, useState } from "react";
import Character from "../Character/Character";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  AnimatePresence,
} from "framer-motion";
import "./characterSheet.scss";
import Bullet from "../Character/Gun/Bullet/Bullet";
import ParticleExplosion from "../Character/Gun/ParticleExplosion/ParticleExplosion";

const CharacterSheet = ({
  healthPoints, 
  topShield,    
  sideShield,   
  guns,
  dodgeChance,
  armor,
  attackPoints,
  CAModifier,
  attackSpeed,
  bulletSpeed,
  movemantSpeed,
  bodyColor,
  ammunition, 
}) => {
  const MotionCharacter = motion.create(Character);
  const characterRef = useRef(null);

  //------------------------------------------------------------
  // LOGIKA ZA METKE
  const gameMode = false; 
  const [currentLocalAmmo, setCurrentLocalAmmo] = useState(ammunition); 
  const lastProcessedShootSignal = useRef(0); 

  useEffect(() => {
    setCurrentLocalAmmo(ammunition); 
  }, [ammunition]);

  const [bullets, setBullets] = useState([]);
  const [recoil, setRecoil] = useState(0);
  const recoilUpRef = useRef(null);
  const recoilDownRef = useRef(null);
  const recoilValueRef = useRef(0);

  const handleShoot = (bulletDataFromGun, shootSignalValue) => {
    if (shootSignalValue !== lastProcessedShootSignal.current) {
      if (currentLocalAmmo > 0) {
        setCurrentLocalAmmo((prev) => prev - 1); 
        lastProcessedShootSignal.current = shootSignalValue; 
      } else {
        console.log("Nema više metaka!");
        return; 
      }
    }

    // Add bullet to display
    const bulletToAdd = {
      id: crypto.randomUUID(),
      startPositionData: bulletDataFromGun.position,
      initialRotation: bulletDataFromGun.rotation,
      bulletSpeedStat: bulletDataFromGun.speed,
    };
    setBullets((prev) => [...prev, bulletToAdd]);
    startRecoil();
  };

  const startRecoil = () => {
    if (recoilUpRef.current) {
      clearInterval(recoilUpRef.current);
      recoilUpRef.current = null;
    }
    if (recoilDownRef.current) {
      clearInterval(recoilDownRef.current);
      recoilDownRef.current = null;
    }

    let recoilValue = recoilValueRef.current;
    const recoilMax = 5;
    const recoilDuration = 100;
    const steps = 5;
    const interval = recoilDuration / steps;

    // START UP
    recoilUpRef.current = setInterval(() => {
      recoilValue += recoilMax / steps;
      recoilValue = Math.min(recoilValue, recoilMax);
      recoilValueRef.current = recoilValue;
      setRecoil(recoilValue);

      if (recoilValue >= recoilMax) {
        clearInterval(recoilUpRef.current);
        recoilUpRef.current = null;

        // START DOWN
        recoilDownRef.current = setInterval(() => {
          recoilValue -= recoilMax / steps;
          recoilValue = Math.max(recoilValue, 0);
          recoilValueRef.current = recoilValue;
          setRecoil(recoilValue);

          if (recoilValue <= 0) {
            clearInterval(recoilDownRef.current);
            recoilDownRef.current = null;
          }
        }, interval);
      }
    }, interval);
  };

  const [explosions, setExplosions] = useState([]);

  const removeBullet = (bulletId, impactPosition) => {
    setBullets((prev) => prev.filter((b) => b.id !== bulletId));
    if (impactPosition) {
        const explosion = {
            id: Date.now() + Math.random(),
            position: impactPosition,
        };
        setExplosions((prev) => {
            const newList = [...prev, explosion];
            if (newList.length > 30) newList.shift();
            return newList;
        });
    }
  };


  const canvasRef = useRef(null);
  const [playArea, setPlayArea] = useState(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setPlayArea({
            left: 0,
            top: 0,
            width: rect.width,
            height: rect.height,
          });
        }
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, []);


  //------------------------------------------------------------

  // 1. Kreiraj rotaciju kao motion value
  const rotate = useMotionValue(0);
  const rotateInverse = useTransform(rotate, (r) => -r);

  // 2. Shadow offseti ovisni o kutu
  const shadowX = useTransform(
    rotate,
    (r) => `${Math.sin((r * Math.PI) / 180) * 10}px`
  );
  const shadowY = useTransform(
    rotate,
    (r) => `${Math.cos((r * Math.PI) / 180) * 10}px`
  );
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([x, y]) => `${x} ${y} 15px rgba(0, 0, 0, 0.3)`
  );

  // 3. Ručna animacija rotacije kroz vrijeme
  useAnimationFrame((t) => {
    rotate.set((t / 2000) * 36); // 36 deg/sec (sporija rotacija)
  });

  // 4. Transform origin hardcoded kao prije
  const transformOrigin = `50% ${
    (70 + healthPoints / 30) / 2 + 
    40 +
    (bulletSpeed - 1) * 10 +
    sideShield * 1.5 
  }px`;

  const categoryNames = {
    healthPoints: "❤️ HEALTH POINTS: ",
    topShield: "🛡️ TOP SHIELD: ",
    sideShield: "🛡️➡️ SIDE SHIELDS: ",
    guns: "🔫 GUNS: ",
    dodgeChance: "💨 DODGE CHANCE: ",
    armor: "🦾 ARMOR: ",
    attackPoints: "⚔️ ATTACK DMG: ",
    CAModifier: "🎯 CHARGE ATTACK MODIFIER: ",
    attackSpeed: "⚡ ATTACK SPEED: ",
    bulletSpeed: "🚀 BULLET SPEED: ",
    movemantSpeed: "🏃‍♂️ MOVEMENT SPEED: ",
    ammunition: "💣 AMMUNITION: ",
  };

  return (
    <div className="CharacterSheet">
      <section className="CharacterSheet-display" ref={canvasRef}>
        <MotionCharacter
          className="CharacterSheet-character"
          ref={characterRef}
          healthPoints={healthPoints} 
          topShield={topShield}      
          sideShield={sideShield}    
          guns={guns}
          dodgeChance={dodgeChance}
          armor={armor}
          attackPoints={attackPoints}
          ammunition={currentLocalAmmo} 
          ammunitionMax={ammunition} 
          CAModifier={CAModifier}
          attackSpeed={attackSpeed}
          bulletSpeed={bulletSpeed}
          movemantSpeed={movemantSpeed}
          bodyColor={bodyColor}
          rotateInverse={rotateInverse}
          rotate={rotate}
          canvasRef={canvasRef}
          onShoot={handleShoot} 
          displayType={gameMode} 
          recoil={recoil}
          style={{
            transformOrigin,
            rotate,
          }}
          boxShadow={boxShadow}

        />
        <div className="CharacterSheet-bulletLayer">
          {playArea && bullets.map((bullet) => {
            if (!bullet.startPositionData) {
                console.error("CharacterSheet: Neispravan metak za renderiranje!", bullet);
                return null;
            }
            return (
              <Bullet
                key={bullet.id}
                bulletData={bullet}
                onRemove={(impactPosition, hitTopEdge, originalBulletData) => {
                  removeBullet(bullet.id, impactPosition);
                }}
                bounds={playArea}
              />
            );
          })}
        </div>
        <AnimatePresence>
          {explosions.map((explosion) => (
            <ParticleExplosion
              key={explosion.id}
              position={explosion.position}
            />
          ))}
        </AnimatePresence>
      </section>

      <section className="CharacterSheet-stats">
        <div className="CharacterSheet-statsBlock">
          <div className="CharacterSheet-statsItem">
            {categoryNames.healthPoints} {healthPoints}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.topShield} {topShield}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.sideShield} {sideShield}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.guns} {guns}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.dodgeChance} {dodgeChance + "%"}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.armor} {armor}
          </div>
        </div>

        <p className="CharacterSheet-separator"></p>

        <div className="CharacterSheet-statsBlock">
          <div className="CharacterSheet-statsItem">
            {categoryNames.attackPoints} {attackPoints}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.ammunition} {ammunition}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.CAModifier} {"x" + parseFloat(CAModifier).toFixed(1)}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.attackSpeed}{" "}
            {"x" + parseFloat(attackSpeed).toFixed(1)}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.bulletSpeed}{" "}
            {"x" + parseFloat(bulletSpeed).toFixed(1)}
          </div>
          <div className="CharacterSheet-statsItem">
            {categoryNames.movemantSpeed}{" "}
            {"x" + parseFloat(movemantSpeed).toFixed(1)}
          </div>
        </div>
      </section>
    </div>
  );
};

export default CharacterSheet;