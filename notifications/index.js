const log = require('loglevel').getLogger('notifications')

const factory = () => {
  log.debug('Create')

  // Register notification type handlers
  const handlers = new Map()
  handlers.set('hikvision', require('./hikvision'))
  handlers.set('none', require('./none'))
  handlers.set('frigate', require('./frigate'))

  return {
    start
  }

  function start (config, sourceConfig, notificationConfig, server, mqttClient) {
    if (notificationConfig) {
      if (handlers.has(notificationConfig.type)) {
        handlers.get(notificationConfig.type)().start(config, sourceConfig, notificationConfig, server, mqttClient)
      } else {
        throw new Error(`Unhandled notification type ${notificationConfig.type}`)
      }
    }
  }
}

module.exports = factory
