const baselog = require('loglevel').getLogger('notifications:hikvision-base')
const http = require('http')
const xml2js = require('xml2js')
const parser = new xml2js.Parser({ explicitArray: false })
const regex = /^.*?</s
const needle = require('needle')
const DelimiterStream = require('delimiter-stream')
const joi = require('joi')

const schema = joi.object({
  type: joi.string().lowercase().allow('hikvision').required(),
  uri: joi.string().uri().required(),
  authentication: joi.object({
    enable: joi.boolean().default(true),
    user: joi.string().required(),
    pass: joi.string().required()
  })
})

const factory = () => {
  baselog.info('Create')

  return {
    start
  }

  function start (config, sourceConfig, itemConfig, server) {
    const log = require('loglevel').getLogger('notifications:hikvision-' + sourceConfig.id)
    log.info('Start')

    const inheritedConfig = {
      uri: convertToHttp(sourceConfig.uri), // convert rtsp urls used by the source to http for the hikvision notification
      authentication: sourceConfig.authentication,
      ...itemConfig
    }

    const { value: notificationConfig, error } = schema.validate(inheritedConfig)
    if (error) {
      throw new Error('Invalid configuration for notifications:hikvision, ' + error.message)
    }

    log.debug('Loaded config', notificationConfig)

    const delimiterstream = new DelimiterStream({
      delimiter: '--boundary'
    })

    delimiterstream.on('data', function (chunk) {
      
      const originalData = chunk.toString('utf8')
      const data = originalData.replace(regex, '<')

      if (data.indexOf('<EventNotificationAlert') > -1) {
        
        parser.parseString(data, (err, result) => {
          if (err) {
            log.error('Failed', err)
          }
          if (result) {
            
            if (result.EventNotificationAlert.eventState !== 'inactive' && result.EventNotificationAlert.eventType !== 'videoloss') {
              log.debug(sourceConfig.id, result.EventNotificationAlert.eventType, result.EventNotificationAlert.eventState)
              // log.debug('Data', data)
            }

            if (result.EventNotificationAlert && result.EventNotificationAlert.eventType === 'VMD') {
              log.info('data', result)
              if (result.EventNotificationAlert.eventState === 'active') {
                server.broadcast(sourceConfig.id, 50, new Uint8Array(1))
              } else {
                server.broadcast(sourceConfig.id, 51, new Uint8Array(1))
              }
            }

            if (result.EventNotificationAlert && result.EventNotificationAlert.eventType === 'linedetection') {
              if (result.EventNotificationAlert.eventState === 'active') {
                server.broadcast(sourceConfig.id, 52, new Uint8Array(1))
              } else {
                server.broadcast(sourceConfig.id, 53, new Uint8Array(1))
              }
            }

            // fielddetection
          }
        })
      }
    })

    const agent = new http.Agent({ keepAlive: true })
    const url = new URL('/ISAPI/Event/notification/alertStream', notificationConfig.uri)
    const options = {
      auth: 'digest',
      agent,
      parse: false
    }

    if (notificationConfig.authentication && notificationConfig.authentication.enable) {
      options.username = notificationConfig.authentication.user
      options.password = notificationConfig.authentication.pass
    }

    const stream = needle.get(url.href, options)

    stream.pipe(delimiterstream)

    stream.on('done', function (err) {
      if (err) log.debug('An error ocurred: ' + err.message)
      else log.debug('Great success!')
    })
  }

  function convertToHttp (uri) {
    const url = new URL(uri.replace('rtsp://', 'http://'))
    url.protocol = 'http'
    url.pathname = ''
    url.search = ''

    return url.href
  }
}

module.exports = factory
