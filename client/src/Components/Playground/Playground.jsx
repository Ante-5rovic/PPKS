// --- START OF FILE Playground.jsx ---

import React, { useState, useEffect, useRef, useCallback } from "react";
import "./playground.scss";
import HealthBar from "./HealthBar/HealthBar";
import Character from "../../Components/Character/Character";
import Bullet from "../../Components/Character/Gun/Bullet/Bullet";
import ParticleExplosion from "../../Components/Character/Gun/ParticleExplosion/ParticleExplosion";
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  useAnimationFrame,
} from "framer-motion";

const MotionEnabledCharacter = motion(Character);

const Playground = ({
  characterData: initialCharacterData, // Preimenuj da se ne sukobljava s internal stateom
  timeLeftInRound,
  sendEventToServer,
  socketId,
  initialIncomingBullets, // Ovo je niz objekata od servera
  onClearIncomingBullet, // Funkcija za javljanje Online.jsx da je metak obrađen
}) => {
  // Interni state za karakteristike koje se mogu mijenjati tijekom igre (HP, štitovi)
  // Početne vrijednosti se uzimaju iz initialCharacterData
  const [characterStats, setCharacterStats] = useState(initialCharacterData);
  const {
    bodyColor,
    // healthPoints, // Koristit ćemo currentHP
    // topShield,    // Koristit ćemo currentTopShield
    // sideShield,   // Koristit ćemo currentLeft/RightShield
    guns,
    dodgeChance,
    armor,
    attackPoints,
    ammunition, // Max ammo po gunu
    CAModifier,
    attackSpeed,
    bulletSpeed,
    // movemantSpeed, // Koristit ćemo characterStats.movemantSpeed
  } = characterStats; // Destrukturiraj iz internal statea

  const [currentHP, setCurrentHP] = useState(characterStats.healthPoints);
  const [currentTopShield, setCurrentTopShield] = useState(characterStats.topShield);
  const [currentLeftShield, setCurrentLeftShield] = useState(characterStats.sideShield);
  const [currentRightShield, setCurrentRightShield] = useState(characterStats.sideShield);
  const [currentAmmo_Play, setCurrentAmmo_Play] = useState(characterStats.ammunition * characterStats.guns);


  // Ažuriraj internal state ako se prop initialCharacterData promijeni (npr. rekonekcija)
  useEffect(() => {
    setCharacterStats(initialCharacterData);
    setCurrentHP(initialCharacterData.healthPoints);
    setCurrentTopShield(initialCharacterData.topShield);
    setCurrentLeftShield(initialCharacterData.sideShield);
    setCurrentRightShield(initialCharacterData.sideShield);
    setCurrentAmmo_Play(initialCharacterData.ammunition * initialCharacterData.guns);
  }, [initialCharacterData]);


  const playgroundDisplayRef = useRef(null);
  const characterRef = useRef(null);

  const bodySize = 70 + (characterStats.healthPoints || 100) / 30; // Fallback za healthPoints
  const totalCharDimensions = useRef({
    width: bodySize + 2 * ((characterStats.sideShield || 0) * 1.5),
    height:
      bodySize +
      (40 + ((characterStats.bulletSpeed || 1) - 1) * 10) +
      (10 + (characterStats.topShield || 0)) +
      Math.max(0, (characterStats.attackPoints || 0) / 10 - 2),
  });

  const [charPosition, setCharPosition] = useState({ x: 0, y: 0 });
  const charRotation = useMotionValue(0);
  const charRotationInverse = useTransform(charRotation, (r) => -r);
  const ROTATION_LERP_FACTOR = 0.08;
  const targetCharRotation = useRef(0);
  const shadowX = useTransform(
    charRotation,
    (r) => `${Math.sin((r * Math.PI) / 180) * 10}px`
  );
  const shadowY = useTransform(
    charRotation,
    (r) => `${Math.cos((r * Math.PI) / 180) * 10}px`
  );
  const boxShadow = useTransform(
    [shadowX, shadowY],
    ([x, y]) => `${x} ${y} 15px rgba(0, 0, 0, 0.3)`
  );
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const [bullets, setBullets] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [playAreaBounds, setPlayAreaBounds] = useState(null);

  const BORDER_LEFT_PG_DISPLAY = 0;
  const BORDER_RIGHT_PG_DISPLAY = 0;
  const BORDER_TOP_PG_DISPLAY = 0;
  const BORDER_BOTTOM_PG_DISPLAY = 0;

  const HARDCODED_WIDTH_OF_PLAYARIA = 900;
  const HARDCODED_HEIGHT_OF_PLAYARIA = 500;

  const [recoil, setRecoil] = useState(0);
  const recoilUpRef = useRef(null);
  const recoilDownRef = useRef(null);
  const recoilValueRef = useRef(0);

  const charVelocity = useRef({ x: 0, y: 0 });
  const STOP_THRESHOLD = 0.1;
  const ACCELERATION = 0.5;
  const MAX_SPEED = 7;
  const FRICTION = 0.9;

  const transformOrigin = `50% ${
    (70 + (characterStats.healthPoints || 100) / 30) / 2 +
    40 +
    ((characterStats.bulletSpeed || 1) - 1) * 10 +
    (characterStats.sideShield || 0) * 1.5
  }px`;

  useEffect(() => {
    if (characterRef.current) {
      const attemptUpdateDims = () => {
        if (characterRef.current) {
          const width = characterRef.current.offsetWidth;
          const height = characterRef.current.offsetHeight;
          if (width > 0 && height > 0) {
            if (
              totalCharDimensions.current.width !== width ||
              totalCharDimensions.current.height !== height
            ) {
              totalCharDimensions.current = { width, height };
            }
          }
        }
      };
      attemptUpdateDims();
      const timeoutId = setTimeout(attemptUpdateDims, 50);
      const rafId = requestAnimationFrame(attemptUpdateDims);
      return () => {
        clearTimeout(timeoutId);
        cancelAnimationFrame(rafId);
      };
    }
  }, [
    characterStats.healthPoints,
    characterStats.sideShield,
    characterStats.topShield,
    characterStats.bulletSpeed,
    characterStats.attackPoints,
  ]);

  useEffect(() => {
    if (playgroundDisplayRef.current) {
      const rect = playgroundDisplayRef.current.getBoundingClientRect();
      const innerWidth = HARDCODED_WIDTH_OF_PLAYARIA;
      const innerHeight = HARDCODED_HEIGHT_OF_PLAYARIA;

      setPlayAreaBounds({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        innerWidth: innerWidth,
        innerHeight: innerHeight,
      });

      setCharPosition({
        x: innerWidth / 2 - totalCharDimensions.current.width / 2,
        y: innerHeight - totalCharDimensions.current.height,
      });
    }
  }, [totalCharDimensions.current.width, totalCharDimensions.current.height]);

  const pressedKeys = useRef({});

  useEffect(() => {
    const handleKeyDown = (e) => {
      pressedKeys.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e) => {
      pressedKeys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useAnimationFrame((time, delta) => {
    if (
      !playAreaBounds ||
      !totalCharDimensions.current.width ||
      !totalCharDimensions.current.height
    ) {
      return;
    }

    const deltaFactor = Math.min(2, delta / 16.67); // Ograniči deltaFactor da spriječi prevelike skokove
    const currentMoveSpeedStat = characterStats.movemantSpeed || 1.0;

    if (pressedKeys.current["w"])
      charVelocity.current.y -= ACCELERATION * currentMoveSpeedStat * deltaFactor;
    if (pressedKeys.current["s"])
      charVelocity.current.y += ACCELERATION * currentMoveSpeedStat * deltaFactor;
    if (pressedKeys.current["a"])
      charVelocity.current.x -= ACCELERATION * currentMoveSpeedStat * deltaFactor;
    if (pressedKeys.current["d"])
      charVelocity.current.x += ACCELERATION * currentMoveSpeedStat * deltaFactor;

    if (!pressedKeys.current["w"] && !pressedKeys.current["s"]) {
      charVelocity.current.y *= Math.pow(FRICTION, deltaFactor);
    }
    if (!pressedKeys.current["a"] && !pressedKeys.current["d"]) {
      charVelocity.current.x *= Math.pow(FRICTION, deltaFactor);
    }

    charVelocity.current.x = Math.max(
      -MAX_SPEED * currentMoveSpeedStat,
      Math.min(charVelocity.current.x, MAX_SPEED * currentMoveSpeedStat)
    );
    charVelocity.current.y = Math.max(
      -MAX_SPEED * currentMoveSpeedStat,
      Math.min(charVelocity.current.y, MAX_SPEED * currentMoveSpeedStat)
    );

    if (Math.abs(charVelocity.current.x) < STOP_THRESHOLD && !pressedKeys.current["a"] && !pressedKeys.current["d"]) {
      charVelocity.current.x = 0;
    }
    if (Math.abs(charVelocity.current.y) < STOP_THRESHOLD && !pressedKeys.current["w"] && !pressedKeys.current["s"]) {
      charVelocity.current.y = 0;
    }

    let { x: currentX_leftEdge, y: currentY_topEdge } = charPosition;
    let newX_leftEdge = currentX_leftEdge + charVelocity.current.x * deltaFactor;
    let newY_topEdge = currentY_topEdge + charVelocity.current.y * deltaFactor;

    const tcWidth = totalCharDimensions.current.width;
    const tcHeight = totalCharDimensions.current.height;
    const minX = -BORDER_LEFT_PG_DISPLAY + 2;
    const maxX = playAreaBounds.innerWidth - tcWidth - BORDER_RIGHT_PG_DISPLAY;
    const minY_forTopEdge = 0;
    const maxY_forTopEdge = playAreaBounds.innerHeight - tcHeight;

    newX_leftEdge = Math.max(minX, Math.min(newX_leftEdge, maxX));
    newY_topEdge = Math.max(minY_forTopEdge, Math.min(newY_topEdge, maxY_forTopEdge));

    if ((newX_leftEdge === minX && charVelocity.current.x < 0) || (newX_leftEdge === maxX && charVelocity.current.x > 0)) {
      charVelocity.current.x = 0;
    }
    if ((newY_topEdge === minY_forTopEdge && charVelocity.current.y < 0) || (newY_topEdge === maxY_forTopEdge && charVelocity.current.y > 0)) {
      charVelocity.current.y = 0;
    }

    const overallCharWidth = totalCharDimensions.current.width;
    const overallCharHeight = totalCharDimensions.current.height;
    const charCenterX_RelativeToContent = newX_leftEdge + overallCharWidth / 2;
    const charCenterY_RelativeToContent = newY_topEdge + overallCharHeight / 2;
    const deltaX_mouse = lastMousePosition.current.x - charCenterX_RelativeToContent;
    const deltaY_mouse = lastMousePosition.current.y - charCenterY_RelativeToContent;
    let angleToMouse = Math.atan2(deltaY_mouse, deltaX_mouse) * (180 / Math.PI);
    angleToMouse += 90;
    targetCharRotation.current = angleToMouse;

    let currentActualAngle = charRotation.get();
    let desiredTargetAngle = targetCharRotation.current;
    let angleDifference = desiredTargetAngle - currentActualAngle;
    while (angleDifference < -180) angleDifference += 360;
    while (angleDifference > 180) angleDifference -= 360;
    const lerpAmount = 1 - Math.pow(1 - ROTATION_LERP_FACTOR, deltaFactor);
    let newActualAngle = currentActualAngle + angleDifference * lerpAmount;
    charRotation.set(newActualAngle);

    setCharPosition({ x: newX_leftEdge, y: newY_topEdge });
  });

  useEffect(() => {
    const displayEl = playgroundDisplayRef.current;
    if (!displayEl || !playAreaBounds || typeof playAreaBounds.left === "undefined" || typeof playAreaBounds.top === "undefined") {
      return;
    }
    const handleMouseMove = (e) => {
      const mouseX_RelativeToContent = e.clientX - playAreaBounds.left - BORDER_LEFT_PG_DISPLAY;
      const mouseY_RelativeToContent = e.clientY - playAreaBounds.top - BORDER_TOP_PG_DISPLAY;
      lastMousePosition.current = { x: mouseX_RelativeToContent, y: mouseY_RelativeToContent };
    };
    displayEl.addEventListener("mousemove", handleMouseMove);
    return () => {
      if (displayEl) {
        displayEl.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, [playAreaBounds, BORDER_LEFT_PG_DISPLAY, BORDER_TOP_PG_DISPLAY]);


  const startRecoil = useCallback(() => {
    if (recoilUpRef.current) clearInterval(recoilUpRef.current);
    if (recoilDownRef.current) clearInterval(recoilDownRef.current);

    const recoilMax = 10;
    const recoilDuration = 180;
    const steps = 8;
    const intervalTime = recoilDuration / (steps * 2);
    let currentRecoilValue = recoilValueRef.current;

    recoilUpRef.current = setInterval(() => {
      currentRecoilValue += recoilMax / steps;
      currentRecoilValue = Math.min(currentRecoilValue, recoilMax);
      recoilValueRef.current = currentRecoilValue;
      setRecoil(currentRecoilValue);
      if (currentRecoilValue >= recoilMax) {
        clearInterval(recoilUpRef.current);
        recoilUpRef.current = null;
        recoilDownRef.current = setInterval(() => {
          currentRecoilValue -= recoilMax / steps;
          currentRecoilValue = Math.max(currentRecoilValue, 0);
          recoilValueRef.current = currentRecoilValue;
          setRecoil(currentRecoilValue);
          if (currentRecoilValue <= 0) {
            clearInterval(recoilDownRef.current);
            recoilDownRef.current = null;
            recoilValueRef.current = 0;
          }
        }, intervalTime);
      }
    }, intervalTime);
  }, []); 

  const handleShootFromCharacter = useCallback(
    (newBulletDataFromGun) => {
      if (currentAmmo_Play > 0) {
        const bulletToAdd = {
          id: crypto.randomUUID(),
          startPositionData: {
            x: newBulletDataFromGun.position.x - 14,
            y: newBulletDataFromGun.position.y - 7,
          },
          initialRotation: newBulletDataFromGun.rotation,
          bulletSpeedStat: newBulletDataFromGun.speed, 
          attackPoints: characterStats.attackPoints, 
          isOpponentBullet: false,
          originalShooterId: socketId, 
        };
        setBullets((prev) => [...prev, bulletToAdd]);
        setCurrentAmmo_Play((prev) => prev - 1);
        startRecoil();
      }
    },
    [currentAmmo_Play, characterStats.attackPoints, startRecoil, socketId] 
  );

  useEffect(() => {
    return () => {
      if (recoilUpRef.current) clearInterval(recoilUpRef.current);
      if (recoilDownRef.current) clearInterval(recoilDownRef.current);
    };
  }, []);

  const removeBullet = useCallback(
    (
      bulletId,
      impactPosition,
      hitTopEdge = false,
      originalBulletData = null,
      hitTargetType = null
    ) => {
      if (
        hitTopEdge &&
        impactPosition &&
        originalBulletData &&
        !originalBulletData.isOpponentBullet &&
        sendEventToServer &&
        socketId 
      ) {
        console.log(
          `PLAYGROUND (${socketId}): Moj metak (ID: ${bulletId}) pogodio gornji rub na X: ${impactPosition.x}, šaljem serveru.`
        );
        const bulletPayloadForServer = {
          originalShooterId: socketId, 
          xPosition: impactPosition.x,
          bulletRotation: originalBulletData.initialRotation,
          bulletStats: {
            speed: originalBulletData.bulletSpeedStat,
            damage: originalBulletData.attackPoints,
          },
          bulletId: originalBulletData.id,
        };
        sendEventToServer("bullet_fired_at_opponent", bulletPayloadForServer);
        setBullets((prev) => prev.filter((b) => b.id !== bulletId)); 
        return; 
      }

      if (
        originalBulletData &&
        originalBulletData.isOpponentBullet &&
        hitTargetType &&
        impactPosition
      ) {
        
        let damageAppliedThisHit = false;
        let actualDamageDealt = 0;
        let whatWasHit = hitTargetType;
        let hpBeforeHit = currentHP; 

        const dodgeRoll = Math.random() * 100;
        if (dodgeRoll < (characterStats.dodgeChance || 0)) {
          whatWasHit = 'dodged';
        } else {
          switch (hitTargetType) {
            case "topShield":
              if (currentTopShield > 0) {
                setCurrentTopShield((prev) => Math.max(0, prev - 1));
                damageAppliedThisHit = true;
              } else {
                whatWasHit = "body";
              }
              break;
            case "leftShield":
              if (currentLeftShield > 0) {
                setCurrentLeftShield((prev) => Math.max(0, prev - 1));
                damageAppliedThisHit = true;
              } else {
                whatWasHit = "body";
              }
              break;
            case "rightShield":
              if (currentRightShield > 0) {
                setCurrentRightShield((prev) => Math.max(0, prev - 1));
                damageAppliedThisHit = true;
              } else {
                whatWasHit = "body";
              }
              break;
          }

          if (whatWasHit === "body") {
            let damage = originalBulletData.attackPoints || 0; 
            const damageReduction = Math.min((characterStats.armor || 0) / 100, 0.8);
            damage = Math.max(1, Math.round(damage * (1 - damageReduction)));
            actualDamageDealt = damage;
            setCurrentHP((prevHP) => Math.max(0, prevHP - actualDamageDealt));
            damageAppliedThisHit = true;
          }
        }

        const explosion = { id: crypto.randomUUID(), position: impactPosition };
        setExplosions((prev) => [...prev.slice(-29), explosion]);

        if (sendEventToServer && socketId) {
          const hitEventData = {
            bulletId: originalBulletData.id,
            targetPlayerId: socketId, 
            shooterPlayerId: originalBulletData.originalShooterId, 
            hitType: whatWasHit,
            damageDealt: actualDamageDealt,
          };
          sendEventToServer('bullet_hit_player', hitEventData);
        }
        setBullets((prev) => prev.filter((b) => b.id !== bulletId)); 
        return; 
      }

      setBullets((prev) => prev.filter((b) => b.id !== bulletId));
      if (impactPosition && !hitTopEdge) { 
        const explosion = { id: crypto.randomUUID(), position: impactPosition };
        setExplosions((prev) => [...prev.slice(-29), explosion]);
      }
    },
    [
      sendEventToServer,
      socketId,
      characterStats, 
      currentHP,
      currentTopShield,
      currentLeftShield,
      currentRightShield,
      setBullets, 
      setExplosions,
      setCurrentHP,
      setCurrentTopShield,
      setCurrentLeftShield,
      setCurrentRightShield,
    ]
  );

  const ammoRegenTimeoutRef = useRef(null);
  const ammoRegenIntervalRef = useRef(null);
  
  useEffect(() => {
    const maxTotalAmmo = (characterStats.ammunition || 0) * (characterStats.guns || 1);
    if (ammoRegenTimeoutRef.current) clearTimeout(ammoRegenTimeoutRef.current);
    if (ammoRegenIntervalRef.current) clearInterval(ammoRegenIntervalRef.current);

    if (currentAmmo_Play < maxTotalAmmo) {
      ammoRegenTimeoutRef.current = setTimeout(() => {
        ammoRegenIntervalRef.current = setInterval(() => {
          setCurrentAmmo_Play((prevAmmo) => {
            if (prevAmmo < maxTotalAmmo) {
              return Math.min(maxTotalAmmo, prevAmmo + (characterStats.guns || 1));
            } else {
              clearInterval(ammoRegenIntervalRef.current);
              return prevAmmo;
            }
          });
        }, 100);
      }, 150);
    }
    return () => {
      if (ammoRegenTimeoutRef.current) clearTimeout(ammoRegenTimeoutRef.current);
      if (ammoRegenIntervalRef.current) clearInterval(ammoRegenIntervalRef.current);
    };
  }, [currentAmmo_Play, characterStats.ammunition, characterStats.guns]);

  const getCharacterCollisionZones = useCallback(() => {
    if (!totalCharDimensions.current.width || !playAreaBounds) return null;

    const charX = charPosition.x;
    const charY = charPosition.y;
    
    const currentBodySize = 70 + (characterStats.healthPoints || 100) / 30;
    const approxGunActualHeight = 40 + ((characterStats.bulletSpeed || 1) - 1) * 10 + Math.max(0, (characterStats.attackPoints || 0) / 10 - 2);
    const approxGunWrapperTranslateY = 10 + currentTopShield + recoil;
    const bodyRelativeOffsetY = approxGunActualHeight + approxGunWrapperTranslateY;
    const bodyRelativeOffsetX = (characterStats.sideShield || 0) * 1.5;

    const bodyRect = {
      x: charX + bodyRelativeOffsetX,
      y: charY + bodyRelativeOffsetY,
      width: currentBodySize,
      height: currentBodySize,
    };

    const topShieldEffectiveThickness = 5 + currentTopShield * 2;
    const topShieldZone = currentTopShield > 0 ? {
      x: bodyRect.x, y: bodyRect.y - topShieldEffectiveThickness,
      width: currentBodySize, height: topShieldEffectiveThickness,
    } : null;

    const sideShieldEffectiveThickness = 5 + (characterStats.sideShield || 0) * 2;
    const leftShieldZone = currentLeftShield > 0 ? {
      x: bodyRect.x - sideShieldEffectiveThickness, y: bodyRect.y,
      width: sideShieldEffectiveThickness, height: currentBodySize,
    } : null;

    const rightShieldZone = currentRightShield > 0 ? {
      x: bodyRect.x + currentBodySize, y: bodyRect.y,
      width: sideShieldEffectiveThickness, height: currentBodySize,
    } : null;

    return { bodyZone: bodyRect, topShieldZone, leftShieldZone, rightShieldZone };
  }, [
    charPosition, totalCharDimensions.current, characterStats, 
    currentTopShield, currentLeftShield, currentRightShield, recoil, playAreaBounds 
  ]);

  const characterCollisionZones = getCharacterCollisionZones();

  useEffect(() => {
    if (currentHP <= 0 && socketId && sendEventToServer) {
      const hasAlreadySentDefeat = localStorage.getItem(`defeat_sent_${socketId}`);
      if (!hasAlreadySentDefeat) {
        console.log(`PLAYGROUND (${socketId}): HP pao na 0! Javljam serveru.`);
        sendEventToServer("player_defeated", { playerId: socketId });
        localStorage.setItem(`defeat_sent_${socketId}`, 'true'); 
        setTimeout(() => localStorage.removeItem(`defeat_sent_${socketId}`), 5000);
      }
    }
  }, [currentHP, socketId, sendEventToServer]);


  useEffect(() => {
    if (initialIncomingBullets && initialIncomingBullets.length > 0 && playAreaBounds) {
      const bulletsToActuallyAdd = [];
      initialIncomingBullets.forEach((bulletDataFromServer) => {
        let incomingX = bulletDataFromServer.xPosition;
        const newIncomingBullet = {
          id: bulletDataFromServer.bulletId || crypto.randomUUID(), 
          startPositionData: {
            x: incomingX,
            y: 5, 
          },
          initialRotation: bulletDataFromServer.bulletRotation + 180, 
          bulletSpeedStat: bulletDataFromServer.bulletStats.speed,
          isOpponentBullet: true,
          attackPoints: bulletDataFromServer.bulletStats.damage,
          originalShooterId: bulletDataFromServer.originalShooterId,
        };
        bulletsToActuallyAdd.push(newIncomingBullet);
        if (onClearIncomingBullet) {
          onClearIncomingBullet(newIncomingBullet.id); 
        }
      });
      if (bulletsToActuallyAdd.length > 0) {
        setBullets((prev) => [...prev, ...bulletsToActuallyAdd]);
      }
    }
  }, [initialIncomingBullets, onClearIncomingBullet, playAreaBounds, socketId]);

  return (
    <div className="PgImmageWrap">
      <div className="Playground">
        <div className="Playground-upperPart">
          <section className="Playground-statsLeft Playground-statsDisplay">
            <h1 className="Playground-statsTitle">BULLETS</h1>
            <div className="Playground-bulletWrap">
              {Array.from({ length: Math.max(0, Math.floor(currentAmmo_Play / (characterStats.guns || 1))) }).map((_, index) => (
                <div key={index} className="Playground-bulletIndicator" style={{ backgroundColor: characterStats.bodyColor }}></div>
              ))}
              {Array.from({ length: Math.max(0, (characterStats.ammunition || 0) - Math.floor(currentAmmo_Play / (characterStats.guns || 1))) }).map((_, index) => (
                <div key={index} className="Playground-bulletIndicator Playground-bulletIndicator--empty"></div>
              ))}
            </div>
          </section>

          <section className="Playground-displayWrap">
            <div className="Playground-display" ref={playgroundDisplayRef} style={{ position: "relative" }}>
              {playAreaBounds && (
                <>
                  <MotionEnabledCharacter
                    ref={characterRef}
                    healthPoints={characterStats.healthPoints} 
                    topShield={currentTopShield} 
                    sideShield={currentLeftShield} 
                    guns={characterStats.guns}
                    dodgeChance={characterStats.dodgeChance}
                    armor={characterStats.armor}
                    attackPoints={characterStats.attackPoints}
                    ammunition={Math.floor(currentAmmo_Play / (characterStats.guns || 1))} 
                    ammunitionMax={characterStats.ammunition} 
                    CAModifier={characterStats.CAModifier}
                    attackSpeed={characterStats.attackSpeed}
                    bulletSpeed={characterStats.bulletSpeed}
                    movemantSpeed={characterStats.movemantSpeed}
                    bodyColor={characterStats.bodyColor}
                    rotate={charRotation}
                    rotateInverse={charRotationInverse}
                    displayType={true} 
                    onShoot={handleShootFromCharacter}
                    recoil={recoil}
                    canvasRef={playgroundDisplayRef} 
                    boxShadow={boxShadow}
                    style={{
                      position: "absolute",
                      left: `${charPosition.x + BORDER_LEFT_PG_DISPLAY}px`,
                      top: `${charPosition.y + BORDER_TOP_PG_DISPLAY}px`,
                      rotate: charRotation, 
                      transformOrigin,
                    }}
                  />

                  <div className="Playground-bulletLayer">
                    {bullets.map((bullet) => {
                      if (!bullet || !bullet.startPositionData || typeof bullet.startPositionData.x === "undefined" || typeof bullet.startPositionData.y === "undefined" || typeof bullet.initialRotation === "undefined" || typeof bullet.bulletSpeedStat === "undefined") {
                        console.error("Playground: Neispravan objekt metka za renderiranje!", bullet);
                        return null;
                      }
                      return (
                        <Bullet
                          key={bullet.id}
                          bulletData={bullet}
                          onRemove={(impactPos, hitTop, dataFromBullet, hitType) => {
                            removeBullet(bullet.id, impactPos, hitTop, dataFromBullet, hitType);
                          }}
                          bounds={{
                            left: 0, top: 0,
                            width: playAreaBounds.innerWidth,
                            height: playAreaBounds.innerHeight,
                          }}
                          characterCollisionZones={bullet.isOpponentBullet ? characterCollisionZones : null}
                        />
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {explosions.map((explosion) => (
                      <ParticleExplosion key={explosion.id} position={explosion.position} />
                    ))}
                  </AnimatePresence>
                </>
              )}
            </div>
            <div className="Playground-characterIndicators">
              {Array(6).fill(null).map((_, i) => (
                <div key={i} className="Playground-indicator"></div>
              ))}
            </div>
          </section>

          <section className="Playground-statsRight Playground-statsDisplay">
            <h1 className="Playground-statsTitle">SHIELDS</h1>
            <div className="Playground-shieldBox Playground-shieldBox--shieldTop">
              <p className="Playground-shieldCount">{currentTopShield}</p>
            </div>
            <div className="Playground-shieldBox Playground-shieldBox--shieldLeft">
              <p className="Playground-shieldCount">{currentLeftShield}</p>
            </div>
            <div className="Playground-shieldBox Playground-shieldBox--shieldRight">
              <p className="Playground-shieldCount">{currentRightShield}</p>
            </div>
          </section>
        </div>
        <div className="Playground-lowerPart">
          <div className="Playground-phaseWrap">
            {/* <div className="Playground-phase">PHASE I</div> */}
          </div>
          <div className="Playground-healthWrap">
            <h2 className="Playground-healthEmoji">❤️</h2>
            <div className="Playground-healthBar">
              <HealthBar maxHealth={characterStats.healthPoints || 100} health={currentHP} />
            </div>
            <h2 className="Playground-healthValue">{currentHP}</h2>
          </div>
          <div className="Playground-timeWrap">
            <div className="Playground-time">
                {`${Math.floor(timeLeftInRound / 60)}:${(timeLeftInRound % 60).toString().padStart(2, '0')}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;