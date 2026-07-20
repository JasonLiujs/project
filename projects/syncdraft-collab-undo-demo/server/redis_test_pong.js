import "dotenv/config"
import Redis from "ioredis"

console.log("REDIS_URL =", process.env.REDIS_URL)

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not defined")
}

const redis = new Redis(process.env.REDIS_URL, {
  tls: {},
})

redis
  .ping()
  .then(res => {
    console.log("✅ Redis PING response:", res)
    process.exit(0)
  })
  .catch(err => {
    console.error("❌ Redis connection failed:", err)
    process.exit(1)
  })
