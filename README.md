# viewer

A nodejs application to consume your ipcamera video feeds and display on a webpage, also overlaying motion, linecrossing and notification events.

<!-- TABLE OF CONTENTS -->
<details open="open">
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about">About</a></li>
    <li><a href="#features">Features</a></li>
    <li>
      <a href="#installation">Installation</a>
      <ul>
        <li><a href="#docker-compose">Docker Compose</a></li>
      </ul>
    </li>
    <li>
      <a href="#configuration">Configuration</a>
      <ul>
        <li><a href="#example">Example</a></li>
      </ul>
    </li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgements">Acknowledgements</a></li>
  </ol>
</details>

## About
Previously I was using a Hikvision NVR, but this was limited to outputing the video grid to either the VGA or HDMI outputs on the back of the unit.  There was a special "Channel Zero" which could stream the video grid but it was very low resolution.  I had a need to show this video grid at multiple locations around my house.

This project is to allow the video grid to be displayed on a webbrowser.  Tested on Chromium, Chrome & Firefox on linux, this viewer is currently running on Raspberry PI 4's connected to 3 televisions ar required around the house.

The sister project to this viewer, [recorder](https://github.com/opnvr/recorder), actually does the recording of the video sources.

## Features

- Written in nodejs
- No installation necessary - just use docker-compose.
- Stupidly [easy to use](https://github.com/opnvr/viewer#usage)
- Works on Mac, Linux and (maybe) Windows

## Installation

Currently its reccomended to use docker compose to run the application for easy install.  If there is demand for alternate installation types can work on those.

### Docker compose

docker-compose is available for OSX (macOS), Linux and Windows.

Create a docker-compose file similar to below.


```yaml
version: "3.8"
services:
  nvrrviewer:
    image: ghcr.io/opnvr/viewer:latest
    container_name: nvrviewer
    environment:
      - TZ=Australia/Sydney
    volumes:
      - /path/to/config.yaml:/var/app/config.yaml:ro
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
    ports:
      - 8000:8000
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-file: "5"
        max-size: "10m"
```

## Configuration

The following sections exist in the config.yaml file

#### root level

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| sources                    | `[]`               | List of camera sources to be recorded                                       |
| logging                    | `NULL`             | Logging configuration                                                       |
| layout                     | `NULL`             | Mapping the video sources to the grid                                       |

#### sources

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| sources.type               | None               | Type of video source, currently supported types are `RTSP`                  |

#### sources[RTSP]

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| sources.type               | `RTSP`             | Type of video source `RTSP`                                                 |
| sources.id                 | None               | id to be used as folder name to store this source                           |
| sources.ipAddress          | None               | ip address of rtsp camera                                                   |
| sources.authentication     | None               | Optional authentication configuration                                       |

#### sources[RTSP].authentication

| Name                          | Default value      | Description                                                                 |
| ----------------------------- | ------------------ | --------------------------------------------------------------------------- |
| sources.authentication.enable | `true`             | Enable authentication for this source                                       |
| sources.authentication.user   | None               | Username                                                                    |
| sources.authentication.pass   | None               | Password                                                                    |


#### sources[*].notifications

| Name                          | Default value      | Description                                                                 |
| ----------------------------- | ------------------ | --------------------------------------------------------------------------- |
| sources.notifications.type    | `kikvision`        | Hikvision motion & linecrossing notifications                               |

#### logging

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| logging.level              | `warn`             | logging level                                                               |
| logging.ffpmeg             | `warning`          | logging level for ffmpeg                                                    |

```yaml
logging:
  level: warn
  ffmpeg: warning
```

#### layout

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| layout.type                | None               | Screen layout, currently `2x2` or `3x3` layouts exist                       |
| layout.grid                | None               | Array of Array if the ids to be displayed in the position                   |

```yaml
layout:
  type: 3x3
  grid:
    - [ 2, 3, 4 ]
    - [ 5, 6, 7 ]
    - [ 8, 9, 1 ]
```

#### mqtt
TBA


### Example 
config.yaml showing defaults

```yaml
sources:
  - type: rtsp
    id: 2
    uri: rtsp://192.168.1.202/Streaming/Channels/102
    authentication:
      enable: true
      user: myuser
      pass: mypassword
    notifications:
      type: Hikvision

logging:
  level: warn
  ffmpeg: warning

layout:
  type: 3x3
  grid:
    - [ 1, 0, 0 ]
    - [ 0, 0, 0 ]
    - [ 0, 0, 0 ]

mqtt:
  uri: tcp://192.168.1.53
  authentication:
    user: mqttuser
    pass: mqttpassword
```
## Running

Visit the website at the docker-compose machine address port 8000 ie http://192.168.1.53:8000/

![alt-text-1](Screenshot.png "screenshot")

### Known working
The viewer has been tested on the following OS/Browsers
Ubuntu 21.x Chrome >= v92.0 
ubuntu 21.x Firefox >= 91.0
Raspbian 10.x Chromium >= 88.0.4324.187

The following cameras are confirmed working as rtsp sources, most cameras will support RTSP feeds
* Hikvision DS-2CD2343G0-I V5.6.2 build 190701
* Hikvision DS-2CD2142FWD-I V5.5.53 build 180730
* Hikvision DS-2CD2142FWD-IS V5.5.82 build 190220
* Hikvision DS-2CD2342WD-I V5.4.5 build 170124
* Hikvision DS-2CD2365G1-I V5.6.2 build 190701

The following cameras are confirmed working for Hikvision notifications
* Hikvision DS-2CD2343G0-I V5.6.2 build 190701
* Hikvision DS-2CD2142FWD-I V5.5.53 build 180730
* Hikvision DS-2CD2142FWD-IS V5.5.82 build 190220
* Hikvision DS-2CD2342WD-I V5.4.5 build 170124
* Hikvision DS-2CD2365G1-I V5.6.2 build 190701

## Contributing

#### Bug Reports & Feature Requests

Please use the [issue tracker](https://github.com/opnvr/viewer/issues) to report any bugs or file feature requests.

#### Developing

PRs are welcome. To begin developing, do this:

```bash
$ git clone git@github.com:opnvr/viewer.git
$ cd viewer/
$ node index.js
```

## License
Copyright (c) 2021 Tim Bailey  
Licensed under the MIT License. See `LICENSE` for more information.

## Contact
Tim Bailey - timb@bailey9.com
Project Link: [https://github.com/opnvr/viewer](https://github.com/opnvr/viewer)

## Acknowledgements
* Inspired by the proof of concept https://github.com/eventials/poc-mp4-websocket
