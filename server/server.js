// server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const port = process.env.PORT || 3001;
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PHASES = {
  WAITING: "waiting_for_match",
  INTRO: "intro",
  BUILDER: "builder",
  BETWEEN: "between",
  PLAYGROUND: "playground",
  GAME_OVER: "game_over",
};

const PHASE_DURATIONS = {
  [PHASES.INTRO]: 5,
  [PHASES.BUILDER]: 10,
  [PHASES.BETWEEN]: 3,
  [PHASES.PLAYGROUND]: 120,
};

const BASE_CHARACTER_STATS = {
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
};

let waitingPlayer = null;
let gameSessions = new Map();
let nextSessionId = 1;

// Ammo Regeneration config
const AMMO_REGEN_DELAY_MS = 500; // Delay after last shot before regen starts
const AMMO_REGEN_RATE_MS = 100;   // Interval for regenerating 1 ammo unit

function createAndStartGameSession(player1Socket, player2Socket) {
  const sessionId = nextSessionId++;
  console.log(
    `SERVER: Kreiram NOVU SESIJU IGRE ${sessionId} za ${player1Socket.id} i ${player2Socket.id}. NextSessionId će biti ${nextSessionId}`
  );

  const sessionData = {
    sessionId: sessionId,
    player1Id: player1Socket.id,
    player2Id: player2Socket.id,
    currentPhase: PHASES.WAITING,
    timeLeft: 0,
    timerInterval: null,
    player1Data: {
      socket: player1Socket,
      characterStats: JSON.parse(JSON.stringify(BASE_CHARACTER_STATS)), 
      currentHealth: BASE_CHARACTER_STATS.healthPoints,
      currentTopShield: BASE_CHARACTER_STATS.topShield,
      currentSideShield: BASE_CHARACTER_STATS.sideShield,
      currentAmmunition: BASE_CHARACTER_STATS.ammunition, 
      lastShotTime: 0, 
      ammoRegenTimeout: null, 
      ammoRegenInterval: null, 
      isBuildComplete: false,
      isReadyForBuildTimer: false,
      opponentId: player2Socket.id,
    },
    player2Data: {
      socket: player2Socket,
      characterStats: JSON.parse(JSON.stringify(BASE_CHARACTER_STATS)), 
      currentHealth: BASE_CHARACTER_STATS.healthPoints,
      currentTopShield: BASE_CHARACTER_STATS.topShield,
      currentSideShield: BASE_CHARACTER_STATS.sideShield,
      currentAmmunition: BASE_CHARACTER_STATS.ammunition, 
      lastShotTime: 0, 
      ammoRegenTimeout: null,
      ammoRegenInterval: null,
      isBuildComplete: false,
      isReadyForBuildTimer: false,
      opponentId: player1Socket.id,
    },
  };
  gameSessions.set(sessionId, sessionData);
  console.log(
    `SERVER: Sesija ${sessionId} dodana. Aktivne sesije: [${Array.from(
      gameSessions.keys()
    ).join(", ")}]`
  );

  player1Socket.join(sessionId.toString());
  player2Socket.join(sessionId.toString());
  console.log(
    `SERVER (Sesija ${sessionId}): Igrači ${player1Socket.id} i ${player2Socket.id} pridruženi sobi ${sessionId}`
  );

  player1Socket.emit("matched_in_game", {
    sessionId,
    opponentId: player2Socket.id,
    message: "Pronađen protivnik! Priprema za igru...",
  });
  player2Socket.emit("matched_in_game", {
    sessionId,
    opponentId: player1Socket.id,
    message: "Pronađen protivnik! Priprema za igru...",
  });

  console.log(
    `SERVER (Sesija ${sessionId}): Pozivam startPhaseForSession s PHASES.INTRO`
  );
  startPhaseForSession(sessionId, PHASES.INTRO);
}

function startAmmoRegen(session, playerId) {
    const playerData = (session.player1Id === playerId) ? session.player1Data : session.player2Data;
    if (!playerData) return;

    stopAmmoRegen(playerData);

    const timeSinceLastShot = Date.now() - playerData.lastShotTime;
    const delayUntilRegenStarts = AMMO_REGEN_DELAY_MS - timeSinceLastShot;

    playerData.ammoRegenTimeout = setTimeout(() => {
        playerData.ammoRegenInterval = setInterval(() => {
            if (!gameSessions.has(session.sessionId) || session.currentPhase !== PHASES.PLAYGROUND) {
                clearInterval(playerData.ammoRegenInterval);
                playerData.ammoRegenInterval = null;
                return;
            }

            if (playerData.currentAmmunition < playerData.characterStats.ammunition) {
                playerData.currentAmmunition = Math.min(
                    playerData.characterStats.ammunition,
                    playerData.currentAmmunition + 1
                );
                console.log(`SERVER (Sesija ${session.sessionId}): ${playerId} regenerirao 1 ammo. Trenutna: ${playerData.currentAmmunition}`);

                playerData.socket.emit("character_data_update", {
                    myCharacter: {
                        ...playerData.characterStats,
                        healthPoints: playerData.currentHealth,
                        topShield: playerData.currentTopShield,
                        sideShield: playerData.currentSideShield,
                        ammunition: playerData.currentAmmunition,
                    }
                });
            } else {
                clearInterval(playerData.ammoRegenInterval);
                playerData.ammoRegenInterval = null;
            }
        }, AMMO_REGEN_RATE_MS);
    }, Math.max(0, delayUntilRegenStarts)); 
}

function stopAmmoRegen(playerData) {
    if (playerData.ammoRegenTimeout) {
        clearTimeout(playerData.ammoRegenTimeout);
        playerData.ammoRegenTimeout = null;
    }
    if (playerData.ammoRegenInterval) {
        clearInterval(playerData.ammoRegenInterval);
        playerData.ammoRegenInterval = null;
    }
}


function startPhaseForSession(sessionId, newPhase) {
  const session = gameSessions.get(sessionId);
  if (!session) {
    console.error(
      `SERVER: Sesija ${sessionId} nije pronađena za startPhaseForSession.`
    );
    return;
  }

  session.currentPhase = newPhase;
  session.timeLeft = PHASE_DURATIONS[newPhase] || 0;

  console.log(
    `SERVER (Sesija ${sessionId}): ULAZ U startPhaseForSession. newPhase: ${newPhase}, Postavljeno vrijeme: ${session.timeLeft}s`
  );

  const commonPhaseData = {
    newPhase: session.currentPhase,
    duration: PHASE_DURATIONS[newPhase],
    timeLeft: session.timeLeft,
  };

  let messageForPhase = undefined;
  if (newPhase === PHASES.BUILDER) {
    messageForPhase = "Izgradi lika i klikni Ready!";
    session.player1Data.isReadyForBuildTimer = false;
    session.player2Data.isReadyForBuildTimer = false;
    session.player1Data.isBuildComplete = false;
    session.player2Data.isBuildComplete = false;
  }

  const getCharacterDataForClient = (playerData) => ({
    ...playerData.characterStats, 
    healthPoints: playerData.currentHealth, 
    topShield: playerData.currentTopShield, 
    sideShield: playerData.currentSideShield, 
    ammunition: playerData.currentAmmunition, 
  });

  if (newPhase === PHASES.INTRO || newPhase === PHASES.BUILDER || newPhase === PHASES.BETWEEN || newPhase === PHASES.PLAYGROUND) {
    session.player1Data.socket.emit("game_phase_update", {
      ...commonPhaseData,
      initialCharacterData: { myCharacter: getCharacterDataForClient(session.player1Data) },
      message: messageForPhase,
    });
    session.player2Data.socket.emit("game_phase_update", {
      ...commonPhaseData,
      initialCharacterData: { myCharacter: getCharacterDataForClient(session.player2Data) },
      message: messageForPhase,
    });
  } else {
    io.to(sessionId.toString()).emit("game_phase_update", commonPhaseData);
  }
  console.log(
    `SERVER (Sesija ${sessionId}): Emitiran game_phase_update za ${newPhase}`
  );

  if (session.timerInterval) {
    clearInterval(session.timerInterval);
    session.timerInterval = null;
  }

  if (newPhase === PHASES.PLAYGROUND) {
      console.log(`SERVER (Sesija ${sessionId}): Starting ammo regen for both players.`);
      startAmmoRegen(session, session.player1Id);
      startAmmoRegen(session, session.player2Id);
  } else {
      stopAmmoRegen(session.player1Data);
      stopAmmoRegen(session.player2Data);
  }


  if (session.timeLeft > 0) {
    console.log(
      `SERVER (Sesija ${sessionId}): Pokrećem tajmer za ${newPhase} na ${session.timeLeft}s`
    );
    session.timerInterval = setInterval(() => {
      session.timeLeft--;
      io.to(sessionId.toString()).emit("timer_update", {
        remainingTime: session.timeLeft,
      });

      if (session.timeLeft <= 0) {
        console.log(
          `SERVER (Sesija ${sessionId}): Tajmer za ${session.currentPhase} istekao.`
        );
        clearInterval(session.timerInterval);
        session.timerInterval = null;
        if (gameSessions.has(sessionId)) {
          if (session.currentPhase === PHASES.PLAYGROUND) {
            io.to(sessionId.toString()).emit("game_over", {
              winner: null,
              loser: null,
              message: "Vrijeme je isteklo! Nema pobjednika.",
            });
            stopAmmoRegen(session.player1Data);
            stopAmmoRegen(session.player2Data);

            const deletedSessionId = sessionId;
            const successfullyDeleted = gameSessions.delete(sessionId);
            console.log(
              `SERVER: Sesija ${deletedSessionId} ${
                successfullyDeleted
                  ? "USPJEŠNO UKLONJENA"
                  : "NIJE PRONAĐENA ZA UKLANJANJE"
              } zbog isteka vremena.`
            );
          } else {
            proceedToNextPhaseForSession(sessionId);
          }
        } else {
          console.log(
            `SERVER (Sesija ${sessionId}): Sesija više ne postoji nakon isteka tajmera za ${newPhase}. Ne nastavljam.`
          );
        }
      }
    }, 1000);
  }
}

function startBuilderPhaseTimer(sessionId) {
  const session = gameSessions.get(sessionId);
  if (!session || session.currentPhase !== PHASES.BUILDER) {
    console.error(
      `SERVER (Sesija ${sessionId}): Pokušaj pokretanja BUILDER tajmera, ali sesija ne postoji ili nije u BUILDER fazi. Trenutna faza: ${session?.currentPhase}`
    );
    return;
  }

  if (session.timerInterval) {
    console.log(
      `SERVER (Sesija ${sessionId}): BUILDER tajmer već radi ili je bio pokrenut.`
    );
    return;
  }

  session.timeLeft = PHASE_DURATIONS[PHASES.BUILDER];
  console.log(
    `SERVER (Sesija ${sessionId}): Oba igrača spremna! Pokrećem BUILDER tajmer na ${session.timeLeft}s.`
  );

  const getCharacterDataForClient = (playerData) => ({ 
    ...playerData.characterStats,
    healthPoints: playerData.currentHealth,
    topShield: playerData.currentTopShield,
    sideShield: playerData.currentSideShield,
    ammunition: playerData.currentAmmunition,
  });

  io.to(sessionId.toString()).emit("game_phase_update", {
    newPhase: PHASES.BUILDER,
    duration: PHASE_DURATIONS[PHASES.BUILDER],
    timeLeft: session.timeLeft,
    message: "Odbrojavanje za izgradnju je počelo!",
    initialCharacterData: { myCharacter: getCharacterDataForClient(session.player1Data) }, 
  });

  session.timerInterval = setInterval(() => {
    if (!gameSessions.has(sessionId)) {
      clearInterval(session.timerInterval);
      session.timerInterval = null;
      console.log(
        `SERVER (Sesija ${sessionId}): BUILDER tajmer prekinut jer sesija više ne postoji.`
      );
      return;
    }
    session.timeLeft--;
    io.to(sessionId.toString()).emit("timer_update", {
      remainingTime: session.timeLeft,
    });

    if (session.timeLeft <= 0) {
      console.log(`SERVER (Sesija ${sessionId}): Tajmer za BUILDER istekao.`);
      clearInterval(session.timerInterval);
      session.timerInterval = null;

      session.player1Data.isBuildComplete = true;
      session.player2Data.isBuildComplete = true;

      if (gameSessions.has(sessionId)) {
        proceedToNextPhaseForSession(sessionId);
      } else {
        console.log(
          `SERVER (Sesija ${sessionId}): Sesija više ne postoji nakon isteka BUILDER tajmera. Ne nastavljam.`
        );
      }
    }
  }, 1000);
}

function proceedToNextPhaseForSession(sessionId) {
  const session = gameSessions.get(sessionId);
  if (!session) {
    console.error(
      `SERVER: Sesija ${sessionId} nije pronađena za proceedToNextPhaseForSession.`
    );
    return;
  }
  console.log(
    `SERVER (Sesija ${sessionId}): ULAZ U proceedToNextPhaseForSession. Trenutna faza: ${session.currentPhase}`
  );

  switch (session.currentPhase) {
    case PHASES.INTRO:
      console.log(
        `SERVER (Sesija ${sessionId}): INTRO faza završena. Prelazak na BUILDER.`
      );
      startPhaseForSession(sessionId, PHASES.BUILDER);
      break;
    case PHASES.BUILDER:
      console.log(
        `SERVER (Sesija ${sessionId}): BUILDER faza (tajmer) završena. Prelazak na BETWEEN.`
      );
      session.player1Data.currentHealth = session.player1Data.characterStats.healthPoints;
      session.player1Data.currentTopShield = session.player1Data.characterStats.topShield;
      session.player1Data.currentSideShield = session.player1Data.characterStats.sideShield;
      session.player1Data.currentAmmunition = session.player1Data.characterStats.ammunition; 

      session.player2Data.currentHealth = session.player2Data.characterStats.healthPoints;
      session.player2Data.currentTopShield = session.player2Data.characterStats.topShield;
      session.player2Data.currentSideShield = session.player2Data.characterStats.sideShield;
      session.player2Data.currentAmmunition = session.player2Data.characterStats.ammunition; 

      startPhaseForSession(sessionId, PHASES.BETWEEN);
      break;
    case PHASES.BETWEEN:
      console.log(
        `SERVER (Sesija ${sessionId}): BETWEEN faza završena. Slanje game_start_info i prelazak na PLAYGROUND.`
      );

      const getCharacterDataForClient = (playerData) => ({
        ...playerData.characterStats,
        healthPoints: playerData.currentHealth,
        topShield: playerData.currentTopShield,
        sideShield: playerData.currentSideShield,
        ammunition: playerData.currentAmmunition,
      });

      session.player1Data.socket.emit("game_start_info", {
        myCharacter: getCharacterDataForClient(session.player1Data),
        opponentCharacter: session.player2Data.characterStats, // Opponent's base stats
        startingPhase: PHASES.PLAYGROUND,
        timeLeftInRound: PHASE_DURATIONS[PHASES.PLAYGROUND],
      });
      session.player2Data.socket.emit("game_start_info", {
        myCharacter: getCharacterDataForClient(session.player2Data),
        opponentCharacter: session.player1Data.characterStats, // Opponent's base stats
        startingPhase: PHASES.PLAYGROUND,
        timeLeftInRound: PHASE_DURATIONS[PHASES.PLAYGROUND],
      });
      startPhaseForSession(sessionId, PHASES.PLAYGROUND);
      break;
    case PHASES.PLAYGROUND:
      console.log(
        `SERVER (Sesija ${sessionId}): PLAYGROUND faza. Logika završetka se upravlja eventima.`
      );
      break;
    default:
      console.log(
        `SERVER (Sesija ${sessionId}): Nepoznata ili neobrađena trenutna faza za prijelaz: ${session.currentPhase}`
      );
  }
}

io.on("connection", (socket) => {
  console.log(`Klijent se spojio: ${socket.id}`);
  socket.emit("connection_ack", { message: `Spojeno! Tvoj ID: ${socket.id}.` });
  socket.emit("game_phase_update", {
    newPhase: PHASES.WAITING,
    message: "Pritisni Play Online za traženje igre.",
  });

  socket.on("client_ready_for_online_game", () => {
    console.log(
      `Klijent ${socket.id} je spreman za online igru (matchmaking).`
    );
    const existingSessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (existingSessionIdString) {
      const existingSessionId = parseInt(existingSessionIdString, 10);
      console.log(
        `Klijent ${socket.id} je već u aktivnoj igri/sesiji ${existingSessionId}. Vraćam ga u trenutnu fazu.`
      );
      const session = gameSessions.get(existingSessionId);
      if (session) {
        const playerData =
          socket.id === session.player1Id
            ? session.player1Data
            : session.player2Data;

        let messageForReconnect = "Nastavljaš postojeću igru...";
        if (
          session.currentPhase === PHASES.BUILDER &&
          (!session.player1Data.isReadyForBuildTimer ||
            !session.player2Data.isReadyForBuildTimer)
        ) {
          messageForReconnect = playerData.isReadyForBuildTimer
            ? "Čekam da protivnik klikne Ready..."
            : "Izgradi lika i klikni Ready!";
        }

        const getCharacterDataForClient = (playerData) => ({
          ...playerData.characterStats,
          healthPoints: playerData.currentHealth,
          topShield: playerData.currentTopShield,
          sideShield: playerData.currentSideShield,
          ammunition: playerData.currentAmmunition,
        });


        socket.emit("game_phase_update", {
          newPhase: session.currentPhase,
          duration: PHASE_DURATIONS[session.currentPhase],
          timeLeft: session.timeLeft,
          message: messageForReconnect,
          initialCharacterData: {
            myCharacter: getCharacterDataForClient(playerData),
          },
        });
        if (session.currentPhase === PHASES.PLAYGROUND) {
          const opponentData =
            socket.id === session.player1Id
              ? session.player2Data
              : session.player1Data;
          socket.emit("game_start_info", {
            myCharacter: getCharacterDataForClient(playerData),
            opponentCharacter: opponentData.characterStats,
            startingPhase: PHASES.PLAYGROUND,
            timeLeftInRound: session.timeLeft,
          });
        }
      }
      return;
    }

    if (waitingPlayer && waitingPlayer !== socket.id) {
      const player1Socket = io.sockets.sockets.get(waitingPlayer);
      const player2Socket = socket;
      if (player1Socket) {
        console.log(
          `SERVER: Spajam igrača ${player1Socket.id} s igračem ${player2Socket.id}.`
        );
        createAndStartGameSession(player1Socket, player2Socket);
        waitingPlayer = null;
      } else {
        console.log(
          `SERVER: Igrač ${waitingPlayer} (koji je čekao) se odspojio. ${socket.id} sada čeka.`
        );
        waitingPlayer = socket.id;
        socket.emit("game_phase_update", {
          newPhase: PHASES.WAITING,
          message: "Tražim protivnika...",
        });
      }
    } else if (waitingPlayer === socket.id) {
      console.log(
        `SERVER: Igrač ${socket.id} već čeka (ponovljeni client_ready).`
      );
      socket.emit("game_phase_update", {
        newPhase: PHASES.WAITING,
        message: "Već tražiš protivnika...",
      });
    } else {
      waitingPlayer = socket.id;
      console.log(`SERVER: Igrač ${socket.id} čeka protivnika.`);
      socket.emit("game_phase_update", {
        newPhase: PHASES.WAITING,
        message: "Tražim protivnika...",
      });
    }
  });

  socket.on("character_stat_update", (payload) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) {
      console.warn(
        `SERVER: ${socket.id} poslao 'character_stat_update', but not in an active session.`
      );
      return;
    }
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);

    if (session && session.currentPhase === PHASES.BUILDER) {
      const playerData =
        socket.id === session.player1Id
          ? session.player1Data
          : session.player2Data;
      if (
        playerData &&
        payload.currentStats &&
        !playerData.isReadyForBuildTimer
      ) {
        playerData.characterStats = { ...payload.currentStats };
        playerData.currentHealth = playerData.characterStats.healthPoints;
        playerData.currentTopShield = playerData.characterStats.topShield;
        playerData.currentSideShield = playerData.characterStats.sideShield;
        playerData.currentAmmunition = playerData.characterStats.ammunition;

        console.log(
          `SERVER (Sesija ${sessionId}): Primam 'character_stat_update' od ${socket.id}. Bazni i trenutni stats ažurirani.`
        );
      } else if (playerData && playerData.isReadyForBuildTimer) {
        console.log(
          `SERVER (Sesija ${sessionId}): ${socket.id} pokušao ažurirati statse nakon što je kliknuo Ready. Ignoriram.`
        );
        socket.emit("action_error", {
          message: "Ne možete mijenjati statse nakon što ste kliknuli Ready.",
        });
      }
    } else if (session) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Primljen 'character_stat_update' od ${socket.id} izvan BUILDER faze (trenutna: ${session.currentPhase}).`

      );
    }
  });

  socket.on("character_build_complete", (builtCharacterData) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) {
      console.warn(
        `SERVER: ${socket.id} poslao 'character_build_complete', but not in an active session.`
      );
      return;
    }
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);

    if (session && session.currentPhase === PHASES.BUILDER) {
      const playerData =
        socket.id === session.player1Id
          ? session.player1Data
          : session.player2Data;
      if (playerData) {
        if (playerData.isReadyForBuildTimer) {
          return;
        }
        console.log(
          `SERVER (Sesija ${sessionId}): Primam 'character_build_complete' (READY signal) od ${socket.id}.`
        );

        playerData.characterStats = { ...builtCharacterData };
        playerData.currentHealth = builtCharacterData.healthPoints;
        playerData.currentTopShield = builtCharacterData.topShield;
        playerData.currentSideShield = builtCharacterData.sideShield;
        playerData.currentAmmunition = builtCharacterData.ammunition;
        playerData.isReadyForBuildTimer = true;

        console.log(
          `SERVER (Sesija ${sessionId}): ${socket.id} je kliknuo Ready. Finalni stats:`,
          JSON.parse(JSON.stringify(playerData.characterStats))
        );

        const getCharacterDataForClient = (playerData) => ({
          ...playerData.characterStats,
          healthPoints: playerData.currentHealth,
          topShield: playerData.currentTopShield,
          sideShield: playerData.currentSideShield,
          ammunition: playerData.currentAmmunition,
        });

        socket.emit("game_phase_update", {
          newPhase: PHASES.BUILDER,
          timeLeft: PHASE_DURATIONS[PHASES.BUILDER],
          duration: PHASE_DURATIONS[PHASES.BUILDER],
          message: "Tvoj odabir je spremljen. Čekam protivnika...",
          initialCharacterData: {
            myCharacter: getCharacterDataForClient(playerData),
          },
        });

        if (
          session.player1Data.isReadyForBuildTimer &&
          session.player2Data.isReadyForBuildTimer
        ) {
          startBuilderPhaseTimer(sessionId);
        }
      }
    } else if (session) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Primljen 'character_build_complete' od ${socket.id} izvan BUILDER faze (trenutna: ${session.currentPhase}).`
      );
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`Klijent ${socket.id} se odspojio. Razlog: ${reason}`);
    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
      console.log(`Igrač ${socket.id} koji je čekao se odspojio.`);
    }
    Array.from(socket.rooms).forEach((room) => {
      if (room !== socket.id) {
        const sessionId = parseInt(room, 10);
        if (!isNaN(sessionId) && gameSessions.has(sessionId)) {
          const session = gameSessions.get(sessionId);
          if (
            session &&
            (session.player1Id === socket.id || session.player2Id === socket.id)
          ) {
            console.log(
              `SERVER: Igrač ${socket.id} se odspojio iz sesije ${sessionId}.`
            );
            const opponentData =
              socket.id === session.player1Id
                ? session.player2Data
                : session.player1Data;
            if (opponentData.socket && opponentData.socket.connected) {
              opponentData.socket.emit("opponent_disconnected", {
                message: "Protivnik se odspojio. Igra je završena.",
              });
              opponentData.socket.emit("game_over", {
                winner: opponentData.socket.id,
                loser: socket.id,
                message: "Protivnik se odspojio.",
              });
            }
            if (session.timerInterval) clearInterval(session.timerInterval);
            stopAmmoRegen(session.player1Data);
            stopAmmoRegen(session.player2Data);

            const deletedSessionId = sessionId;
            const successfullyDeleted = gameSessions.delete(sessionId);
            console.log(
              `SERVER: Sesija ${deletedSessionId} ${
                successfullyDeleted
                  ? "USPJEŠNO UKLONJENA"
                  : "NIJE PRONAĐENA ZA UKLANJANJE"
              } zbog odspajanja. Preostale sesije: [${Array.from(
                gameSessions.keys()
              ).join(", ")}]`
            );
          }
        }
      }
    });
  });

  socket.on("player_fired_trigger", ({ playerId }) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) {
      console.warn(`SERVER: ${socket.id} pokušao pritisnuti okidač, ali NIJE u aktivnoj sesiji.`);
      return;
    }
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);
    if (!session || session.currentPhase !== PHASES.PLAYGROUND) {
      console.warn(`SERVER (Sesija ${sessionId}): Igrač ${socket.id} pokušao pritisnuti okidač izvan PLAYGROUND faze ili sesija nije pronađena.`);
      return;
    }

    const shooterData = (socket.id === session.player1Id) ? session.player1Data : session.player2Data;
    if (!shooterData) {
      console.warn(`SERVER (Sesija ${sessionId}): Strijelac ${socket.id} nije pronađen u sesiji za pritisak okidača.`);
      return;
    }


    if (shooterData.currentAmmunition > 0) {
      shooterData.currentAmmunition--; 
      shooterData.lastShotTime = Date.now(); 
      console.log(`SERVER (Sesija ${sessionId}): Igrač ${socket.id} pritisnuo okidač. Trenutna municija: ${shooterData.currentAmmunition}`);

      startAmmoRegen(session, shooterData.socket.id);

      const getCharacterDataForClient = (playerData) => ({
        ...playerData.characterStats,
        healthPoints: playerData.currentHealth,
        topShield: playerData.currentTopShield,
        sideShield: playerData.currentSideShield,
        ammunition: playerData.currentAmmunition,
      });
      shooterData.socket.emit("character_data_update", {
        myCharacter: getCharacterDataForClient(shooterData)
      });
    } else {
      console.warn(`SERVER (Sesija ${sessionId}): Igrač ${socket.id} pokušao pritisnuti okidač, ali nema municije!`);
      shooterData.socket.emit("action_error", { message: "Nema municije!" });
    }
  });


  socket.on("bullet_fired_at_opponent", (bulletEventData) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) {
      console.warn(
        `SERVER: ${socket.id} poslao metak (za vizualizaciju), ali NIJE u aktivnoj session sobi.`
      );
      return;
    }
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);
    if (!session || session.currentPhase !== PHASES.PLAYGROUND) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Igrač ${socket.id} pokušao poslati metak (za vizualizaciju) izvan PLAYGROUND faze. Metak odbačen.`
      );
      return;
    }

    // Pronađi podatke protivnika
    const opponentData = (socket.id === session.player1Id) ? session.player2Data : session.player1Data;

    if (opponentData.socket && opponentData.socket.connected) {
      const dataToSendToOpponent = {
        originalShooterId: bulletEventData.originalShooterId,
        xPosition: bulletEventData.xPosition,
        bulletRotation: bulletEventData.bulletRotation,
        bulletStats: {
          speed: bulletEventData.bulletStats.speed,
          damage: bulletEventData.bulletStats.damage,
        },
        bulletId: bulletEventData.bulletId || `server_bullet_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
      opponentData.socket.emit("incoming_bullet", dataToSendToOpponent);
      // console.log(`SERVER (Sesija ${sessionId}): Metak (ID: ${dataToSendToOpponent.bulletId}) od ${socket.id} proslijeđen protivniku.`);
    } else {
      console.log(
        `SERVER (Sesija ${sessionId}): Protivnik igrača ${socket.id} nije spojen. Metak nije poslan.`
      );
    }
  });

  socket.on("bullet_hit_player", (hitData) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) {
      console.warn(
        `SERVER: ${socket.id} poslao bullet_hit_player, ali nije u aktivnoj sobi.`
      );
      return;
    }
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);
    if (!session) {
      console.error(
        `SERVER: Sesija ${sessionId} nije pronađena za bullet_hit_player od ${socket.id}. Aktivne sesije: [${Array.from(gameSessions.keys()).join(", ")}]`
      );
      return;
    }
    if (session.currentPhase !== PHASES.PLAYGROUND) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Primljen 'bullet_hit_player' od ${socket.id} izvan PLAYGROUND faze.`
      );
      return;
    }
    if (socket.id !== hitData.targetPlayerId) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Igrač ${socket.id} javio da je ${hitData.targetPlayerId} pogođen. Neispravan pošiljatelj!`
      );
      return;
    }

    const shooterData = (hitData.shooterPlayerId === session.player1Id) ? session.player1Data : session.player2Data;
    const targetPlayerData = (hitData.targetPlayerId === session.player1Id) ? session.player1Data : session.player2Data;

    if (!shooterData || !targetPlayerData || !targetPlayerData.characterStats) {
      console.error(`SERVER (Sesija ${sessionId}): Nije moguće pronaći podatke za strijelca (${hitData.shooterPlayerId}) ili metu (${hitData.targetPlayerId}) ili meta nema characterStats.`);
      return;
    }

  
    if (shooterData.socket && shooterData.socket.connected) {
      shooterData.socket.emit("your_bullet_hit_opponent", {
        bulletId: hitData.bulletId,
        hitType: hitData.hitType,
        damageDealt: hitData.damageDealt, 
      });
    }

    let actualDamageDealt = 0;
    let finalHitType = hitData.hitType;

    let damageToApply = shooterData.characterStats.attackPoints || 0;

    const dodgeChance = targetPlayerData.characterStats.dodgeChance || 0;
    const dodgeRoll = Math.random() * 100;

    if (dodgeRoll < dodgeChance) {
        finalHitType = "dodged";
        console.log(`SERVER (Sesija ${sessionId}): Metak (ID: ${hitData.bulletId}) je izbjegnut od ${hitData.targetPlayerId}!`);
    } else {
        switch (hitData.hitType) {
            case "topShield":
                if (targetPlayerData.currentTopShield > 0) {
                    targetPlayerData.currentTopShield--;
                    console.log(`SERVER (Sesija ${sessionId}): ${hitData.targetPlayerId} pogođen TOP ŠTITOM. Preostalo: ${targetPlayerData.currentTopShield}`);
                    finalHitType = "topShield";
                } else {
                    finalHitType = "body";
                }
                break;
            case "leftShield":
            case "rightShield":
                if (targetPlayerData.currentSideShield > 0) {
                    targetPlayerData.currentSideShield--;
                    console.log(`SERVER (Sesija ${sessionId}): ${hitData.targetPlayerId} pogođen BOČNIM ŠTITOM. Preostalo: ${targetPlayerData.currentSideShield}`);
                    finalHitType = "sideShield";
                } else {
                    finalHitType = "body";
                }
                break;
            case "body":
                finalHitType = "body";
                break;
            default:
                console.warn(`SERVER (Sesija ${sessionId}): Nepoznat hitType: ${hitData.hitType}. Defaulting to body hit.`);
                finalHitType = "body";
        }

        if (finalHitType === "body") {
            const armor = targetPlayerData.characterStats.armor || 0;
            const damageReduction = Math.min(armor / 100, 0.8);
            actualDamageDealt = Math.max(1, Math.round(damageToApply * (1 - damageReduction)));
            targetPlayerData.currentHealth -= actualDamageDealt;
            targetPlayerData.currentHealth = Math.max(0, targetPlayerData.currentHealth);
            console.log(`SERVER (Sesija ${sessionId}): ${hitData.targetPlayerId} pogođen u TIJELO. Šteta: ${actualDamageDealt}, Novo HP: ${targetPlayerData.currentHealth}`);
        }
    }

    const getCharacterDataForClient = (playerData) => ({
      ...playerData.characterStats,
      healthPoints: playerData.currentHealth,
      topShield: playerData.currentTopShield,
      sideShield: playerData.currentSideShield,
      ammunition: playerData.currentAmmunition,
    });

    targetPlayerData.socket.emit("character_data_update", {
        myCharacter: getCharacterDataForClient(targetPlayerData)
    });
    console.log(`SERVER (Sesija ${sessionId}): Emitiran character_data_update za ${targetPlayerData.socket.id}. Novo stanje: HP: ${targetPlayerData.currentHealth}, TS: ${targetPlayerData.currentTopShield}, SS: ${targetPlayerData.currentSideShield}`);

    if (targetPlayerData.currentHealth <= 0) {
        console.log(
            `SERVER (Sesija ${sessionId}): Igrač ${hitData.targetPlayerId} je poražen (HP: ${targetPlayerData.currentHealth})! Pobjednik je ${shooterData.socket.id}.`
        );
        io.to(sessionId.toString()).emit("game_over", {
            winner: shooterData.socket.id,
            loser: hitData.targetPlayerId,
            message: `Igrač ${shooterData.socket.id} je pobijedio!`,
        });
        if (session.timerInterval) clearInterval(session.timerInterval);
        stopAmmoRegen(session.player1Data);
        stopAmmoRegen(session.player2Data);

        const deletedSessionId = sessionId;
        const successfullyDeleted = gameSessions.delete(sessionId);
        console.log(
            `SERVER: Sesija ${deletedSessionId} ${
              successfullyDeleted
                ? "USPJEŠNO UKLONJENA"
                : "NIJE PRONAĐENA ZA UKLANJANJE"
            } zbog kraja igre. Preostale sesije: [${Array.from(
              gameSessions.keys()
            ).join(", ")}]`
        );
      }
    });

  socket.on("player_defeated", ({ playerId }) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) return;
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);
    if (session && session.currentPhase === PHASES.PLAYGROUND) {
      if (socket.id !== playerId) {
        console.warn(
          `SERVER (Sesija ${sessionId}): Igrač ${socket.id} javio da je ${playerId} poražen. Ignoriram.`
        );
        return;
      }
      if (!gameSessions.has(sessionId)) {
        console.log(
          `SERVER (Sesija ${sessionId}): Igrač ${playerId} javlja poraz, but the session is already removed.`
        );
        return;
      }
      console.log(
        `SERVER (Sesija ${sessionId}): Igrač ${playerId} javlja da je poražen (preko 'player_defeated').`
      );
      const opponentData =
        playerId === session.player1Id
          ? session.player2Data
          : session.player1Data;

      const defeatedPlayerData = (playerId === session.player1Id) ? session.player1Data : session.player2Data;
      defeatedPlayerData.currentHealth = 0; 

      io.to(sessionId.toString()).emit("game_over", {
        winner: opponentData.socket.id,
        loser: playerId,
        message: `Igrač ${opponentData.socket.id} je pobijedio! (Igrač ${playerId} javio poraz)`,
      });
      if (session.timerInterval) clearInterval(session.timerInterval);
      stopAmmoRegen(session.player1Data);
      stopAmmoRegen(session.player2Data);

      const deletedSessionId = sessionId;
      const successfullyDeleted = gameSessions.delete(sessionId);
      console.log(
        `SERVER: Sesija ${deletedSessionId} ${
          successfullyDeleted
            ? "USPJEŠNO UKLONJENA"
            : "NIJE PRONAĐENA ZA UKLANJANJE"
        } jer je igrač ${playerId} poražen. Preostale sesije: [${Array.from(
          gameSessions.keys()
        ).join(", ")}]`
      );
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Backend server sa Socket.IO sluša na portu ${port}`);
  console.log(`SERVER: Inicijalno stanje - čeka se na matchmaking.`);
});