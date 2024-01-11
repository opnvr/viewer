/* global luxon */
/* eslint-env browser */

const MSGTYPE = {
  MOTION_START: 50,
  MOTION_END: 51,
  LINECROSS_START: 52,
  LINECROSS_END: 53,
  NOTIFICATION: 60,
  RELOAD: 70,
  FTYP_MOOV: 99,
  MP4_DATA: 100
};

(function () {
  setInterval(() => {
    const span = document.querySelector('.infobar span.clock')
    span.innerHTML = luxon.DateTime.local().toFormat('HH:mm:ss')
  }, 1000)

  const sources = new Map()

  const lastMessage = new Map()
  function checkLastMessage () {
    lastMessage.forEach((value, id) => {
      const sinceLastMessage = Date.now() - value
      console.log(`Checking id ${id} @ ${value} (${sinceLastMessage}ms)`)

      const source = sources.get(id)
      if (source) {
        source.showStalled(sinceLastMessage > 5000)
      }
    })
    setTimeout(() => {
      checkLastMessage()
    }, 10000)
  }
  setTimeout(() => {
    checkLastMessage()
  }, 10000)

  const decoder = new TextDecoder()

  function videoSource (id, selector) {
    let buffer
    let motion = false

    // Pre alloc buffer due updating delay
    const bufferSize = 5 * 1024 * 1024
    let bufferIndex = 0
    let fragMp4Buffer = new Uint8Array(bufferSize)
    const video = document.querySelector(selector + ' > video')
    if (!video) {
      return
    }
    const mediaSource = new MediaSource()

    video.src = window.URL.createObjectURL(mediaSource)
    video.playbackRate = 1.06

    mediaSource.addEventListener('sourceopen', function (e) {
      buffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"')
      buffer.mode = 'sequence'
    }, false)

    console.log('Play')
    video.play()
      .then(a => {
        console.log('Playing', a)
      })
      .catch(err => {
        console.error('Failed', err)
      })

    // Set interval to keep making sure video player is as close to the end ie realtime as possible
    setInterval(() => {
      if (video.seekable.length) {
        const seekableEnd = video.seekable.end(video.seekable.length - 1)
        if (seekableEnd - video.currentTime > 3) {
          video.currentTime = seekableEnd
        }
      }

      if (buffer && buffer.buffered && buffer.buffered.length) {
        const bufferedLength = buffer.buffered.end(0) - buffer.buffered.start(0)
        if (!buffer.updating && bufferedLength > 60) {
          buffer.remove(buffer.buffered.start(0), buffer.buffered.start(0) + (bufferedLength / 2))
        }
      }
    }, 5000)

    return {
      showStalled: show => {
        const span = document.querySelector(selector + ' > span.stalled')
        if (show) {
          console.log('showStalled')
          span.style.display = 'block'
        } else {
          span.style.display = 'none'
        }
      },

      handleData: (msgtype, data) => {
        console.log('handleData', selector, msgtype)

        if (msgtype === MSGTYPE.MOTION_START) { // Motion start
          console.log(`Camera ${id} motion start`)
          if (!motion) {
            motion = true
            setTimeout(() => {
              const span = document.querySelector(selector + ' > span.status')
              span.innerHTML = ''
              motion = false
            }, 10000)
            playSound('motion.mp3', 0.25)
            const span = document.querySelector(selector + ' > span.status')
            span.innerHTML = 'MOTION'
          }
          return
        }

        if (msgtype === MSGTYPE.MOTION_END) { // Motion end
          console.log(`Camera ${id} motion end`)
          motion = false
          const span = document.querySelector(selector + ' > span.status')
          span.innerHTML = ''
          return
        }

        if (msgtype === MSGTYPE.LINECROSS_START) { // line cross start
          console.log(`Camera ${id} line cross start`)
          if (!motion) {
            motion = true
            setTimeout(() => {
              const span = document.querySelector(selector + ' > span.linecross')
              span.innerHTML = ''
              motion = false
            }, 10000)
            playSound('linecross.mp3')
            const span = document.querySelector(selector + ' > span.linecross')
            span.innerHTML = 'LINE'
          }
          return
        }

        if (msgtype === MSGTYPE.LINECROSS_END) { // line cross end
          console.log(`Camera ${id} line cross end`)
          motion = false
          const span = document.querySelector(selector + ' > span.linecross')
          span.innerHTML = ''
          return
        }

        if (msgtype === MSGTYPE.NOTIFICATION) { // Notification
          setTimeout(() => {
            const span = document.querySelector(selector + ' > span.notify')
            span.style.display = 'none'
          }, 10000)
          const span = document.querySelector(selector + ' > span.notify')

          const payload = JSON.parse(decoder.decode(data))

          span.innerHTML = payload.message
          span.style.display = 'block'

          console.log(payload)
          playSound('mqtt.mp3')

          return
        }

        if (msgtype === MSGTYPE.RELOAD) {
          location.reload()
          return
        }

        if (msgtype === MSGTYPE.FTYP_MOOV) {
          // ftyp_moov, reset sourceBuffer
          bufferIndex = 0
          fragMp4Buffer = new Uint8Array(bufferSize)
          if (buffer) {
            buffer.abort()
          }
        }

        if ((bufferIndex + data.length) <= bufferSize) {
          fragMp4Buffer.set(data, bufferIndex)
          bufferIndex = bufferIndex + data.length

          if (buffer && !buffer.updating && mediaSource.readyState === 'open') {
            const appended = fragMp4Buffer.slice(0, bufferIndex)

            buffer.appendBuffer(appended)

            fragMp4Buffer.fill(0)
            bufferIndex = 0
          }
        }
      }
    }
  }

  function startVideoSource (postion, id) {
    if (id > 0) {
      sources.set(id, videoSource(id, '.vp' + postion))
    }
  }

  fetch('/api/config')
    .then(result => {
      console.log('data', result)
      return result.json()
        .then(data => {
          if (data.grid) {
            console.log('grid', data)

            let rows = 0
            let cols = 0
            switch(data.type) {
              case '2x2':
                rows = 2
                cols = 2
                startVideoSource(1, data.grid[0][0])
                startVideoSource(2, data.grid[0][1])

                startVideoSource(3, data.grid[1][0])
                startVideoSource(4, data.grid[1][1])
                break
              case '3x3':
                rows = 3
                cols = 3

                startVideoSource(1, data.grid[0][0])
                startVideoSource(2, data.grid[0][1])
                startVideoSource(3, data.grid[0][2])

                startVideoSource(4, data.grid[1][0])
                startVideoSource(5, data.grid[1][1])
                startVideoSource(6, data.grid[1][2])

                startVideoSource(7, data.grid[2][0])
                startVideoSource(8, data.grid[2][1])
                startVideoSource(9, data.grid[2][2])
                break
            }

            function computeRowHeight() {
              const windowRatio = window.innerWidth / window.innerHeight

              let rowHeight = (window.innerHeight - 35) / rows
              if(windowRatio < 1) {
                // Add extra 40% height
                rowHeight = (window.innerWidth / cols) * windowRatio * 1.4
              }
              console.log('rows', { rows, rowHeight, windowRatio })
              return rowHeight
            }

            const styleSheet = document.head.querySelector('style').sheet
            let index = styleSheet.insertRule(`.box { height: ${computeRowHeight()}px; }`)
            window.addEventListener('resize', () => {
              styleSheet.deleteRule(index)
              index = styleSheet.insertRule(`.box { height: ${computeRowHeight()}px; }`)
            })
          }
        })
    })

  function connect () {
    const websocket = new WebSocket('ws://' + document.location.hostname + ':8000')
    websocket.binaryType = 'arraybuffer'

    websocket.addEventListener('message', function (e) {
      const o = new Uint8Array(e.data)
      const id = o.slice(0, 1)[0]
      const msgtype = o.slice(1, 2)[0]
      const data = o.slice(2)

      lastMessage.set(id, Date.now())

      console.log('Got data', { id, msgtype, length: data.length })
      if (data.length) {
        const source = sources.get(id)
        if (source) {
          source.handleData(msgtype, data)
        }
      }
    }, false)

    websocket.addEventListener('open', function (event) {
      console.log('WS Connected!')
    })

    websocket.addEventListener('close', function (e) {
      console.log('WS Disconnected!, retry in 5 secs')
      setTimeout(() => connect(), 5000)
    })
  }

  connect()

  // reload page every night
  const today = new Date()
  const tommorow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const timeToMidnight = tommorow - today
  setTimeout(() => location.reload(), timeToMidnight)
})()

function playSound (file, volume) {
  const audio = new Audio(file)
  audio.volume = volume || 1
  audio.play()
    .catch(err => {
      console.warn('Unable to play sound', err)
    })
}
