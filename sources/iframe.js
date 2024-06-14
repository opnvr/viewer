const joi = require('joi')

const schema = joi.object({
  type: joi.string().equal('iframe').required(),
  id: joi.number().integer().min(1).max(255).required(),
  uri: joi.string().uri().required(),
  authentication: joi.object({
    enable: joi.boolean().default(true),
    user: joi.string().required(),
    pass: joi.string().required()
  })
}).unknown(true) // Allow other types of config for this source

const factory = (config, sourceConfig, server) => {
  const log = require('loglevel').getLogger('sources:iframe-' + sourceConfig.id)

  log.debug('Create')

  const { value: rtspConfig, error } = schema.validate(sourceConfig)
  if (error) {
    throw new Error('Invalid configuration for sources:iframe, ' + error.message)
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
