const log = require('loglevel').getLogger('server')
const Koa = require('koa')
const websockify = require('koa-websocket')

const WebSocketOpen = 1

const factory = () => {
  log.debug('Create')

  const headers = {
  }

  const app = websockify(new Koa(), { perMessageDeflate: false })

  app.use(require('koa-static')('public'))

  app.use(async ctx => {
    ctx.body = 'Hello World'
  })

  app.ws.use(function (ctx, next) {
    ctx.websocket.sentHeaders = new Set()

    Object.getOwnPropertyNames(headers).forEach(id => {
      sendFTYPMOOV(id, ctx.websocket)
    })
  })

  return {
    start,
    broadcast,
    clearSent,
    setHeaders
  }

  function start () {
    app.listen(8000)
  }

  function sendFTYPMOOV (id, socket) {
    if (headers[id] && headers[id].ftyp && headers[id].moov) {
      log.debug('Websocket: Sending ftyp and moov segments to client.')

      const ftypmoov = new Uint8Array(headers[id].ftyp.length + headers[id].moov.length)
      ftypmoov.set(headers[id].ftyp, 0)
      ftypmoov.set(headers[id].moov, headers[id].ftyp.length)

      sendObject(socket, id, 99, ftypmoov)
      socket.sentHeaders.add(id)
    }
  }

  function setHeaders (id, ftyp, moov) {
    headers[id] = { ftyp, moov }
  }

  function clearSent () {

  }

  function broadcast (id, type, data) {
    log.debug('Broadcast to', app.ws.server.clients.size)
    app.ws.server.clients.forEach(function each (client) {
      if (client.readyState === WebSocketOpen) {
        if (!client.sentHeaders.has(id)) {
          sendFTYPMOOV(id, client)
        }

        sendObject(client, id, type, data)
      }
    })
  };

  function sendObject (socket, id, type, data) {
    log.debug('send object')
    const o = new Uint8Array(data.length + 2)
    o.set([id, type], 0)
    o.set(data, 2)
    socket.send(o)
  }
}

module.exports = factory
