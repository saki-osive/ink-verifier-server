import { SERVER_HOST, SERVER_PORT } from './config'
import log from './log'
import onReady from './server/ready'
import Server from './server/server'

const server = await Server({
  logger: log
})

server.ready(err => {
  if (err) {
    server.log.error(err)
    throw err
  }
  onReady(server)
})

const start = async () => {
  try {
    await server.listen({
      port: SERVER_PORT,
      host: SERVER_HOST
    })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
