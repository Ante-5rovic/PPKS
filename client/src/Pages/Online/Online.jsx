import React, { useState, useEffect, useRef, useCallback } from "react";
import io from "socket.io-client";
import "./online.scss";
import CharacterBuilder from "../../Components/CharacterBuilder/CharacterBuilder";
import Playground from "../../Components/Playground/Playground";
import { motion, AnimatePresence } from "framer-motion";

const SOCKET_SERVER_URL = "http://localhost:3001";

const PHASES = {
  INITIALIZING: "initializing",
  ERROR_CONNECTING: "error_connecting",
  WAITING_FOR_MATCH: "waiting_for_match",
  INTRO: "intro",
  BUILDER: "builder",
  BETWEEN: "between",
  PLAYGROUND: "playground",
  GAME_OVER: "game_over",
};

const defaultCharacterData = {
  bodyColor: "#8E7AB5",
  healthPoints: 100, 
  topShield: 0,      
  sideShield: 0,     
  guns: 1,
  dodgeChance: 0,
  armor: 0,
  attackPoints: 20,
  ammunition: 6,    
  CAModifier: 0.0,
  attackSpeed: 1.0,
  bulletSpeed: 1.0,
  movemantSpeed: 1.0,
  currentHealth: 100,
  currentTopShield: 0,
  currentSideShield: 0,
  currentAmmunition: 6 * 1, // Max ammo for 1 gun
};

const Online = () => {
  const [phase, setPhase] = useState(PHASES.INITIALIZING);
  const [timeLeftInPhase, setTimeLeftInPhase] = useState(0);
  const [characterData, setCharacterData] = useState(defaultCharacterData); 
  const [gameMessage, setGameMessage] = useState("");
  const [incomingBullets, setIncomingBullets] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentGameId, setCurrentGameId] = useState(null);

  const socketRef = useRef(null);
  const [socketReinitializationKey, setSocketReinitializationKey] = useState(0);

  const sendEventToServer = useCallback(
    (eventName, data) => {
      if (
        phase !== PHASES.PLAYGROUND &&
        (eventName === "bullet_fired_at_opponent" ||
          eventName === "bullet_hit_player" ||
          eventName === "player_defeated")
      ) {
        console.warn(
          `Online: Pokušaj slanja '${eventName}' izvan PLAYGROUND faze. Trenutna faza: ${phase}. Event NIJE poslan.`
        );
        return;
      }
      if (
        !sessionId &&
        (eventName === "bullet_fired_at_opponent" ||
          eventName === "bullet_hit_player" ||
          eventName === "player_defeated")
      ) {
        console.warn(
          `Online: Nema aktivnog sessionId. Event '${eventName}' NIJE poslan.`
        );
        return;
      }
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit(eventName, data);
      } else {
        console.warn(
          `Socket nije spojen. Event '${eventName}' nije poslan:`,
          data
        );
      }
    },
    [phase, sessionId]
  );

  useEffect(() => {
    console.log(
      `Online: Socket useEffect pokrenut (key: ${socketReinitializationKey})`
    );

    if (socketRef.current) {
      console.log("Online: Čistim stari socket prije nove inicijalizacije.");
      socketRef.current.disconnect();
      socketRef.current.removeAllListeners();
    }

    const newSocket = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });
    socketRef.current = newSocket;
    console.log("Online: Novi socket instanciran.");

    newSocket.on("connect", () => {
      console.log(
        `Online: Uspješno spojen! ID: ${newSocket.id}. Emitiram client_ready_for_online_game.`
      );
      setGameMessage("Spojen na server. Tražim igru...");
      newSocket.emit("client_ready_for_online_game");
    });

    newSocket.on("disconnect", (reason) => {
      console.log(`Online: Odspojen. Razlog: ${reason}`);
      if (reason === "io server disconnect") {
        setPhase(PHASES.ERROR_CONNECTING);
        setGameMessage("Odspojeni ste od strane servera.");
      } else if (phase !== PHASES.GAME_OVER) {
        setGameMessage(`Odspojen: ${reason}. Pokušavam ponovno...`);
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Online: Greška pri spajanju:", error);
      setPhase(PHASES.ERROR_CONNECTING);
      setGameMessage("Greška pri spajanju na server.");
    });

    newSocket.on("connection_ack", (data) => {
      console.log("Online: Server potvrdio konekciju:", data.message);
    });

    newSocket.on(
      "game_phase_update",
      ({ newPhase, duration, timeLeft, message, initialCharacterData }) => {
        console.log(
          `Online: Server PHASE UPDATE -> Phase: ${newPhase}, Duration: ${duration}, TimeLeft: ${timeLeft}, Msg: ${message}`
        );
        setPhase(newPhase);
        setTimeLeftInPhase(timeLeft !== undefined ? timeLeft : duration || 0);
        if (message) setGameMessage(message);

        if (initialCharacterData && initialCharacterData.myCharacter) {
          console.log(
            `ONLINE (${newSocket.id}): Primljeni characterData od servera:`,
            JSON.parse(JSON.stringify(initialCharacterData.myCharacter))
          );
          setCharacterData(initialCharacterData.myCharacter);
        } else if (
          newPhase === PHASES.BUILDER &&
          (!initialCharacterData || !initialCharacterData.myCharacter)
        ) {
          console.warn(
            "Online: U builder fazi bez validnih initialCharacterData, koristeći postojeće/default."
          );
          setCharacterData((prev) => ({
            ...defaultCharacterData,
            ...prev,
            currentHealth: prev.healthPoints || defaultCharacterData.healthPoints,
            currentTopShield: prev.topShield || defaultCharacterData.topShield,
            currentSideShield: prev.sideShield || defaultCharacterData.sideShield,
            currentAmmunition: (prev.ammunition || defaultCharacterData.ammunition) * (prev.guns || defaultCharacterData.guns),
          }));
        }
      }
    );

    newSocket.on("timer_update", ({ remainingTime }) => {
      setTimeLeftInPhase(remainingTime);
    });

    newSocket.on("character_data_update", (updatedCharacterData) => {
      if (updatedCharacterData.myCharacter) {
        console.log("Online: Primljen character_data_update (live):", updatedCharacterData.myCharacter);
        setCharacterData(updatedCharacterData.myCharacter);
      }
    });

    newSocket.on(
      "game_start_info",
      ({ myCharacter, opponentCharacter, startingPhase, timeLeftInRound }) => {
        console.log("Online: Igra počinje (game_start_info)!", {
          myCharacter,
          opponentCharacter,
        });
        setCharacterData(myCharacter);
        setPhase(startingPhase || PHASES.PLAYGROUND);
        setTimeLeftInPhase(timeLeftInRound || 0);
      }
    );

    newSocket.on("game_over", ({ winner, loser, message }) => {
      console.log(
        `Online: Igra završena (game_over)! Pobjednik: ${winner}, Poruka: ${message}`
      );
      setPhase(PHASES.GAME_OVER);
      const displayMessage =
        winner === newSocket.id
          ? `Pobijedio si! ${message || ""}`
          : loser === newSocket.id
          ? `Izgubio si. ${message || ""}`
          : message || `Igra je gotova. Pobjednik: ${winner}`;
      setGameMessage(displayMessage);
    });

    newSocket.on("matched_in_game", (data) => {
      console.log(
        `CLIENT (${newSocket.id}): Primljen 'matched_in_game'. Server kaže da je sessionId: ${data.sessionId}`
      );
      setGameMessage(
        data.message || "Protivnik pronađen! Igra počinje uskoro..."
      );
      setSessionId(data.sessionId);
      setCurrentGameId(data.sessionId);
    });

    newSocket.on("opponent_disconnected", (data) => {
      console.log("Online: Protivnik se odspojio.", data);
      setGameMessage(data.message || "Protivnik se odspojio.");
    });

    newSocket.on("incoming_bullet", (bulletDataFromServer) => {
      setIncomingBullets((prev) => [
        ...prev,
        {
          ...bulletDataFromServer,
          id: bulletDataFromServer.bulletId || crypto.randomUUID(),
        },
      ]);
    });

    newSocket.on("your_bullet_hit_opponent", (data) => {
      console.log(
        `ONLINE (${newSocket.id}): Moj metak ${data.bulletId} pogodio protivnika! Tip: ${data.hitType}, Šteta: ${data.damageDealt}`
      );
    });

    return () => {
      console.log(
        `Online: Cleanup useEffecta za socket (key: ${socketReinitializationKey}). Diskonektiram socket ${newSocket.id}`
      );
      newSocket.disconnect();
      newSocket.removeAllListeners();
    };
  }, [socketReinitializationKey]);

  const handleCharacterReady = useCallback(
    (builtCharacterData) => {
      console.log(
        "Online: CharacterBuilder javlja da je karakter spreman. Šaljem serveru..."
      );
      setCharacterData((prev) => ({
        ...prev, 
        ...builtCharacterData, 
        healthPoints: builtCharacterData.healthPoints, 
        topShield: builtCharacterData.topShield,       
        sideShield: builtCharacterData.sideShield,     
        ammunition: builtCharacterData.ammunition * builtCharacterData.guns, 
      }));
      sendEventToServer("character_build_complete", builtCharacterData);
      setGameMessage("Karakter spreman. Čekam protivnika/potvrdu servera...");
    },
    [sendEventToServer]
  );

  const handleStatUpdate = useCallback(
    (statName, newZeroBasedLevel, currentStatsFromBuilder) => {
      setCharacterData((prev) => ({
        ...prev, 
        ...currentStatsFromBuilder, 
        healthPoints: currentStatsFromBuilder.healthPoints, 
        topShield: currentStatsFromBuilder.topShield,
        sideShield: currentStatsFromBuilder.sideShield,
        ammunition: currentStatsFromBuilder.ammunition * currentStatsFromBuilder.guns,
      }));
      sendEventToServer("character_stat_update", {
        statName,
        level: newZeroBasedLevel,
        currentStats: currentStatsFromBuilder, 
      });
    },
    [sendEventToServer]
  );

  const handlePlayAgain = () => {
    console.log("Online: Kliknuto 'Igraj Ponovno'. Resetiram stanje i socket.");

    setPhase(PHASES.INITIALIZING);
    setGameMessage("Tražim novu igru...");
    setIncomingBullets([]);
    setCharacterData(defaultCharacterData); 
    setSessionId(null);
    setCurrentGameId(null);
    setTimeLeftInPhase(0);

    setSocketReinitializationKey((prevKey) => prevKey + 1);
  };

  if (
    phase === PHASES.INITIALIZING &&
    (!socketRef.current || !socketRef.current.connected)
  ) {
    return (
      <div className="Online-loading">
        Inicijalizacija veze... {gameMessage}
      </div>
    );
  }
  if (phase === PHASES.ERROR_CONNECTING) {
    return (
      <div className="Online-error">
        Greška: {gameMessage || "Nije moguće spojiti se na server."}
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: "20px" }}
        >
          Osvježi stranicu
        </button>
      </div>
    );
  }
  if (phase === PHASES.WAITING_FOR_MATCH) {
    return (
      <div className="Online-loading">
        {gameMessage || "Tražim protivnika..."}
        <p style={{ fontSize: "0.8em", marginTop: "10px" }}>
          Socket ID: {socketRef.current?.id}
        </p>
      </div>
    );
  }

  return (
    <div className="Online">
      <AnimatePresence mode="wait">
        {phase === PHASES.INTRO && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="Online-message-screen"
          >
            <h2>{gameMessage || "Igra počinje uskoro..."}</h2>
            <p>Preostalo vrijeme: {timeLeftInPhase}s</p>
          </motion.div>
        )}

        {phase === PHASES.BUILDER && (
          <motion.div
            key="builder"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.6 }}
          >
            <CharacterBuilder
              onCharacterReady={handleCharacterReady}
              externallySetTimeLeft={timeLeftInPhase}
              onStatUpdate={handleStatUpdate}
              initialCharacterData={characterData}
            />
          </motion.div>
        )}

        {phase === PHASES.BETWEEN && (
          <motion.div
            key="between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="Online-message-screen"
          >
            <h2>{gameMessage || "Priprema za igru..."}</h2>
            <p>Preostalo vrijeme: {timeLeftInPhase}s</p>
          </motion.div>
        )}

        {phase === PHASES.PLAYGROUND &&
          characterData &&
          currentGameId && (
            <motion.div
              key="playground"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.6 }}
            >
              <Playground
                characterData={characterData} 
                timeLeftInRound={timeLeftInPhase}
                sendEventToServer={sendEventToServer}
                socketId={socketRef.current ? socketRef.current.id : null}
                initialIncomingBullets={incomingBullets}
                onClearIncomingBullet={(bulletId) => {
                  setIncomingBullets((prev) =>
                    prev.filter((b) => b.id !== bulletId)
                  );
                }}
                gameId={currentGameId}
              />
            </motion.div>
          )}

        {phase === PHASES.GAME_OVER && (
          <motion.div
            key="gameover"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="Online-message-screen Online-gameOver"
          >
            <h1>Kraj Igre!</h1>
            <h2>{gameMessage}</h2>
            <button
              onClick={handlePlayAgain}
              className="Online-playAgainButton"
            >
              Igraj Ponovno
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{
          position: "fixed",
          bottom: "10px",
          left: "10px",
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "5px",
          borderRadius: "3px",
          zIndex: 10000,
          fontSize: "12px",
          maxWidth: "calc(100% - 20px)",
          wordBreak: "break-word",
        }}
      >
        Socket ID: {socketRef.current ? socketRef.current.id : "N/A"} | Phase:{" "}
        {phase} | Server Time: {timeLeftInPhase}s <br />
        Session ID: {sessionId || "N/A"} | Game ID (za Playground):{" "}
        {currentGameId || "N/A"} <br />
        Message: {gameMessage} | Bullets in queue: {incomingBullets.length}
      </div>
    </div>
  );
};

export default Online;