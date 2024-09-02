const ffmpeg = require("fluent-ffmpeg");
const joi = require("joi");
const bigInt = require("big-integer");

const schema = joi
  .object({
    type: joi.string().equal("rtsp").required(),
    id: joi.number().integer().min(1).max(255).required(),
    uri: joi.string().uri().required(),
    authentication: joi.object({
      enable: joi.boolean().default(true),
      user: joi.string().required(),
      pass: joi.string().required(),
    }),
  })
  .unknown(true); // Allow other types of config for this source

const MP4_FTYP = 1718909296;
const MP4_MOOV = 1836019574;
// const MP4_MDAT = 1835295092

const factory = (config, sourceConfig, server) => {
  const log = require("loglevel").getLogger("sources:rtsp-" + sourceConfig.id);

  let ftypAtom;
  let moovAtom;

  log.debug("Create");

  const { value: rtspConfig, error } = schema.validate(sourceConfig);
  if (error) {
    throw new Error("Invalid configuration for sources:rtsp, " + error.message);
  }

  log.debug("Loaded config", rtspConfig);

  return {
    start,
  };

  function start() {
    const camUrl = new URL("", rtspConfig.uri);
    if (rtspConfig.authentication && rtspConfig.authentication.enable) {
      camUrl.username = rtspConfig.authentication.user;
      camUrl.password = rtspConfig.authentication.pass;
    }

    log.debug("Camera Uri", camUrl.href);

    const command = ffmpeg()
      .addOption(`-loglevel ${config.logging.ffmpeg}`)
      .input(camUrl.href)
      .noAudio()
      .videoCodec("copy")
      .format("mp4")
      .outputOptions(
        "-movflags empty_moov+omit_tfhd_offset+frag_keyframe+default_base_moof",
      )
      .on("error", function (err) {
        log.error("An error occurred: " + err.message);
      })
      .on("stderr", function (stderrLine) {
        log.error("Stderr output: " + stderrLine);
      })
      .on("end", function (stdout, stderr) {
        log.info(`End: ${stdout} ${stderr}`);
      });

    const ffstream = command.pipe();

    ffstream.on("data", function (data) {
      if (!moovAtom) {
        // log.debug('Get ftyp & moov fragments')
        initFragment(
          rtspConfig.id,
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        );

        if (ftypAtom && moovAtom) {
          server.setHeaders(rtspConfig.id, ftypAtom, moovAtom);
        }

        // app.ws.server.clients.forEach(function each (client) {
        //   client.sentHeaders.clear()
        // })
        // server.clearSent(rtspConfig.id)
      }
      server.broadcast(rtspConfig.id, 100, data);
    });
  }

  function initFragment(camera, buffer) {
    const dataView = new DataView(buffer);

    parseMP4(camera, dataView, 0, buffer.byteLength);
  }

  function parseMP4(camera, dataView, offset, size) {
    log.debug("parseMP4", offset, size);
    while (offset < size) {
      let len = dataView.getUint32(offset);
      const type = dataView.getInt32(offset + 4);
      log.debug("...", len, type);

      if (len === 1) {
        // Extended size
        log.debug("entended size");
        len = getUint64(dataView, offset + 8);
      }

      if (type === MP4_FTYP) {
        log.debug(
          `CAM${camera.toString().padStart(2, "0")} Got MP4_FTYP`,
          offset,
          len,
        );
        ftypAtom = new Uint8Array(dataView.buffer.slice(offset, offset + len));
      } else if (type === MP4_MOOV) {
        log.debug(
          `CAM${camera.toString().padStart(2, "0")} Got MP4_MOOV`,
          offset,
          len,
        );
        moovAtom = new Uint8Array(dataView.buffer.slice(offset, offset + len));
      }

      offset = offset + len;
    }
    log.debug("------finished parseMp4");
  }

  function getUint64(data, offset) {
    const dat = data.getUTF8String(offset, 8);
    const str = "0x" + binStringToHex2(dat);

    return bigInt(str);
  }

  function binStringToHex2(s) {
    const s2 = new Array(s.length);
    let c;

    for (let i = 0, l = s.length; i < l; ++i) {
      c = s.charCodeAt(i);
      s2[i * 2] = (c >> 4).toString(16);
      s2[i * 2 + 1] = (c & 0xf).toString(16);
    }

    return String.prototype.concat.apply("", s2);
  }
};

module.exports = factory;
