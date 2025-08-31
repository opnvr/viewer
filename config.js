
const rootLog = require('loglevel')

const joi = require('joi')

const schema = joi.object({
  sources: joi.array().items(joi.object({
    type: joi.string().lowercase().allow('rtsp', 'iframe').required(),
    notifications: joi.array().items(joi.object({
      type: joi.string().lowercase().allow('hikvision', 'frigate').required()
    }).unknown(true)).single().default([])
  }).unknown(true)).default([]),
  logging: joi.object({
    level: joi.string().allow('trace', 'debug', 'info', 'warn', 'error', 'silent').default('warn'),
    ffmpeg: joi.string().allow('quiet', 'panic', 'fatal', 'error', 'warning', 'info', 'verbose', 'debug', 'trace').default('warning')
  }),
  layout: joi.object({
    type: joi.string().lowercase().allow('3x2', '3x3', '2x2', '3x4', '3x5', '4x3').required(),
    grid: joi.array().items(joi.array().items(joi.number().integer().min(0).max(255).required()))
  }),
  mqtt: joi.object({
    uri: joi.string().uri().required(),
    authentication: joi.object({
      enable: joi.boolean().default(true),
      user: joi.string().required(),
      pass: joi.string().required()
    })
  })
}).required()

const fs = require('fs')
const YAML = require('yaml')

const file = fs.readFileSync('config.yaml', 'utf8')
const parsed = YAML.parse(file) || {}

rootLog.info('Raw', parsed)
const { value: config, error } = schema.validate(parsed, { abortEarly: false })
if (error) {
  throw new Error('Invalid configuration, ' + error.message)
}

if (config.logging && config.logging.level) {
  rootLog.setLevel(config.logging.level)
}
const log = require('loglevel').getLogger('config')

log.debug('Loaded config', config)

module.exports = config
