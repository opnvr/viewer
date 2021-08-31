/* global luxon */
/* eslint-env browser */

const MSGTYPE = {
  MOTION_START: 50
}

(function () {
  setInterval(() => {
    const span = document.querySelector('.infobar span.clock')
    span.innerHTML = luxon.DateTime.local().toFormat('HH:mm:ss')
  }, 1000)

  const lastMessage = new Map()
  function checkLastMessage () {
    lastMessage.forEach((value, id) => {
      const sinceLastMessage = Date.now() - value
      console.log(`Checking id ${id} @ ${value} (${sinceLastMessage}ms)`)

      buffers[id].showStalled(sinceLastMessage > 5000)
    })
    setTimeout(() => {
      checkLastMessage()
    }, 10000)
  }
  setTimeout(() => {
    checkLastMessage()
  }, 10000)

  const decoder = new TextDecoder()

  const styleSheet = document.head.querySelector('style').sheet
  let index = styleSheet.insertRule(`.box { height: ${(window.innerHeight - 30) / 3}px; }`)
  window.addEventListener('resize', () => {
    styleSheet.deleteRule(index)
    index = styleSheet.insertRule(`.box { height: ${(window.innerHeight - 30) / 3}px; }`)
  })

  function videoSource (id, selector) {
    let buffer
    let motion = false

    // Pre alloc buffer due updating delay
    const buffer_size = 5 * 1024 * 1024
    let buffer_index = 0
    let frag_mp4_buffer = new Uint8Array(buffer_size)
    const video = document.querySelector(selector + ' > video')
    const mediaSource = new MediaSource()

    // mediaSource.addEventListener('sourceended', function(e) { console.log('sourceended: ' + mediaSource.readyState); });
    // mediaSource.addEventListener('sourceclose', function(e) { console.log('sourceclose: ' + mediaSource.readyState); });
    // mediaSource.addEventListener('error', function(e) { console.log('error: ' + mediaSource.readyState); });

    video.src = window.URL.createObjectURL(mediaSource)
    video.playbackRate = 1.06

    mediaSource.addEventListener('sourceopen', function (e) {
      // console.log('sourceopen: ' + mediaSource.readyState);

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

    setInterval(() => {
      if (video.seekable.length) {
        const seekableEnd = video.seekable.end(video.seekable.length - 1)
        if (seekableEnd - video.currentTime > 3) {
          // console.log('Seek to end', seekableEnd- video.currentTime)
          video.currentTime = seekableEnd
        }
      }

      // console.log('buffer', { start: buffer.buffered.start(0), end: buffer.buffered.end(0), len: buffer.buffered.end(0) - buffer.buffered.start(0) })
      const bufferedLength = buffer.buffered.end(0) - buffer.buffered.start(0)
      if (!buffer.updating && bufferedLength > 60) {
        buffer.remove(buffer.buffered.start(0), buffer.buffered.start(0) + (bufferedLength / 2))
        // console.log('...remove half of the buffer', { start: buffer.buffered.start(0), end: buffer.buffered.end(0), len: buffer.buffered.end(0) - buffer.buffered.start(0) })
      }
    }, 5000)

    return {
      showStalled: show => {
        const span = document.querySelector(selector + ' > span.stalled')
        if (show) {
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

        if (msgtype === 51) { // Motion end
          console.log(`Camera ${id} motion end`)
          motion = false
          const span = document.querySelector(selector + ' > span.status')
          span.innerHTML = ''
          return
        }

        if (msgtype === 52) { // line cross start
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

        if (msgtype === 53) { // line cross end
          console.log(`Camera ${id} line cross end`)
          motion = false
          const span = document.querySelector(selector + ' > span.linecross')
          span.innerHTML = ''
          return
        }

        if (msgtype === 60) { // Notification
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

        if (msgtype === 70) {
          location.reload()
          return
        }

        if (msgtype === 99) {
          // ftyp_moov, reset sourceBuffer
          buffer_index = 0
          frag_mp4_buffer = new Uint8Array(buffer_size)
          if (buffer) {
            buffer.abort()
          }
        }

        if ((buffer_index + data.length) <= buffer_size) {
          frag_mp4_buffer.set(data, buffer_index)
          buffer_index = buffer_index + data.length

          if (!buffer.updating && mediaSource.readyState === 'open') {
            const appended = frag_mp4_buffer.slice(0, buffer_index)

            buffer.appendBuffer(appended)

            frag_mp4_buffer.fill(0)
            buffer_index = 0
          }
        }
      }
    }
  }

  const buffers = {
    2: videoSource(2, '.vp1'),
    3: videoSource(3, '.vp2'),
    4: videoSource(4, '.vp3'),
    5: videoSource(5, '.vp4'),
    6: videoSource(6, '.vp5'),
    7: videoSource(7, '.vp6'),
    8: videoSource(8, '.vp7'),
    9: videoSource(9, '.vp8')
  }

  function connect () {
    const websocket = new WebSocket('ws://' + document.location.hostname + ':8000')
    websocket.binaryType = 'arraybuffer'

    websocket.addEventListener('message', function (e) {
      const o = new Uint8Array(e.data)
      const id = o.slice(0, 1)[0]
      const msgtype = o.slice(1, 2)[0]
      // console.log('Header', { id, msgtype })
      const data = o.slice(2)

      lastMessage.set(id, Date.now())

      console.log('Got data', { id, msgtype, length: data.length })
      if (data.length) {
        buffers[id].handleData(msgtype, data)
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
      console.warn('Unable to play sound')
    })
}
