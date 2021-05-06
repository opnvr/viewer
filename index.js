const Koa = require('koa');
const websockify = require('koa-websocket');
const bigInt = require("big-integer");

const WebSocketOpen = 1

const app = websockify(new Koa(), {perMessageDeflate: false});

app.use(require('koa-static')('public'));

app.use(async ctx => {
  ctx.body = 'Hello World';
});

app.ws.use(function(ctx, next) {
    ctx.websocket.sentHeaders = new Set()

    Object.getOwnPropertyNames(headers).forEach(id => {
        sendFTYPMOOV(id, socket)
    })
})

app.listen(8000);

const MP4_FTYP = 1718909296;
const MP4_MOOV = 1836019574;
const MP4_MDAT = 1835295092;

const headers = {
}

function binStringToHex2(s) {
    var s2 = new Array(s.length), c;

    for (var i = 0, l = s.length; i < l; ++i) {
        c = s.charCodeAt(i);
        s2[i * 2] = (c >> 4).toString(16);
        s2[i * 2 + 1] = (c & 0xF).toString(16);
    }

    return String.prototype.concat.apply('', s2);
}

function getUint64(data, offset){
    var dat = data.getUTF8String(offset, 8);
    var str = '0x' + binStringToHex2(dat);

    return bigInt(str);
}

function parseMP4(camera, dataView, offset, size)
{
    console.log('parseMP4', offset, size)
    while (offset < size)
    {
        var len = dataView.getUint32(offset);
        var type = dataView.getInt32(offset + 4);
        console.log('...', len, type)

        if (len == 1)
        {
            // Extended size
            console.log('entended size')
            len = getUint64(dataView, offset + 8);
        }

        headers[camera] = headers[camera] || {}
        if (type === MP4_FTYP) {
            console.log(`CAM${camera.toString().padStart(2, '0')} Got MP4_FTYP`, offset, len)
            headers[camera].ftyp = new Uint8Array(dataView.buffer.slice(offset, offset + len));
            // console.log('FTYP', headers[camera].ftyp.buffer)
        } else if (type === MP4_MOOV) {
            console.log(`CAM${camera.toString().padStart(2, '0')} Got MP4_MOOV`, offset, len)
            headers[camera].moov = new Uint8Array(dataView.buffer.slice(offset, offset + len));
            // console.log('MOOV', headers[camera].moov.buffer)
        }

        offset = offset + len;
    }
    console.log('------finished parseMp4')
}

function initFragment(camera, buffer) {
    var dataView = new DataView(buffer);

    parseMP4(camera, dataView, 0, buffer.byteLength);
}

function sendFTYPMOOV (id, socket) {
    if (headers[id] && headers[id].ftyp && headers[id].moov) {
        console.log('Websocket: Sending ftyp and moov segments to client.');

        var ftyp_moov = new Uint8Array(headers[id].ftyp.length + headers[id].moov.length);
        ftyp_moov.set(headers[id].ftyp, 0);
        ftyp_moov.set(headers[id].moov, headers[id].ftyp.length);

        sendObject(socket, id, 99, ftyp_moov);
        socket.sentHeaders.add(id)
    }
}

function broadcast (id, type, data) {
    app.ws.server.clients.forEach(function each(client) {
        if (client.readyState === WebSocketOpen) {
            if (!client.sentHeaders.has(id)) {
                sendFTYPMOOV(id, client)
            }

            sendObject(client, id, type, data);
        }
    });
};

function sendObject (socket, id, type, data) {
    var o = new Uint8Array(data.length + 2);
    o.set([id, type], 0)
    o.set(data, 2)
    socket.send(o);
}

const ffmpeg = require('fluent-ffmpeg')
function videoConsumer (camera) {
    const command = ffmpeg(`rtsp://admin:Milly%20Lola%20810@192.168.1.2${camera.toString().padStart(2, '0')}:554/Streaming/Channels/102`)
    .noAudio()
    .videoCodec('copy')
    .format('mp4')
    .outputOptions('-movflags omit_tfhd_offset+frag_keyframe+default_base_moof')
    .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
      })
    .on('end', function() {
      console.log('Processing finished !');
    });
    const ffstream = command.pipe()
    ffstream.on('data', function(data) {
            if (!headers[camera] || !headers[camera].moov) {
                // console.log('Get ftyp & moov fragments')
                initFragment(camera, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

                app.ws.server.clients.forEach(function each(client) {
                    client.sentHeaders.clear()
                })
            }
            broadcast(camera, 100, data);
    });
}

videoConsumer(2)
videoConsumer(3)
videoConsumer(4)
videoConsumer(5)
videoConsumer(6)
videoConsumer(7)
videoConsumer(8)
videoConsumer(9)

const http = require('http');
var	xml2js = require('xml2js');
var	parser = new xml2js.Parser({ explicitArray: false });
const regex = /^.*?</s;
const needle = require('needle');
const DelimiterStream = require('delimiter-stream');

function videoMonitor(camera) {
    const delimiterstream = new DelimiterStream({
        delimiter: '--boundary'
    })

    delimiterstream.on('data', function(chunk) {
        const originalData = chunk.toString('utf8')
        const data = originalData.replace(regex, '<')

        if (data.indexOf('<EventNotificationAlert') > -1) {
            parser.parseString(data, (err, result) => {
                if(err) {
                    console.error('Failed', err)
                }
                if(result) {
                    if (result.EventNotificationAlert.eventState != 'inactive' && result.EventNotificationAlert.eventType !== 'videoloss') {
                      // console.log(camera, result.EventNotificationAlert.eventType, result.EventNotificationAlert.eventState)
                      // console.log('Data', data)
                    }

                    if(result.EventNotificationAlert && result.EventNotificationAlert.eventType === 'VMD') {
                        if(result.EventNotificationAlert.eventState === 'active') {
                            broadcast(camera, 50, new Uint8Array(1));
                        } else {
                            broadcast(camera, 51, new Uint8Array(1));
                        }
                    }

                    if(result.EventNotificationAlert && result.EventNotificationAlert.eventType === 'linedetection') {
                        if(result.EventNotificationAlert.eventState === 'active') {
                            broadcast(camera, 52, new Uint8Array(1));
                        } else {
                            broadcast(camera, 53, new Uint8Array(1));
                        }
                    }

                    // fielddetection
                }
            })
        }
    });

    const agent = new http.Agent({keepAlive: true, });
    const stream = needle
        .get(`http://192.168.1.2${camera.toString().padStart(2, '0')}/ISAPI/Event/notification/alertStream`, {
            username: 'admin',
            password: 'Milly Lola 810',
            auth: 'digest',
            agent,
            parse: false
        })

    stream.pipe(delimiterstream)
    // stream.on('readable', function() {
    //     var chunk;
    //     while (chunk = this.read()) {
    //         const originalData = chunk.toString('utf8')
    //         console.log('response data', originalData)
    //     }
    //     });

    stream.on('done', function(err) {
        if (err) console.log('An error ocurred: ' + err.message);
        else console.log('Great success!');
        })
}

videoMonitor(2)
videoMonitor(3)
videoMonitor(4)
videoMonitor(5)
videoMonitor(6)
videoMonitor(7)
videoMonitor(8)
videoMonitor(9)

// Listen for notifications
var mqtt = require('mqtt')
var client  = mqtt.connect('tcp://192.168.1.53', { username: 'iot', password: 'w4kz7nB6ACw5rp' })
 
client.on('connect', function () {
  client.subscribe('notify/cam/+', function (err) {
    console.log('Subscribed to notify/cam/+')
  })
})
 
client.on('message', function (topic, message) {  
  const camera = topic.replace('notify/cam/', '')
  console.log(topic, camera, message.toString())

  const data = new Uint8Array(message)
  broadcast(camera, 60, data);
})