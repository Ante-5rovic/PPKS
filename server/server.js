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

function createAndStartGameSession(player1Socket, player2Socket) {
  const sessionId = nextSessionId++;
  console.log(
    `SERVER: Kreiram NOVU SESIJU IGRE ${sessionId} za ${player1Socket.id} i ${player2Socket.id}. NextSessionId će biti ${nextSessionId}`
  );

  const sessionData = {
    player1Id: player1Socket.id,
    player2Id: player2Socket.id,
    currentPhase: PHASES.WAITING,
    timeLeft: 0,
    timerInterval: null,
    player1Data: {
      socket: player1Socket,
      characterStats: JSON.parse(JSON.stringify(BASE_CHARACTER_STATS)),
      isBuildComplete: false, 
      isReadyForBuildTimer: false, 
      opponentId: player2Socket.id,
    },
    player2Data: {
      socket: player2Socket,
      characterStats: JSON.parse(JSON.stringify(BASE_CHARACTER_STATS)),
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

  if (newPhase === PHASES.INTRO || newPhase === PHASES.BUILDER) {
    console.log(
      `SERVER (Sesija ${sessionId}): Šaljem game_phase_update za ${newPhase} s initialCharacterData.`
    );
    session.player1Data.socket.emit("game_phase_update", {
      ...commonPhaseData,
      initialCharacterData: { myCharacter: session.player1Data.characterStats },
      message: messageForPhase,
    });
    session.player2Data.socket.emit("game_phase_update", {
      ...commonPhaseData,
      initialCharacterData: { myCharacter: session.player2Data.characterStats },
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

  if (newPhase !== PHASES.BUILDER && session.timeLeft > 0) {
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
          proceedToNextPhaseForSession(sessionId);
        } else {
          console.log(
            `SERVER (Sesija ${sessionId}): Sesija više ne postoji nakon isteka tajmera za ${newPhase}. Ne nastavljam.`
          );
        }
      }
    }, 1000);
  } else if (
    newPhase !== PHASES.BUILDER &&
    newPhase !== PHASES.PLAYGROUND &&
    newPhase !== PHASES.WAITING &&
    newPhase !== PHASES.GAME_OVER
  ) {
    console.log(
      `SERVER (Sesija ${sessionId}): Faza ${newPhase} (koja nije BUILDER/PLAYGROUND/WAITING/GAME_OVER) ima trajanje 0 ili je bez tajmera.`
    );
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

  io.to(sessionId.toString()).emit("game_phase_update", {
    newPhase: PHASES.BUILDER,
    duration: PHASE_DURATIONS[PHASES.BUILDER],
    timeLeft: session.timeLeft,
    message: "Odbrojavanje za izgradnju je počelo!",
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
      startPhaseForSession(sessionId, PHASES.BETWEEN);
      break;
    case PHASES.BETWEEN:
      console.log(
        `SERVER (Sesija ${sessionId}): BETWEEN faza završena. Slanje game_start_info i prelazak na PLAYGROUND.`
      );
      console.log(
        `SERVER (Sesija ${sessionId}): Pripremam game_start_info. P1 stats:`,
        JSON.parse(JSON.stringify(session.player1Data.characterStats))
      );
      console.log(
        `SERVER (Sesija ${sessionId}): Pripremam game_start_info. P2 stats:`,
        JSON.parse(JSON.stringify(session.player2Data.characterStats))
      );

      session.player1Data.socket.emit("game_start_info", {
        myCharacter: session.player1Data.characterStats,
        opponentCharacter: session.player2Data.characterStats,
        startingPhase: PHASES.PLAYGROUND,
        timeLeftInRound: 120,
      });
      session.player2Data.socket.emit("game_start_info", {
        myCharacter: session.player2Data.characterStats,
        opponentCharacter: session.player1Data.characterStats,
        startingPhase: PHASES.PLAYGROUND,
        timeLeftInRound: 120,
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

        socket.emit("game_phase_update", {
          newPhase: session.currentPhase,
          duration: PHASE_DURATIONS[session.currentPhase],
          timeLeft: session.timeLeft, 
          message: messageForReconnect,
          initialCharacterData: { myCharacter: playerData.characterStats },
        });
        if (session.currentPhase === PHASES.PLAYGROUND) {
          const opponentData =
            socket.id === session.player1Id
              ? session.player2Data
              : session.player1Data;
          socket.emit("game_start_info", {
            myCharacter: playerData.characterStats,
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
        `SERVER: ${socket.id} poslao 'character_stat_update', ali nije u aktivnoj sesiji.`
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
        console.log(
          `SERVER (Sesija ${sessionId}): Primam 'character_stat_update' od ${socket.id}.`
        );
        playerData.characterStats = { ...payload.currentStats };
        console.log(
          `SERVER (Sesija ${sessionId}): ${socket.id} STATSI AŽURIRANI. Novi playerData.characterStats:`,
          JSON.parse(JSON.stringify(playerData.characterStats))
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
        `SERVER: ${socket.id} poslao 'character_build_complete', ali nije u aktivnoj sesiji.`
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
          console.log(
            `SERVER (Sesija ${sessionId}): Igrač ${socket.id} je već kliknuo Ready. Ignoriram ponovljeni 'character_build_complete'.`
          );
          return;
        }
        console.log(
          `SERVER (Sesija ${sessionId}): Primam 'character_build_complete' (READY signal) od ${socket.id}.`
        );

        playerData.characterStats = { ...builtCharacterData }; 
        playerData.isReadyForBuildTimer = true; 

        console.log(
          `SERVER (Sesija ${sessionId}): ${socket.id} je kliknuo Ready. Novi stats:`,
          JSON.parse(JSON.stringify(playerData.characterStats))
        );

        socket.emit("game_phase_update", {
          newPhase: PHASES.BUILDER,
          timeLeft: PHASE_DURATIONS[PHASES.BUILDER], 
          duration: PHASE_DURATIONS[PHASES.BUILDER],
          message: "Tvoj odabir je spremljen. Čekam protivnika...",
          initialCharacterData: { myCharacter: playerData.characterStats },
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

  socket.on("bullet_fired_at_opponent", (bulletEventData) => {
    const sessionIdString = Array.from(socket.rooms).find(
      (room) => room !== socket.id && gameSessions.has(parseInt(room, 10))
    );
    if (!sessionIdString) {
      console.warn(
        `SERVER: ${
          socket.id
        } ispalio metak, ali NIJE u aktivnoj session sobi. Socket rooms: ${JSON.stringify(
          Array.from(socket.rooms)
        )}`
      );
      return;
    }
    const sessionId = parseInt(sessionIdString, 10);
    const session = gameSessions.get(sessionId);
    if (!session) {
      console.error(
        `SERVER: Sesija ${sessionId} (iz sobe ${sessionIdString}) NIJE PRONAĐENA za bullet event od ${
          socket.id
        }. Aktivne sesije: [${Array.from(gameSessions.keys()).join(", ")}]`
      );
      return;
    }
    if (session.currentPhase !== PHASES.PLAYGROUND) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Igrač ${socket.id} pokušao pucati izvan PLAYGROUND faze (trenutna: ${session.currentPhase}). Metak odbačen.`
      );
      return;
    }
    if (
      typeof bulletEventData.xPosition !== "number" ||
      typeof bulletEventData.bulletRotation !== "number" ||
      typeof bulletEventData.bulletStats !== "object" ||
      typeof bulletEventData.bulletStats.speed !== "number" ||
      typeof bulletEventData.bulletStats.damage !== "number" ||
      !bulletEventData.originalShooterId
    ) {
      console.error(
        `SERVER (Sesija ${sessionId}): Primljen neispravan bulletEventData od ${socket.id}:`,
        JSON.stringify(bulletEventData)
      );
      return;
    }
    const opponentData =
      socket.id === session.player1Id
        ? session.player2Data
        : session.player1Data;
    if (opponentData.socket && opponentData.socket.connected) {
      const dataToSendToOpponent = {
        originalShooterId: bulletEventData.originalShooterId,
        xPosition: bulletEventData.xPosition,
        bulletRotation: bulletEventData.bulletRotation,
        bulletStats: {
          speed: bulletEventData.bulletStats.speed,
          damage: bulletEventData.bulletStats.damage,
        },
        bulletId:
          bulletEventData.bulletId ||
          `server_bullet_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 5)}`,
      };
      opponentData.socket.emit("incoming_bullet", dataToSendToOpponent);
    } else {
      console.log(
        `SERVER (Sesija ${sessionId}): Protivnik igrača ${socket.id} (ID: ${
          opponentData.opponentId || "nepoznat"
        }) nije spojen. Metak nije poslan.`
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
        `SERVER: Sesija ${sessionId} nije pronađena za bullet_hit_player od ${
          socket.id
        }. Aktivne sesije: [${Array.from(gameSessions.keys()).join(", ")}]`
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
    const shooterIsP1 = hitData.shooterPlayerId === session.player1Id;
    const targetIsP2 = hitData.targetPlayerId === session.player2Id;
    const shooterIsP2 = hitData.shooterPlayerId === session.player2Id;
    const targetIsP1 = hitData.targetPlayerId === session.player1Id;
    if (!((shooterIsP1 && targetIsP2) || (shooterIsP2 && targetIsP1))) {
      console.warn(
        `SERVER (Sesija ${sessionId}): Neispravni shooter/target ID-jevi u bullet_hit_player...`
      );
      return;
    }
    const shooterSocket =
      hitData.shooterPlayerId === session.player1Id
        ? session.player1Data.socket
        : session.player2Data.socket;
    if (shooterSocket && shooterSocket.connected) {
      shooterSocket.emit("your_bullet_hit_opponent", {
        bulletId: hitData.bulletId,
        hitType: hitData.hitType,
        damageDealt: hitData.damageDealt,
      });
    }
    const targetPlayerData =
      hitData.targetPlayerId === session.player1Id
        ? session.player1Data
        : session.player2Data;
    if (targetPlayerData && targetPlayerData.characterStats) {
      if (hitData.hitType !== "dodged") {
        let hpChanged = false;
        if (
          hitData.hitType === "topShield" &&
          targetPlayerData.characterStats.topShield > 0
        ) {
          targetPlayerData.characterStats.topShield--;
        } else if (
          hitData.hitType === "leftShield" &&
          targetPlayerData.characterStats.sideShield > 0
        ) {
          targetPlayerData.characterStats.sideShield--;
        } else if (
          hitData.hitType === "rightShield" &&
          targetPlayerData.characterStats.sideShield > 0
        ) {
          targetPlayerData.characterStats.sideShield--;
        } else if (hitData.hitType === "body") {
          targetPlayerData.characterStats.healthPoints -= hitData.damageDealt;
          targetPlayerData.characterStats.healthPoints = Math.max(
            0,
            targetPlayerData.characterStats.healthPoints
          );
          hpChanged = true;
        }
        if (hpChanged && targetPlayerData.characterStats.healthPoints <= 0) {
          console.log(
            `SERVER (Sesija ${sessionId}): Igrač ${hitData.targetPlayerId} je poražen (HP: ${targetPlayerData.characterStats.healthPoints})! Pobjednik je ${hitData.shooterPlayerId}.`
          );
          io.to(sessionId.toString()).emit("game_over", {
            winner: hitData.shooterPlayerId,
            loser: hitData.targetPlayerId,
            message: `Igrač ${hitData.shooterPlayerId} je pobijedio!`,
          });
          if (session.timerInterval) clearInterval(session.timerInterval);
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
      }
    } else {
      console.error(
        `SERVER (Sesija ${sessionId}): Nije moguće pronaći characterStats za pogođenog igrača ${hitData.targetPlayerId}`
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
          `SERVER (Sesija ${sessionId}): Igrač ${playerId} javlja poraz, ali sesija je već uklonjena.`
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
      io.to(sessionId.toString()).emit("game_over", {
        winner: opponentData.socket.id,
        loser: playerId,
        message: `Igrač ${opponentData.socket.id} je pobijedio! (Igrač ${playerId} javio poraz)`,
      });
      if (session.timerInterval) clearInterval(session.timerInterval);
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
