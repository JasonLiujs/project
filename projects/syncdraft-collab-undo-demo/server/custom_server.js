// import http from 'http'
// import { WebSocketServer } from 'ws'
// import * as Y from 'yjs'
// import WebSocket from 'ws'

// const docs = new Map()

// function getYDoc(docName) {
//   const existing = docs.get(docName)
//   if (existing) return existing
//   const ydoc = new Y.Doc()
//   docs.set(docName, ydoc)
//   return ydoc
// }

// const server = http.createServer()
// const wss = new WebSocketServer({ server })

// wss.on('connection', (ws, req) => {
//   const docName = req.url.slice(1) || 'default'
//   const ydoc = getYDoc(docName)

//   ws.on('message', (message) => {
//     // Here you would handle Yjs sync messages
//     wss.clients.forEach(client => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(message)
//       }
//     })
//   })
// })

// server.listen(1234, () => {
//   console.log('Custom Yjs WebSocket server running on ws://localhost:1234')
// })


// server.js
// import { Server } from "@hocuspocus/server"
// import { Redis } from "@hocuspocus/extension-redis"

// const server = Server.configure({
//   port: 1234,
//   extensions: [
//     new Redis({
//       host: "127.0.0.1",  // or your Upstash/Redis Cloud host
//       port: 6379,         // Upstash gives you a URL instead
//     }),
//   ],
// })

// server.listen()
// console.log("🚀 Hocuspocus server with Redis running at ws://localhost:1234")


// server.js
// import "dotenv/config"
// import { Server } from "@hocuspocus/server"
// import { Redis } from "@hocuspocus/extension-redis"
// import express from "express"
// import { register, activeConnectionsGauge } from "./metrics.js"

// const {
//   HOCUSPOCUS_PORT = 1234,
//   REDIS_URL,
//   METRICS_PORT = 4000,
//   ALLOWED_ORIGINS = "",
//   METRICS_TOKEN,
// } = process.env

// console.log("REDIS_URL =", REDIS_URL)

// if (!REDIS_URL) {
//   throw new Error("❌ REDIS_URL not set")
// }

// const allowedOrigins = ALLOWED_ORIGINS
//   .split(",")
//   .map(o => o.trim())
//   .filter(Boolean)

// const server = new Server({
//   port: Number(HOCUSPOCUS_PORT),

//   extensions: [
//     new Redis({
//       url: REDIS_URL,
//       redisOptions: {
//         tls: {}, // ✅ CORRECT key for Upstash
//       },
//     }),
//   ],

//   async onConnect({ request }) {
//     const origin = request.headers.origin

//     if (
//       allowedOrigins.length &&
//       origin &&
//       !allowedOrigins.includes(origin)
//     ) {
//       throw new Error("❌ Origin not allowed")
//     }

//     activeConnectionsGauge.inc()
//   },

//   async onDisconnect() {
//     activeConnectionsGauge.dec()
//   },
// })

// server.listen()

// console.log(`🚀 Hocuspocus running at ws://0.0.0.0:${HOCUSPOCUS_PORT}`)

// // ───────────────────────── Metrics ─────────────────────────
// const app = express()

// app.get("/metrics", async (req, res) => {
//   const auth = req.headers.authorization

//   if (METRICS_TOKEN && auth !== `Bearer ${METRICS_TOKEN}`) {
//     return res.status(401).send("Unauthorized")
//   }

//   res.set("Content-Type", register.contentType)
//   res.end(await register.metrics())
// })

// app.listen(METRICS_PORT, () => {
//   console.log(`📊 Metrics at http://localhost:${METRICS_PORT}/metrics`)
// })




import "dotenv/config"
import { Server } from "@hocuspocus/server"
import { Redis as HocusRedis } from "@hocuspocus/extension-redis"
import Redis from "ioredis"
import express from "express"
import { register, activeConnectionsGauge } from "./metrics.js"

const {
  PORT,
  REDIS_URL,
  METRICS_PORT = 4000,
  ALLOWED_ORIGINS = "",
  METRICS_TOKEN,
} = process.env

const HOCUSPOCUS_PORT = PORT || 1234
console.log("REDIS_URL =", REDIS_URL)

if (!REDIS_URL) {
  throw new Error("❌ REDIS_URL not set")
}

// ─────────────────────────────────────────────
// ✅ CREATE REDIS CLIENT YOURSELF (CRITICAL)
// ─────────────────────────────────────────────
const redis = new Redis(REDIS_URL, {
  tls: {},                // ✅ enforced
  enableReadyCheck: false // ✅ required for Upstash
})

redis.on("connect", () => {
  console.log("✅ Connected to Upstash Redis")
})

redis.on("error", err => {
  console.error("❌ Redis error:", err)
})

// ─────────────────────────────────────────────
// ORIGIN SETUP
// ─────────────────────────────────────────────
const allowedOrigins = ALLOWED_ORIGINS
  .split(",")
  .map(o => o.trim())
  .filter(Boolean)

// ─────────────────────────────────────────────
// HOCUSPOCUS SERVER
// ─────────────────────────────────────────────
const server = new Server({
  port: Number(HOCUSPOCUS_PORT),

  extensions: [
    new HocusRedis({
      redis, // 🔥 inject the client
    }),
  ],

  async onConnect({ request }) {
    const origin = request.headers.origin

    if (
      allowedOrigins.length &&
      origin &&
      !allowedOrigins.includes(origin)
    ) {
      throw new Error("Origin not allowed")
    }

    activeConnectionsGauge.inc()
  },

  async onDisconnect() {
    activeConnectionsGauge.dec()
  },
})

server.listen()

console.log(`🚀 Hocuspocus running at ws://0.0.0.0:${HOCUSPOCUS_PORT}`)

// ─────────────────────────────────────────────
// METRICS
// ─────────────────────────────────────────────
const app = express()

app.get("/metrics", async (req, res) => {
  const auth = req.headers.authorization

  if (METRICS_TOKEN && auth !== `Bearer ${METRICS_TOKEN}`) {
    return res.status(401).send("Unauthorized")
  }

  res.set("Content-Type", register.contentType)
  res.end(await register.metrics())
})

app.listen(METRICS_PORT, () => {
  console.log(`📊 Metrics at http://localhost:${METRICS_PORT}/metrics`)
})
