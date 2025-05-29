// StateComponent.jsx
import React, { useState, useEffect } from "react";
import { IoIosRemoveCircle, IoIosAddCircle } from "react-icons/io";
import "./stateComponent.scss";

const StateComponent = ({
  title,
  n_levels,
  description,
  sendDataToParent,
  coins,
  coinCost,
  sendPurchaseToParent,
  currency,
  curentStat,
  initialLevel = 0, 
  statName,
}) => {
  const [currentPurchasedLevels, setCurrentPurchasedLevels] = useState(initialLevel);


  useEffect(() => {

    if (initialLevel !== currentPurchasedLevels) {
        setCurrentPurchasedLevels(initialLevel);
    }
  }, [initialLevel]); // OVISI SAMO O initialLevel

 useEffect(() => {
    if (sendDataToParent) {
        sendDataToParent(currentPurchasedLevels, statName);
    }
  }, [currentPurchasedLevels, sendDataToParent, statName]);


  const addLevel = () => {
    if (currentPurchasedLevels < n_levels) {
      const costForNextLevel = coinCost[currentPurchasedLevels];
      if (costForNextLevel !== "MAX" && coins >= costForNextLevel) {
        if (sendPurchaseToParent) sendPurchaseToParent(costForNextLevel);
        setCurrentPurchasedLevels(prev => prev + 1);
      }
    }
  };

  const removeLevel = () => {
    if (currentPurchasedLevels > 0) {
      const costForLevelToRemove = coinCost[currentPurchasedLevels - 1];
      if (costForLevelToRemove !== "MAX" && sendPurchaseToParent) {
        sendPurchaseToParent(-costForLevelToRemove);
      }
      setCurrentPurchasedLevels(prev => prev - 1);
    }
  };

  const displayCost = currentPurchasedLevels < n_levels ? coinCost[currentPurchasedLevels] : "MAX";
  const canAffordNext = displayCost !== "MAX" && coins >= displayCost;
  const isMaxLevelReached = currentPurchasedLevels >= n_levels;

  return (
    <div className="StateComponent">
      <h1 className="StateComponent-title">
        {title}{" "}
        <span className="StateComponent-title-price">
          {displayCost}{" "}
          <span style={{ color: currency === "C" ? "gold" : currency === "T" ? "#A5158C" : "inherit" }}>
            {displayCost !== "MAX" ? currency : ""}
          </span>
        </span>
      </h1>
      <div className="StateComponent-levelIndicatorWrap">
        <IoIosRemoveCircle
          className={`StateComponent-button ${currentPurchasedLevels <= 0 ? "StateComponent-button--disabled" : ""}`}
          onClick={removeLevel}
        />
        {Array.from({ length: n_levels }).map((_, index) => (
          <div
            key={index}
            className="StateComponent-levelIndicator"
            style={{ backgroundColor: index < currentPurchasedLevels ? "#79E0EE" : "#ffffff" }}
          ></div>
        ))}
        <IoIosAddCircle
          className={`StateComponent-button ${ (isMaxLevelReached || (displayCost !== "MAX" && !canAffordNext)) ? "StateComponent-button--disabled" : ""}`}
          onClick={addLevel}
        />
      </div>
      <p className="StateComponent-points">{description}</p>
      <p className="StateComponent-description">Curent: {curentStat}</p>
    </div>
  );
};

export default React.memo(StateComponent); 