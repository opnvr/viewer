const log = require('loglevel').getLogger('sources')

const factory = () => {
  log.debug('Create')

  // Register source type handlers
  const handlers = new Map()
  handlers.set('rtsp', require('./rtsp'))
  handlers.set('iframe', require('./iframe'))
  handlers.set('go2rtc', require('./go2rtc'))

  return {
    start
  }

  function start (config, sourceConfig, server) {
    if (handlers.has(sourceConfig.type)) {
      handlers.get(sourceConfig.type)(config, sourceConfig, server).start()
    } else {
      throw new Error(`Unhandled source type ${sourceConfig.type}`)
    }
  }
}

module.exports = factory
