// CharacterBuilder.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./characterBuilder.scss";
import StateComponent from "./StateComponent/StateComponent";
import CharacterSheet from "../CharacterSheet/CharacterSheet";

const baseValues = { 
  healthPoints: 100, topShield: 0, sideShield: 0, guns: 1, dodgeChance: 0, armor: 0,
  attackPoints: 20, ammunition: 6, CAModifier: 0.0, attackSpeed: 1.0, bulletSpeed: 1.0, movemantSpeed: 1.0,
};
const perLvlValues = { 
  healthPoints: 50, topShield: 1, sideShield: 1, guns: 1, dodgeChance: 1, armor: 5,
  attackPoints: 10, ammunition: 1, CAModifier: 0.1, attackSpeed: 0.1, bulletSpeed: 0.1, movemantSpeed: 0.1,
};

const CharacterBuilder = ({ onCharacterReady, externallySetTimeLeft, onStatUpdate, initialCharacterData }) => {
  const [coins, setCoins] = useState(1000);
  const [cristals, setCristals] = useState(1000);
  const [timeLeft, setTimeLeft] = useState(externallySetTimeLeft || 0);

  useEffect(() => {
    setTimeLeft(externallySetTimeLeft);
  }, [externallySetTimeLeft]);

  const colors = useMemo(() => ["#B784B7", "#8E7AB5", "#E493B3", "#EEA5A6"], []);
  const [bodyColor, setBodyColor] = useState(() => {
    return initialCharacterData?.bodyColor || colors[Math.floor(Math.random() * colors.length)];
  });


  useEffect(() => {
    if (initialCharacterData?.bodyColor && initialCharacterData.bodyColor !== bodyColor) {
      setBodyColor(initialCharacterData.bodyColor);
    }
  }, [initialCharacterData?.bodyColor, bodyColor]);


  const calculateLvlFromStatValue = useCallback((statName, statValue) => {
    if (typeof statValue === 'undefined' || statValue === null) return 0;
    if (perLvlValues[statName] === 0 || typeof perLvlValues[statName] === 'undefined') return 0;
    
    const calculated = Math.round((statValue - baseValues[statName]) / perLvlValues[statName]);
    return Math.max(0, calculated);
  }, []); 

  const [healthPointsLvl, setHealthPointsLvl] = useState(() => calculateLvlFromStatValue('healthPoints', initialCharacterData?.healthPoints));
  const [topShieldLvl, setTopShieldLvl] = useState(() => calculateLvlFromStatValue('topShield', initialCharacterData?.topShield));
  const [sideShieldLvl, setSideShieldLvl] = useState(() => calculateLvlFromStatValue('sideShield', initialCharacterData?.sideShield));
  const [gunsLvl, setGunsLvl] = useState(() => calculateLvlFromStatValue('guns', initialCharacterData?.guns));
  const [dodgeChanceLvl, setDodgeChanceLvl] = useState(() => calculateLvlFromStatValue('dodgeChance', initialCharacterData?.dodgeChance));
  const [armorLvl, setArmorLvl] = useState(() => calculateLvlFromStatValue('armor', initialCharacterData?.armor));
  const [attackPointsLvl, setAttackPointsLvl] = useState(() => calculateLvlFromStatValue('attackPoints', initialCharacterData?.attackPoints));
  const [ammunitionLvl, setAmmunitionLvl] = useState(() => calculateLvlFromStatValue('ammunition', initialCharacterData?.ammunition));
  const [CAModifierLvl, setCAModifierLvl] = useState(() => calculateLvlFromStatValue('CAModifier', initialCharacterData?.CAModifier));
  const [attackSpeedLvl, setAttackSpeedLvl] = useState(() => calculateLvlFromStatValue('attackSpeed', initialCharacterData?.attackSpeed));
  const [bulletSpeedLvl, setBulletSpeedLvl] = useState(() => calculateLvlFromStatValue('bulletSpeed', initialCharacterData?.bulletSpeed));
  const [movemantSpeedLvl, setMovemantSpeedLvl] = useState(() => calculateLvlFromStatValue('movemantSpeed', initialCharacterData?.movemantSpeed));



  const getCurrentCharacterStats = useCallback(() => {

    return {
      bodyColor,
      healthPoints: baseValues.healthPoints + healthPointsLvl * perLvlValues.healthPoints,
      topShield: baseValues.topShield + topShieldLvl * perLvlValues.topShield,
      sideShield: baseValues.sideShield + sideShieldLvl * perLvlValues.sideShield,
      guns: baseValues.guns + gunsLvl * perLvlValues.guns,
      dodgeChance: baseValues.dodgeChance + dodgeChanceLvl * perLvlValues.dodgeChance,
      armor: baseValues.armor + armorLvl * perLvlValues.armor,
      attackPoints: baseValues.attackPoints + attackPointsLvl * perLvlValues.attackPoints,
      ammunition: baseValues.ammunition + ammunitionLvl * perLvlValues.ammunition,
      CAModifier: parseFloat(Math.max(0,(baseValues.CAModifier + CAModifierLvl * perLvlValues.CAModifier)).toFixed(1)),
      attackSpeed: parseFloat(Math.max(0.1,(baseValues.attackSpeed + attackSpeedLvl * perLvlValues.attackSpeed)).toFixed(1)),
      bulletSpeed: parseFloat(Math.max(0.1,(baseValues.bulletSpeed + bulletSpeedLvl * perLvlValues.bulletSpeed)).toFixed(1)),
      movemantSpeed: parseFloat(Math.max(0.1,(baseValues.movemantSpeed + movemantSpeedLvl * perLvlValues.movemantSpeed)).toFixed(1)),
    };
  }, [bodyColor, healthPointsLvl, topShieldLvl, sideShieldLvl, gunsLvl, dodgeChanceLvl, armorLvl,
      attackPointsLvl, ammunitionLvl, CAModifierLvl, attackSpeedLvl, bulletSpeedLvl, movemantSpeedLvl]);


  const formatTime = (seconds) => { /* ... */ 
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handlePurchaseCoins = useCallback((cost) => { setCoins((prevCoins) => prevCoins - cost); }, []);
  const handlePurchaseCristals = useCallback((cost) => { setCristals((prevCristals) => prevCristals - cost); }, []);

  const handleReadyButtonClick = () => {
    onCharacterReady(getCurrentCharacterStats());
  };


  const allStatsData = useMemo(() => [
    { levels: 8, cost: [10,15,20,25,30,35,40,40,"MAX"], title: "❤️ HEALTH POINTS", description: `Increase HP by ${perLvlValues.healthPoints} points!`, currency: "C", statName: "healthPoints", setter: setHealthPointsLvl, curentStat: baseValues.healthPoints + healthPointsLvl * perLvlValues.healthPoints, purchaseHandler: handlePurchaseCoins },
    { levels: 5, cost: [15,20,20,30,40,"MAX"], title: "🛡️ TOP SHIELD", description: `Add ${perLvlValues.topShield} shield(s) on top!`, currency: "C", statName: "topShield", setter: setTopShieldLvl, curentStat: baseValues.topShield + topShieldLvl * perLvlValues.topShield, purchaseHandler: handlePurchaseCoins },
    { levels: 5, cost: [10,10,10,15,20,"MAX"], title: "🛡️➡️ SIDE SHIELDS", description: `Add ${perLvlValues.sideShield} shield(s) on sides!`, currency: "C", statName: "sideShield", setter: setSideShieldLvl, curentStat: baseValues.sideShield + sideShieldLvl * perLvlValues.sideShield, purchaseHandler: handlePurchaseCoins },
    { levels: 2, cost: [50,80,"MAX"], title: "🔫 GUNS", description: `Add ${perLvlValues.guns} extra gun(s)!`, currency: "C", statName: "guns", setter: setGunsLvl, curentStat: baseValues.guns + gunsLvl * perLvlValues.guns, purchaseHandler: handlePurchaseCoins },
    { levels: 6, cost: [10,15,20,25,30,35,"MAX"], title: "💨 DODGE CHANCE", description: `Increase dodge by ${perLvlValues.dodgeChance}%!`, currency: "C", statName: "dodgeChance", setter: setDodgeChanceLvl, curentStat: (baseValues.dodgeChance + dodgeChanceLvl * perLvlValues.dodgeChance) + "%", purchaseHandler: handlePurchaseCoins },
    { levels: 10, cost: [10,10,10,15,15,20,20,25,25,30,"MAX"], title: "🦾 ARMOR", description: `Reduce damage by ${perLvlValues.armor} points!`, currency: "C", statName: "armor", setter: setArmorLvl, curentStat: baseValues.armor + armorLvl * perLvlValues.armor, purchaseHandler: handlePurchaseCoins },
    { levels: 8, cost: [10,15,20,25,30,35,40,40,"MAX"], title: "⚔️ ATTACK DMG", description: `Increase bullet damage by ${perLvlValues.attackPoints} points!`, currency: "T", statName: "attackPoints", setter: setAttackPointsLvl, curentStat: baseValues.attackPoints + attackPointsLvl * perLvlValues.attackPoints, purchaseHandler: handlePurchaseCristals },
    { levels: 4, cost: [30,35,40,40,"MAX"], title: "💣 AMMUNITION", description: `Increase ammo by ${perLvlValues.ammunition}!`, currency: "T", statName: "ammunition", setter: setAmmunitionLvl, curentStat: baseValues.ammunition + ammunitionLvl * perLvlValues.ammunition, purchaseHandler: handlePurchaseCristals },
    { levels: 8, cost: [10,15,20,25,30,35,40,40,"MAX"], title: "🎯 CHARGE ATTACK MODIFIER", description: `Increase charged attack by x${perLvlValues.CAModifier}!`, currency: "T", statName: "CAModifier", setter: setCAModifierLvl, curentStat: "x" + parseFloat(Math.max(0,(baseValues.CAModifier + CAModifierLvl * perLvlValues.CAModifier))).toFixed(1), purchaseHandler: handlePurchaseCristals },
    { levels: 8, cost: [10,15,20,25,30,35,40,40,"MAX"], title: "⚡ ATTACK SPEED", description: `Increase firing rate by x${perLvlValues.attackSpeed}!`, currency: "T", statName: "attackSpeed", setter: setAttackSpeedLvl, curentStat: "x" + parseFloat(Math.max(0.1,(baseValues.attackSpeed + attackSpeedLvl * perLvlValues.attackSpeed))).toFixed(1), purchaseHandler: handlePurchaseCristals },
    { levels: 8, cost: [10,15,20,25,30,35,40,40,"MAX"], title: "🚀 BULLET SPEED", description: `Increase bullet speed by x${perLvlValues.bulletSpeed}!`, currency: "T", statName: "bulletSpeed", setter: setBulletSpeedLvl, curentStat: "x" + parseFloat(Math.max(0.1,(baseValues.bulletSpeed + bulletSpeedLvl * perLvlValues.bulletSpeed))).toFixed(1), purchaseHandler: handlePurchaseCristals },
    { levels: 8, cost: [10,15,20,25,30,35,40,40,"MAX"], title: "🏃‍♂️ MOVEMENT SPEED", description: `Increase ship movement by x${perLvlValues.movemantSpeed}!`, currency: "T", statName: "movemantSpeed", setter: setMovemantSpeedLvl, curentStat: "x" + parseFloat(Math.max(0.1,(baseValues.movemantSpeed + movemantSpeedLvl * perLvlValues.movemantSpeed))).toFixed(1), purchaseHandler: handlePurchaseCristals }
  ], [healthPointsLvl, topShieldLvl, sideShieldLvl, gunsLvl, dodgeChanceLvl, armorLvl, attackPointsLvl, ammunitionLvl, CAModifierLvl, attackSpeedLvl, bulletSpeedLvl, movemantSpeedLvl, handlePurchaseCoins, handlePurchaseCristals]);


  const handleLevelChange = useCallback((statName, newLevelFromStateComponent) => {

    const statDefinition = allStatsData.find(s => s.statName === statName);

    if (statDefinition && statDefinition.setter) {
        statDefinition.setter(newLevelFromStateComponent);

    } else {
        console.error(`CharacterBuilder: Nije pronađen setter za statName: ${statName}`);
    }
  }, [allStatsData]); 


  useEffect(() => {
    if (onStatUpdate) {

      onStatUpdate("any_stat_changed_via_useEffect", -1, getCurrentCharacterStats());
    }
  }, [healthPointsLvl, topShieldLvl, sideShieldLvl, gunsLvl, dodgeChanceLvl, armorLvl,
      attackPointsLvl, ammunitionLvl, CAModifierLvl, attackSpeedLvl, bulletSpeedLvl, movemantSpeedLvl,
      bodyColor, 
      onStatUpdate, getCurrentCharacterStats]);


  return (
    <div className="CharacterBuilder">
      <section className="CharacterBuilder-header">
        <div className="CharacterBuilder-header-timer">Time: {formatTime(timeLeft)}</div>
        <div className="CharacterBuilder-header-currencyWrap">
          <div className="CharacterBuilder-header-currency">{coins} <span className="CharacterBuilder-header-currency--C">C</span></div>
          <div className="CharacterBuilder-header-currency">{cristals} <span className="CharacterBuilder-header-currency--T">T</span></div>
        </div>
      </section>
      <section className="CharacterBuilder-builder">
        <article className="CharacterBuilder-fisical">
          {allStatsData.filter(s => s.currency === "C").map(stat => (
            <div className="CharacterBuilder-stateComponent" key={stat.title}>
              <StateComponent
                title={stat.title}
                n_levels={stat.levels}
                coinCost={stat.cost}
                description={stat.description}
                curentStat={stat.curentStat} // Prikazuje trenutnu vrijednost stata
                currency={stat.currency}
                // initialLevel je 0-based broj kupljenih levela
                initialLevel={
                    stat.statName === "healthPoints" ? healthPointsLvl :
                    stat.statName === "topShield" ? topShieldLvl :
                    stat.statName === "sideShield" ? sideShieldLvl :
                    stat.statName === "guns" ? gunsLvl :
                    stat.statName === "dodgeChance" ? dodgeChanceLvl :
                    stat.statName === "armor" ? armorLvl : 0
                }
                statName={stat.statName}
                // sendDataToParent sada prima 0-based broj kupljenih levela
                sendDataToParent={(newPurchasedLevelCount) => handleLevelChange(stat.statName, newPurchasedLevelCount)}
                coins={coins}
                sendPurchaseToParent={stat.purchaseHandler}
              />
            </div>
          ))}
        </article>
        <article className="CharacterBuilder-hmmm">
          {allStatsData.filter(s => s.currency === "T").map(stat => (
             <div className="CharacterBuilder-stateComponent" key={stat.title}>
              <StateComponent
                title={stat.title}
                n_levels={stat.levels}
                coinCost={stat.cost}
                description={stat.description}
                curentStat={stat.curentStat}
                currency={stat.currency}
                initialLevel={
                    stat.statName === "attackPoints" ? attackPointsLvl :
                    stat.statName === "ammunition" ? ammunitionLvl :
                    stat.statName === "CAModifier" ? CAModifierLvl :
                    stat.statName === "attackSpeed" ? attackSpeedLvl :
                    stat.statName === "bulletSpeed" ? bulletSpeedLvl :
                    stat.statName === "movemantSpeed" ? movemantSpeedLvl : 0
                }
                statName={stat.statName}
                sendDataToParent={(newPurchasedLevelCount) => handleLevelChange(stat.statName, newPurchasedLevelCount)}
                coins={cristals}
                sendPurchaseToParent={stat.purchaseHandler}
              />
            </div>
          ))}
        </article>
        <article className="CharacterBuilder-look">
          <CharacterSheet {...getCurrentCharacterStats()} />
        </article>
      </section>
      <button className="CharacterBuilder-readyButton" onClick={handleReadyButtonClick}>
        Ready!
      </button>
    </div>
  );
};

export default CharacterBuilder;