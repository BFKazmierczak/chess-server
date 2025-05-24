import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import { configDotenv } from "dotenv";
import express from "express";
import expressWs from "express-ws";
import { createClient } from "redis";
import { v4 as uuidv4 } from "uuid";
import { validateGame } from "./src/utils/index.mjs";

configDotenv();

const redis = await createClient({
  url: process.env.REDIS_URL,
})
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

const app = express();
const port = 3000;

expressWs(app);

const router = express.Router();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(router);

const socketMap = new Map();

router.ws("/play", async function (ws, req) {
  console.log("connected");

  const { gameId } = req.query;
  const { ["player-name"]: playerName, ["player-token"]: token } = req.cookies;

  console.log({ gameId, playerName, token });

  if (!token) {
    ws.close(1008, "Authentication token required");
    return;
  }

  if (!gameId) {
    ws.close(1008, "Game ID is required");
    return;
  }

  if (socketMap.has(token)) {
    console.log("the player re-connected");
  }

  const gameKey = `game:${gameId}`;
  const game = await redis.hGetAll(gameKey);
  console.log({ game });

  const gameError = validateGame(game);
  if (gameError) {
    ws.close(1008, gameError);
    return;
  }

  console.log({ game });

  if (game["player-1"] !== token && game["player-2"] !== token) {
    ws.close(1008, "Forbidden");
    return;
  }

  let playerId = 0;

  if (game["player-1"] === token) {
    console.log("Connecting player 1");
    playerId = 1;
  }

  if (game["player-2"] === token) {
    playerId = 2;
    console.log("Connecting player 2");
  }

  if (playerId === 0) return res.status(500).send({ error: "Unknown error" });

  await redis.hSet(gameKey, {
    [`player-${playerId}-active`]: "true",
  });

  ws.playerId = playerId;
  socketMap.set(token, ws);

  const currentPlayerId = game[`player-${ws.playerId}`];

  ws.on("message", function (msg) {
    console.log(`Player ${ws.playerId} has sent a message:`, msg);

    console.log("Socket map size:", Array.from(socketMap.values()).length);

    for (const [pId, socket] of socketMap.entries()) {
      if (pId === currentPlayerId) {
        continue;
      }

      console.log("Sending to:", pId);

      const msgContent = JSON.stringify({
        playerName: game[`player-${ws.playerId}-nickname`],
        message: msg,
      });

      socket.send(msgContent);
    }
  });

  ws.on("close", async () => {
    console.log(`Player ${ws.playerId} has disconnected`);

    await redis.hSet(gameKey, {
      [`player-${ws.playerId}-active`]: "false",
    });
  });
});

router.post("/game", async function (req, res) {
  const cookies = req.cookies;

  if (!cookies["player-name"]) {
    return res.status(400).send({ error: "Player name not provided" });
  }

  let token = cookies["player-token"];

  if (!token) {
    console.info("generating new player token");
    token = uuidv4();
  }

  const gameId = uuidv4();

  const gameKey = `game:${gameId}`;

  await redis.hSet(gameKey, {
    "player-1": token,
    "player-1-nickname": cookies["player-name"],
  });

  if (!cookies["player-token"]) {
    const currentDate = new Date();

    res.cookie("player-token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      expires: new Date(currentDate.setDate(currentDate.getDate() + 1)),
    });
  }

  res.json({ gameId });
});

router.post("/join", async function (req, res) {
  const cookies = req.cookies;
  const { gameId } = req.body;

  const playerName = cookies["player-name"];

  if (!gameId) return res.status(400).send({ error: "Game ID not provided" });

  if (!playerName) {
    return res.status(400).send({ error: "Player name not provided" });
  }

  let token = cookies["player-token"];

  if (!token) {
    console.info("generating new player token");
    token = uuidv4();
  }

  const gameKey = `game:${gameId}`;

  const game = await redis.hGetAll(gameKey);

  const gameError = validateGame(game);
  if (gameError) {
    return res.status(400).send({ error: "Something went wrong" });
  }

  if (game["player-1"] === token) {
    return res.status(400).send({ error: "You cannot join your own game" });
  }

  if (game["player-2"]) {
    return res.status(400).send({ error: "Player 2 seat already taken" });
  }

  await redis.hSet(gameKey, {
    "player-2": token,
    "player-2-nickname": playerName,
  });

  if (!cookies["player-token"]) {
    const currentDate = new Date();

    res.cookie("player-token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      expires: new Date(currentDate.setDate(currentDate.getDate() + 1)),
    });
  }

  res.json({ success: true });
});

router.get("/", (req, res) => {
  console.log("accessing root");
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Chess server listening on port ${port}`);
});
