/* global luxon */
/* eslint-env browser */

const MSGTYPE = {
  MOTION_START: 50,
  MOTION_END: 51,
  LINECROSS_START: 52,
  LINECROSS_END: 53,
  NOTIFICATION: 60,
  OBJECT: 61,
  RELOAD: 70,
  FTYP_MOOV: 99,
  MP4_DATA: 100,
};

(function () {
  setInterval(() => {
    const span = document.querySelector(".infobar span.clock");
    span.innerHTML = luxon.DateTime.local().toFormat("HH:mm:ss");
  }, 1000);

  const sources = new Map();

  const lastMessage = new Map();
  function checkLastMessage() {
    lastMessage.forEach((value, id) => {
      const sinceLastMessage = Date.now() - value;
      console.log(`Checking id ${id} @ ${value} (${sinceLastMessage}ms)`);

      const source = sources.get(id);
      if (source && source.showStalled) {
        source.showStalled(sinceLastMessage > 5000);
      }
    });
    setTimeout(() => {
      checkLastMessage();
    }, 10000);
  }
  setTimeout(() => {
    checkLastMessage();
  }, 10000);

  const timeoutList = new Map();
  function scheduleSelectorRemoval(id, selector, timeout) {
    const existing = timeoutList.get(id);
    if (existing == null) {
      timeoutList.set(id, { selector, after: Date.now() + timeout });
    } else {
      existing.after = Date.now() + timeout;
    }
  }
  setInterval(() => {
    const t = Date.now();
    timeoutList.forEach((value, key) => {
      console.log("Checking for timeout", { key, value });
      if (t > value.after) {
        timeoutList.delete(key);
        const existingElement = document.querySelectorAll(value.selector);
        if (existingElement) {
          existingElement.forEach((n) => n.remove());
        }
        console.log("Removed", key);
      }
    });
  }, 2000);

  const decoder = new TextDecoder();

  function videoSource(id, selector) {
    let buffer;
    let motion = false;

    // Pre alloc buffer due updating delay
    const bufferSize = 5 * 1024 * 1024;
    let bufferIndex = 0;
    let fragMp4Buffer = new Uint8Array(bufferSize);
    const vp = document.querySelector(selector);

    if (!vp) {
      return;
    }

    const video = document.createElement("video");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    vp.appendChild(video);

    if (!video) {
      return;
    }
    const mediaSource = new MediaSource();

    video.src = window.URL.createObjectURL(mediaSource);
    video.playbackRate = 1.06;

    mediaSource.addEventListener(
      "sourceopen",
      function (e) {
        buffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
        buffer.mode = "sequence";
      },
      false,
    );

    console.log("Play");
    video
      .play()
      .then((a) => {
        console.log("Playing", a);
      })
      .catch((err) => {
        console.error("Failed", err);
      });

    // Set interval to keep making sure video player is as close to the end ie realtime as possible
    setInterval(() => {
      if (video.seekable.length) {
        const seekableEnd = video.seekable.end(video.seekable.length - 1);
        if (seekableEnd - video.currentTime > 3) {
          video.currentTime = seekableEnd;
        }
      }

      if (buffer && buffer.buffered && buffer.buffered.length) {
        const bufferedLength =
          buffer.buffered.end(0) - buffer.buffered.start(0);
        if (!buffer.updating && bufferedLength > 60) {
          buffer.remove(
            buffer.buffered.start(0),
            buffer.buffered.start(0) + bufferedLength / 2,
          );
        }
      }
    }, 5000);

    return {
      showStalled: (show) => {
        const span = document.querySelector(selector + " > span.stalled");
        if (show) {
          console.log("showStalled");
          span.style.display = "block";
        } else {
          span.style.display = "none";
        }
      },

      handleData: (msgtype, data) => {
        console.debug("handleData", selector, msgtype);

        if (msgtype === MSGTYPE.MOTION_START) {
          // Motion start
          console.log(`Camera ${id} motion start`);
          if (!motion) {
            motion = true;
            setTimeout(() => {
              const span = document.querySelector(selector + " > span.status");
              span.innerHTML = "";
              motion = false;
            }, 10000);
            playSound("motion.mp3", 0.25);
            const span = document.querySelector(selector + " > span.status");
            span.innerHTML = "MOTION";
          }
          return;
        }

        if (msgtype === MSGTYPE.MOTION_END) {
          // Motion end
          console.log(`Camera ${id} motion end`);
          motion = false;
          const span = document.querySelector(selector + " > span.status");
          span.innerHTML = "";
          return;
        }

        if (msgtype === MSGTYPE.LINECROSS_START) {
          // line cross start
          console.log(`Camera ${id} line cross start`);
          if (!motion) {
            motion = true;
            setTimeout(() => {
              const span = document.querySelector(
                selector + " > span.linecross",
              );
              span.innerHTML = "";
              motion = false;
            }, 10000);
            playSound("linecross.mp3");
            const span = document.querySelector(selector + " > span.linecross");
            span.innerHTML = "LINE";
          }
          return;
        }

        if (msgtype === MSGTYPE.LINECROSS_END) {
          // line cross end
          console.log(`Camera ${id} line cross end`);
          motion = false;
          const span = document.querySelector(selector + " > span.linecross");
          span.innerHTML = "";
          return;
        }

        if (msgtype === MSGTYPE.NOTIFICATION) {
          // Notification
          setTimeout(() => {
            const span = document.querySelector(selector + " > span.notify");
            span.style.display = "none";
          }, 10000);
          const span = document.querySelector(selector + " > span.notify");

          const payload = JSON.parse(decoder.decode(data));

          span.innerHTML = payload.message;
          span.style.display = "block";

          console.log(payload);
          playSound("mqtt.mp3");

          return;
        }

        if (msgtype === MSGTYPE.OBJECT) {
          const payload = JSON.parse(decoder.decode(data));

          console.log("OBJECT", payload);
          // Find the span with the id & delete
          // Add a new span
          // Translate box 640x360

          const widthRatio = vp.clientWidth / 640;
          const heightRatio = vp.clientHeight / 360;

          const existingSpan = document.getElementById(payload.id);
          if (existingSpan) {
            existingSpan.remove();
          }

          if (!payload.endTime) {
            const objectSpan = document.createElement("span");
            const labelSpan = document.createElement("label");
            labelSpan.innerText = payload.label;
            objectSpan.appendChild(labelSpan);
            objectSpan.setAttribute("id", payload.id);
            objectSpan.setAttribute("class", "object");
            const [x1, y1, x2, y2] = payload.box;
            objectSpan.setAttribute(
              "style",
              `left: ${Math.trunc(x1 * widthRatio)}px; top: ${Math.trunc(y1 * heightRatio)}px; width: ${Math.trunc((x2 - x1) * widthRatio)}px; height: ${Math.trunc((y2 - y1) * heightRatio)}px`,
            );
            vp.appendChild(objectSpan);
            scheduleSelectorRemoval(
              payload.id,
              "span#" + CSS.escape(payload.id),
              10000,
            );
          }

          return;
        }

        if (msgtype === MSGTYPE.RELOAD) {
          location.reload();
          return;
        }

        if (msgtype === MSGTYPE.FTYP_MOOV) {
          // ftyp_moov, reset sourceBuffer
          bufferIndex = 0;
          fragMp4Buffer = new Uint8Array(bufferSize);
          if (buffer) {
            buffer.abort();
          }
        }

        if (bufferIndex + data.length <= bufferSize) {
          fragMp4Buffer.set(data, bufferIndex);
          bufferIndex = bufferIndex + data.length;

          if (buffer && !buffer.updating && mediaSource.readyState === "open") {
            const appended = fragMp4Buffer.slice(0, bufferIndex);

            buffer.appendBuffer(appended);

            fragMp4Buffer.fill(0);
            bufferIndex = 0;
          }
        }
      },
    };
  }

  function startVideoSource(postion, id) {
    if (id > 0) {
      sources.set(id, videoSource(id, ".vp" + postion));
    }
  }

  function startiFrameSource(position, id, uri) {
    const selector = ".vp" + position;
    const vp = document.querySelector(selector);

    if (!vp) {
      console.log("No vp found", position);
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", uri);
    vp.appendChild(iframe);
    console.log("Done");

    sources.set(id, {
      handleData: (msgType, data) => {
        console.log("handleData iFrame", { msgType, data });

        if (msgType === MSGTYPE.NOTIFICATION) {
          // Notification
          setTimeout(() => {
            const span = document.querySelector(selector + " > span.notify");
            span.style.display = "none";
          }, 10000);
          const span = document.querySelector(selector + " > span.notify");

          const payload = JSON.parse(decoder.decode(data));

          span.innerHTML = payload.message;
          span.style.display = "block";

          console.log(payload);
          if (payload.type === "alert") {
            playSound("alert.mp3");
          } else {
            playSound("mqtt.mp3");
          }
        }
      },
    });
  }

  function startSource(sources, position, id) {
    if (id > 0) {
      const source = sources.find((s) => s.id === id);
      switch (source.type) {
        case "rtsp":
          startVideoSource(position, id);
          break;
        case "iframe":
          startiFrameSource(position, id, source.uri);
          break;
      }
    }
  }

  fetch("/api/config").then((result) => {
    return result.json().then((data) => {
      console.log("loaded config", data);

      if (data.layout) {
        console.log("layout", data.layout);

        let rows = 0;
        let cols = 0;
        switch (data.layout.type) {
          case "2x2":
            rows = 2;
            cols = 2;
            startSource(data.sources, 1, data.layout.grid[0][0]);
            startSource(data.sources, 2, data.layout.grid[0][1]);

            startSource(data.sources, 3, data.layout.grid[1][0]);
            startSource(data.sources, 4, data.layout.grid[1][1]);
            break;
          case "3x3":
            rows = 3;
            cols = 3;

            startSource(data.sources, 1, data.layout.grid[0][0]);
            startSource(data.sources, 2, data.layout.grid[0][1]);
            startSource(data.sources, 3, data.layout.grid[0][2]);

            startSource(data.sources, 4, data.layout.grid[1][0]);
            startSource(data.sources, 5, data.layout.grid[1][1]);
            startSource(data.sources, 6, data.layout.grid[1][2]);

            startSource(data.sources, 7, data.layout.grid[2][0]);
            startSource(data.sources, 8, data.layout.grid[2][1]);
            startSource(data.sources, 9, data.layout.grid[2][2]);
            break;
          case "4x3":
            rows = 3;
            cols = 4;

            startSource(data.sources, 1, data.layout.grid[0][0]);
            startSource(data.sources, 2, data.layout.grid[0][1]);
            startSource(data.sources, 3, data.layout.grid[0][2]);
            startSource(data.sources, 4, data.layout.grid[0][3]);

            startSource(data.sources, 5, data.layout.grid[1][0]);
            startSource(data.sources, 6, data.layout.grid[1][1]);
            startSource(data.sources, 7, data.layout.grid[1][2]);
            startSource(data.sources, 8, data.layout.grid[1][3]);

            startSource(data.sources, 9, data.layout.grid[2][0]);
            startSource(data.sources, 10, data.layout.grid[2][1]);
            startSource(data.sources, 11, data.layout.grid[2][2]);
            startSource(data.sources, 12, data.layout.grid[2][3]);
        }

        function computeRowHeight() {
          const windowRatio = window.innerWidth / window.innerHeight;

          let rowHeight = (window.innerHeight - 35) / rows;
          if (windowRatio < 1) {
            // Add extra 40% height
            rowHeight = (window.innerWidth / cols) * windowRatio * 1.4;
          }
          console.log("rows", { rows, rowHeight, windowRatio });
          return rowHeight;
        }

        const styleSheet = document.head.querySelector("style").sheet;
        let index = styleSheet.insertRule(
          `.box { height: ${computeRowHeight()}px; }`,
        );
        window.addEventListener("resize", () => {
          styleSheet.deleteRule(index);
          index = styleSheet.insertRule(
            `.box { height: ${computeRowHeight()}px; }`,
          );
        });
      }
    });
  });

  function connect() {
    const websocket = new WebSocket(
      "ws://" + document.location.hostname + ":8000",
    );
    websocket.binaryType = "arraybuffer";

    websocket.addEventListener(
      "message",
      function (e) {
        const o = new Uint8Array(e.data);
        const id = o.slice(0, 1)[0];
        const msgtype = o.slice(1, 2)[0];
        const data = o.slice(2);

        lastMessage.set(id, Date.now());

        console.debug("Got data " + msgtype, {
          id,
          msgtype,
          length: data.length,
        });
        if (data.length) {
          const source = sources.get(id);
          if (source) {
            source.handleData(msgtype, data);
          }
        }
      },
      false,
    );

    websocket.addEventListener("open", function (event) {
      console.log("WS Connected!");
    });

    websocket.addEventListener("close", function (e) {
      console.log("WS Disconnected!, retry in 5 secs");
      setTimeout(() => connect(), 5000);
    });
  }

  connect();

  // reload page every night
  const today = new Date();
  const tommorow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );
  const timeToMidnight = tommorow - today;
  setTimeout(() => location.reload(), timeToMidnight);
})();

function playSound(file, volume) {
  const audio = new Audio(file);
  audio.volume = volume || 1;
  audio.play().catch((err) => {
    console.warn("Unable to play sound", err);
  });
}
