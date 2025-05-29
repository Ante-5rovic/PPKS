import React from 'react';
import "./healthbar.scss"

const interpolateColor = (healthPercentage) => {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));


  const healthyColor = { r: 123, g: 211, b: 234 }; // #7bd3ea


  const unhealthyColor = { r: 255, g: 138, b: 138 }; // #ff8a8a


  const t = clamp(healthPercentage, 0, 100) / 100;

  const r = Math.round(unhealthyColor.r + (healthyColor.r - unhealthyColor.r) * t);
  const g = Math.round(unhealthyColor.g + (healthyColor.g - unhealthyColor.g) * t);
  const b = Math.round(unhealthyColor.b + (healthyColor.b - unhealthyColor.b) * t);

  const toHex = (value) => value.toString(16).padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const HealthBar = ({ health, maxHealth }) => {
  const healthPercentage = (health / maxHealth) * 100;
  const barColor = interpolateColor(healthPercentage);

  return (
    <div className="HealthBar">
      <div
        className="HealthBar-progres"
        style={{
          width: `${healthPercentage}%`,
          backgroundColor: barColor,
        }}
      />
    </div>
  );
};

export default HealthBar;
