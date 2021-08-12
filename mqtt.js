const log = require('loglevel').getLogger('mqtt')
const mqtt = require('mqtt')

const factory = (mqttConfig) => {
  return {
    start
  }

  function start () {
    // Listen for notifications
    const client = mqtt.connect('tcp://192.168.1.53', { username: 'iot', password: 'w4kz7nB6ACw5rp' })

    client.on('connect', function () {
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
      broadcast(camera, 60, data)
    })
  }
}

module.exports = factory
