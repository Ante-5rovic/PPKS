// --- START OF FILE Bullet.jsx ---
import React, { useRef, useEffect, useState } from "react";
import { useAnimationFrame, motion } from "framer-motion";
import "./bullet.scss";

const checkRectCollision = (rect1, rect2) => {
  if (!rect1 || !rect2) return false;
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
};

const Bullet = ({ bulletData, onRemove, bounds, characterCollisionZones }) => {
  const {
    id,
    startPositionData, 
    initialRotation, 
    bulletSpeedStat, 
    isOpponentBullet,
  } = bulletData;

  const bulletSize = 12;
  const bulletBaseSpeedFactor = 3;

  const bulletRef = useRef(null);
  const positionRef = useRef({
    x: startPositionData.x,
    y: startPositionData.y,
  });

  const angleOffset = -90;
  const angle = (initialRotation + angleOffset) * (Math.PI / 180);
  const dx = Math.cos(angle) * (bulletSpeedStat || 1.0) * bulletBaseSpeedFactor;
  const dy = Math.sin(angle) * (bulletSpeedStat || 1.0) * bulletBaseSpeedFactor;

  const [isHidden, setIsHidden] = useState(true);
  useEffect(() => {
    const timeoutId = setTimeout(() => setIsHidden(false), 1);
    return () => clearTimeout(timeoutId);
  }, []);

  useAnimationFrame((t, delta) => {
    if (!bounds) return;

    const deltaFactor = delta / 16.67;
    positionRef.current.x += dx * deltaFactor;
    positionRef.current.y += dy * deltaFactor;

    const bulletEl = bulletRef.current;
    if (!bulletEl) return;

    bulletEl.style.left = `${positionRef.current.x}px`;
    bulletEl.style.top = `${positionRef.current.y}px`;

    const half = bulletSize / 2;
    const currentCenterX = positionRef.current.x + half;
    const currentCenterY = positionRef.current.y + half;
    const impactPosition = { x: currentCenterX, y: currentCenterY };

    const bulletCurrentRect = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      width: bulletSize,
      height: bulletSize,
    };

    if (isOpponentBullet && characterCollisionZones) {
      let hitTargetType = null;
      if (
        characterCollisionZones.topShieldZone &&
        checkRectCollision(
          bulletCurrentRect,
          characterCollisionZones.topShieldZone
        )
      ) {
        hitTargetType = "topShield";
      } else if (
        characterCollisionZones.leftShieldZone &&
        checkRectCollision(
          bulletCurrentRect,
          characterCollisionZones.leftShieldZone
        )
      ) {
        hitTargetType = "leftShield";
      } else if (
        characterCollisionZones.rightShieldZone &&
        checkRectCollision(
          bulletCurrentRect,
          characterCollisionZones.rightShieldZone
        )
      ) {
        hitTargetType = "rightShield";
      } else if (
        characterCollisionZones.bodyZone &&
        checkRectCollision(bulletCurrentRect, characterCollisionZones.bodyZone)
      ) {
        hitTargetType = "body";
      }

      if (hitTargetType) {
        onRemove(
          impactPosition,
          false ,
          bulletData,
          hitTargetType
        );
        return;
      }
    }

    let shouldRemove = false;
    let hitTopEdge = false;
    if (!isOpponentBullet && currentCenterY - half < bounds.top) {
      shouldRemove = true;
      hitTopEdge = true;
    } else if (
      currentCenterX + half < bounds.left ||
      currentCenterX - half > bounds.width ||
      currentCenterY - half > bounds.height ||
      (isOpponentBullet && currentCenterY + half < bounds.top) 
    ) {
      shouldRemove = true;
    }

    if (shouldRemove) {
      onRemove(impactPosition, hitTopEdge, bulletData, null );
    }
  });

  return (
    <motion.div
      className="Bullet"
      ref={bulletRef}
      style={{
        width: `${bulletSize}px`,
        height: `${bulletSize}px`,
        position: "absolute",
        opacity: isHidden ? 0 : 1,
      }}
    />
  );
};

export default React.memo(Bullet);
// --- END OF FILE Bullet.jsx ---
