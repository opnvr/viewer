const baselog = require('loglevel').getLogger('notifications:none-base')

const factory = () => {
  baselog.info('Create')

  return {
    start
  }

  function start () {
    // Do nothing
  }
}

module.exports = factory
