const log = require('loglevel').getLogger('notifications')

const factory = () => {
  log.debug('Create')

  // Register notification type handlers
  const handlers = new Map()
  handlers.set('hikvision', require('./hikvision'))

  return {
    start
  }

  function start (config, sourceConfig, notificationConfig, server) {
    if (notificationConfig) {
      if (handlers.has(notificationConfig.type)) {
        handlers.get(notificationConfig.type)().start(config, sourceConfig, notificationConfig, server)
      } else {
        throw new Error(`Unhandled notification type ${notificationConfig.type}`)
      }
    }
  }
}

module.exports = factory
