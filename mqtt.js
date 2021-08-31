const log = require('loglevel').getLogger('mqtt')
const mqtt = require('mqtt')

const factory = (mqttConfig, server) => {
  log.info('Create')

  return {
    start
  }

  function start () {
    // Listen for notifications
    const options = {}
    if (mqttConfig.authentication && mqttConfig.authentication.enable) {
      options.username = mqttConfig.authentication.user
      options.password = mqttConfig.authentication.pass
    }
    const client = mqtt.connect(mqttConfig.uri, options)

    client.on('connect', function () {
      log.info('Connected')

      client.subscribe('notify/cam/+', err => {
        if (err) {
          log.error('Failed to subscribe to notify/cam/+', err)
        } else {
          log.info('Subscribed to notify/cam/+')
        }
      })
    })

    client.on('message', (topic, message) => {
      const camera = topic.replace('notify/cam/', '')
      log.debug(topic, camera, message.toString())

      const data = new Uint8Array(message)
      server.broadcast(camera, 60, data)
    })
  }
}

module.exports = factory
