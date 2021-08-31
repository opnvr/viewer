const { DateTime } = require('luxon')

const log = require('loglevel')
log.setDefaultLevel('warn')

const prefix = require('loglevel-plugin-prefix')
prefix.reg(log)
prefix.apply(log, {
  format (level, name, timestamp) {
    return `${timestamp} ${level.toUpperCase()} ${name}:`
  },
  timestampFormatter (date) {
    return DateTime.fromJSDate(date).toISO({ includeOffset: false })
  }
})

const config = require('./config')
log.info('Create')

const server = require('./server')(config.layout)
server.start()

// Send reload message after restart
setTimeout(() => {
  log.debug('Send reload message')
  server.broadcast(5, 70, new Uint8Array(1))
}, 10000)

const sources = require('./sources')()
const notifications = require('./notifications')()
config.sources.forEach(source => {
  sources.start(config, source, server)
  notifications.start(config, source, source.notifications, server)
})

const mqtt = require('./mqtt')(config.mqtt, server)
mqtt.start()
