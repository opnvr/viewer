var STREAM_PORT = process.argv[2] || 8081,
    WEBSOCKET_PORT = process.argv[3] || 8082;

var WebSocket = require('ws');
var net = require('net');
var bigInt = require("big-integer");
const { send } = require('process');

const MP4_FTYP = 1718909296;
const MP4_MOOV = 1836019574;

const headers = {
}
// var ftyp;
// var moov;

if (process.argv.length < 3) {
    console.log('Usage: node ws.js [<stream-port> <websocket-port>]');
    process.exit();
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

// Websocket Server
var socketServer = new WebSocket.Server({port: WEBSOCKET_PORT, perMessageDeflate: false});

socketServer.on('connection', function(socket) {
    console.log('Socket connected')

    socket.sendObject = (id, type, data) => {
        console.log('sendObject')
        // const b = new Blob([slug, data])

        var o = new Uint8Array(data.length + 2);
        o.set([id, type], 0)
        o.set(data, 2)
        socket.send(o);
    }
    socket.sentHeaders = new Set()

    Object.getOwnPropertyNames(headers).forEach(id => {
        sendFTYPMOOV(id, socket)
    })
});

function sendFTYPMOOV (id, socket) {
    if (headers[id] && headers[id].ftyp && headers[id].moov) {
        console.log('Websocket: Sending ftyp and moov segments to client.');

        var ftyp_moov = new Uint8Array(headers[id].ftyp.length + headers[id].moov.length);
        ftyp_moov.set(headers[id].ftyp, 0);
        ftyp_moov.set(headers[id].moov, headers[id].ftyp.length);

        socket.sendObject(id, 99, ftyp_moov);
        socket.sentHeaders.add(id)
    }
}

socketServer.broadcast = function(id, type, data) {
    socketServer.clients.forEach(function each(client) {
        
        if (client.readyState === WebSocket.OPEN) {
            if (!client.sentHeaders.has(id)) {
                sendFTYPMOOV(id, client)
            } 
            
            client.sendObject(id, type, data);
        }
    });
};

// // TCP Server
// net.createServer(function (tcpSocket) {
//     // Identify this client
//     tcpSocket.name = tcpSocket.remoteAddress + ":" + tcpSocket.remotePort;

//     console.log('TCP: Receiving data from ', tcpSocket.name);

//     tcpSocket.on('data', function (data) {
//         console.log('data received', data.byteLength)
//         if (!moov) {
//             console.log('Get ftyp & moov fragments')
//             initFragment(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

//             socketServer.clients.forEach(function each(client) {
//                 client.sentFTYP_MOOV = false
//             })
//         }
//         socketServer.broadcast(2, 100, data);
//     });

//     tcpSocket.on('close', function(code, message){
//         console.log('Clear ftyp & moov fragments')
//         ftyp = undefined
//         moov = undefined;
//     });

// }).listen(STREAM_PORT);

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
        console.log('data received', data.byteLength)
            if (!headers[camera] || !headers[camera].moov) {
                console.log('Get ftyp & moov fragments')
                initFragment(camera, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));

                socketServer.clients.forEach(function each(client) {
                    client.sentHeaders.clear()
                })
            }
            socketServer.broadcast(camera, 100, data);
    });
}

videoConsumer(2)
videoConsumer(3)
videoConsumer(4)
videoConsumer(5)
videoConsumer(6)
videoConsumer(7)
videoConsumer(8)


// console.log('Listening for incomming MP4 Stream on tcp://127.0.0.1:' + STREAM_PORT + '/');
console.log('Awaiting WebSocket connections on ws://127.0.0.1:' + WEBSOCKET_PORT + '/');
