const baselog = require('loglevel').getLogger('notifications:frigate-base')
const joi = require('joi')

const schema = joi.object({
  type: joi.string().lowercase().allow('frigate').required(),
  camera: joi.string().required()
})

const factory = () => {
  baselog.info('Create')

  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  return {
    start
  }

  function start (config, sourceConfig, itemConfig, server, mqttClient) {
    const log = require('loglevel').getLogger('notifications:frigate-' + sourceConfig.id)
    log.debug('Start')

    const inheritedConfig = {
      //...sourceConfig,
      ...itemConfig
    }

    const { value: notificationConfig, error } = schema.validate(inheritedConfig)
    if (error) {
      throw new Error('Invalid configuration for notifications:frigate, ' + error.message)
    }

    log.debug('Loaded config', notificationConfig)

    mqttClient.subscribe('frigate/events', err => {
      if(err) {
        log.error('Failed to subscribe to frigate/events', err)
      } else {
        log.info('Subscribed to frigate/events')
      }
    })

    mqttClient.on('message', (topic, message) => {
      if (topic.includes('frigate/events')) {
        const data = JSON.parse(decoder.decode(message))
        if (data.after.camera === notificationConfig.camera && !data.after.stationary) {
          log.info('frigate message', data.after)

          const payload = {
            id: data.after.id,
            camera: data.after.camera,
            startTime: data.after.start_time,
            endTime: data.after.end_time,
            score: data.after.score,
            box: data.after.box,
            label: data.after.label
          }

          const a = encoder.encode(JSON.stringify(payload))
          //log.info('frigate payload', payload, sourceConfig.id, a)frig
          server.broadcast(sourceConfig.id, 61, a)
        }
      }
    })

    //setTimeout(() => {
    //  // Dummy test
    //  const b = encoder.encode(JSON.stringify({
    //    id: '1718612388.110199-modt9b',
    //    camera: 'CAM06-CouncilStrip',
    //    startTime: 1718612388.110199,
    //    endTime: null, //1718612404.307773,
    //    score: 0.5234375,
    //    box: [ 250, 50, 66666600 ],
    //    label: 'car'
    //  }))
    //  log.info('Dummy send')
    //  server.broadcast(6, 61, b)
    //}, 15000)

  }
}

module.exports = factory
