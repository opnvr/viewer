const joi = require('joi')

const schema = joi.object({
  type: joi.string().equal('go2rtc').required(),
  id: joi.number().integer().min(1).max(255).required(),
  uri: joi.string().uri().required(),
}).unknown(true) // Allow other types of config for this source

const factory = (config, sourceConfig, server) => {
  const log = require('loglevel').getLogger('sources:go2rtc-' + sourceConfig.id)

  log.debug('Create')

  const { value: rtspConfig, error } = schema.validate(sourceConfig)
  if (error) {
    throw new Error('Invalid configuration for sources:go2rtc, ' + error.message)
  }

  log.debug('Loaded config', rtspConfig)

  return {
    start
  }

  function start () {
    log.debug('Started')
  }
}

module.exports = factory
