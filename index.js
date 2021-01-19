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

        if (len == 1)
        {
            // Extended size
            len = getUint64(dataView, offset + 8);
        }

        headers[camera] = headers[camera] || {}
        if (type === MP4_FTYP) {
            console.log('Got MP4_FTYP', offset, len)
            headers[camera].ftyp = new Uint8Array(dataView.buffer.slice(offset, len));
        } else if (type === MP4_MOOV) {
            console.log('Got MP4_MOOV', offset, len)
            headers[camera].moov = new Uint8Array(dataView.buffer.slice(offset, len));
            break;
        }

        offset = offset + len;
    }
    console.log('....finished parseMp4')
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
                console.log('Get ftyp & moov fragments')
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
        console.log('Delimter', data);

        if (data.indexOf('<EventNotificationAlert') > -1) {
            parser.parseString(data, (err, result) => {
                if(err) {
                    console.error('Failed', err)
                }
                if(result) {
                    console.log(camera, result.EventNotificationAlert.eventType, result.EventNotificationAlert.eventState)
                    if(result.EventNotificationAlert && result.EventNotificationAlert.eventType === 'VMD') {
                        
                        if(result.EventNotificationAlert.eventState === 'active') {
                            broadcast(camera, 50, new Uint8Array(1));
                        } else {
                            broadcast(camera, 51, new Uint8Array(1));
                        }
                        
                    }
                    
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
function videoMonitorX(camera) {
    const agent = new http.Agent({keepAlive: true, });
    needle
        .get(`http://192.168.1.2${camera.toString().padStart(2, '0')}/ISAPI/Event/notification/alertStream`, { 
            username: 'admin', 
            password: 'Milly Lola 810', 
            auth: 'digest',
            agent
        })
        .on('response', response => {
            console.log('Response')

            response.connection.setKeepAlive(true, 1000)
            // NetKeepAlive.setKeepAliveInterval(response.connection,5000)	// sets TCP_KEEPINTVL to 5s
		    // NetKeepAlive.setKeepAliveProbes(response.connection, 12)	// 60s and kill the connection.

            response.on('close', a => {
                console.log('************* close', a)
            })
            response.on('finish', a => {
                console.log('************* finish', a)
            })
            response.on('aborted', a => {
                console.log('************* aborted', a)
            })
            response.on('abort', a => {
                console.log('************* abort', a)
            })
            response.on('connect', a => {
                console.log('************* connect', a)
            })
            response.on('continue', a => {
                console.log('************* continue', a)
            })
            response.on('information', a => {
                console.log('************* information', a)
            })
            response.on('socket', a => {
                console.log('************* socket', a)
            })
            response.on('timeout', a => {
                console.log('************* timeout', a)
            })
            response.on('upgrade', a => {
                console.log('************* upgrade', a)
            })
            response.on('data', buffer => {
                console.log('----------------------------------------------------'+ camera)
                const originalData = buffer.toString('utf8')
                console.log('response data', originalData)
    
                // Strip off lines that dont start with a xml <
                const data = originalData.replace(regex, '<')
                // console.log('response data', data)
    
                if(data.indexOf('<EventNotificationAlert') > -1) {
                    parser.parseString(data, (err, result) => {
                        if(err) {
                            console.error('Failed', err)
                        }
                        if(result) {
                            console.log(camera, result.EventNotificationAlert.eventType, result.EventNotificationAlert.eventState)
                            if(result.EventNotificationAlert && result.EventNotificationAlert.eventType === 'VMD') {
                                
                                if(result.EventNotificationAlert.eventState === 'active') {
                                    broadcast(camera, 50, new Uint8Array(1));
                                } else {
                                    broadcast(camera, 51, new Uint8Array(1));
                                }
                                
                            }
                            
                        } 
                    })
                } else {
                    console.log('No data found', originalData)
                }
            })
        })
        .on('done', (err, resp) => {
            if(err) {
                console.error('error = ', err)
            }
            console.log('resp = ', resp)
        })
        .on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
        })
        .on('timeout', (e) => {
            console.error(`timeout: ${e.message}`);
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