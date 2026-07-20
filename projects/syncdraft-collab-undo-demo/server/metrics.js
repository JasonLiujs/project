import client from "prom-client"

const register = new client.Registry()

client.collectDefaultMetrics({ register })

const activeConnectionsGauge = new client.Gauge({
  name: "ws_active_connections",
  help: "Number of active websocket connections",
})

register.registerMetric(activeConnectionsGauge)

export { register, activeConnectionsGauge }
