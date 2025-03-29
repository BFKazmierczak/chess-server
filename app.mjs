import express from 'express'
import expressWs from 'express-ws'
import bodyParser from 'body-parser'
import { v4 as uuidv4 } from 'uuid'
import { createClient } from 'redis'

const redis = await createClient({
  url: 'redis://default:FWchBURQJtKnxXtFUswbQqhuaczHGEcG@mainline.proxy.rlwy.net:52930'
})
  .on('error', (err) => console.log('Redis Client Error', err))
  .connect()

const app = express()
const port = 3000

expressWs(app)

const router = express.Router()

app.use(bodyParser.json())
app.use(router)

const socketMap = new Map()

router.ws('/play', async function (ws, req) {
  console.log('connected')

  const { token, gameId } = req.query

  if (!token) {
    ws.close(1008, 'Authentication token required')
    return
  }

  if (!gameId) {
    ws.close(1008, 'Game ID is required')
    return
  }

  if (socketMap.has(token)) {
    console.log('the player re-connected')
  }

  socketMap.set(token, ws)

  const gameKey = `game:${gameId}`
  const game = await redis.hGetAll(gameKey)
  console.log({ game })

  if (
    game['player-1-token'] !== token &&
    game['player-2-token'] === undefined
  ) {
    console.log('connecting player 2')

    await redis.hSet(gameKey, { 'player-2-token': token })
  } else {
    console.log('player attempted to join an ongoing game')

    ws.close(1008, "You can't join an ongoing game")
    return
  }

  ws.on('message', function (msg) {
    console.log('received: ', msg)
  })

  ws.on('close', () => {
    console.log('Connection closed')
  })
})

router.post('/play', async function (req, res) {
  const { playerId } = req.body
  let gameId = req.body.gameId

  if (!playerId)
    return res.status(400).send({ error: 'Player ID not provided' })

  const token = uuidv4()
  const gameKey = `game:${gameId}`

  if (gameId) {
    console.log('gameId provided')

    const game = await redis.hGetAll(gameKey)

    if (!Object.keys(game).length)
      return res.status(400).send({ error: 'Game does not exist' })
  } else {
    gameId = uuidv4()

    await redis.hSet(gameKey, 'player-1-token', token)

    console.log('creating a game')
  }

  res.json({ token, gameId })
})

router.get('/', (req, res) => {
  console.log('accessing root')

  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
