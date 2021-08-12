# recorder

A nodejs application to consume your ipcamera video feeds and save to disk.

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

The sister project to this recorder, [viewer](https://github.com/opnvr/viewer), suits my needs by allowing the video grid to be displayed on a webbrowser.  Tested on Chromium, Chrome & Firefox on linux, this viewer is currently running on Raspberry PI 4's connected to 3 televisions ar required around the house.

Now that the viewer has replaced the Hikvision nvr, I needed to also actually record the video, and as such this project was born.

## Features

- Written in nodejs
- No installation necessary - just use docker-compose.
- Stupidly [easy to use](https://github.com/opnvr/recorder#usage)
- Works on Mac, Linux and (maybe) Windows
- Simple file retention mechanism, with plans for more sophisticated retentions.

## Installation

Currently its reccomended to use docker compose to run the application for easy install.  If there is demand for alternate installation types can work on those.

### Docker compose

docker-compose is available for OSX (macOS), Linux and Windows.

Create a docker-compose file similar to below.


```yaml
version: "3.8"
services:
  nvrrecorder:
    image: ghcr.io/opnvr/recorder:latest
    container_name: nvrrecorder
    environment:
      - TZ=Australia/Sydney
    volumes:
      - /path/to/config.yaml:/var/app/config.yaml:ro
      - /video:/video
      - /etc/timezone:/etc/timezone:ro
      - /etc/localtime:/etc/localtime:ro
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
| output                     | `/video`           | Root folder that the recorded video will be stored                          |

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

#### logging

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| logging.level              | `warn`             | logging level                                                               |
| logging.ffpmeg             | `warning`          | logging level for ffmpeg                                                    |

#### output

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| output.rootFolder          | `/video`           | Root folder to save video files                                             |
| output.retention           |                    | Retention pluging                                                           |

#### output.retention[simple]

| Name                       | Default value      | Description                                                                 |
| -------------------------- | ------------------ | --------------------------------------------------------------------------- |
| output.retention.type      | `simple`           | Simple Retention that removes video files older than duration               |
| output.retention.duration  | `P1D` 1 day        | Retention duration in ISO 8601 duration format.                             |

### Example 
config.yaml showing defaults

```yaml
sources:
  - type: RTSP
    id: Cam02
    ipAddress: 192.168.1.202
    authentication:
      enable: true
      user: myuser
      pass: mypassword

logging:
  level: warn
  ffmpeg: warning

output:
  rootFolder: '/video'
  retention:
    type: simple
    duration: P5D
```

## Contributing

#### Bug Reports & Feature Requests

Please use the [issue tracker](https://github.com/opnvr/recorder/issues) to report any bugs or file feature requests.

#### Developing

PRs are welcome. To begin developing, do this:

```bash
$ git clone git@github.com:opnvr/recorder.git
$ cd recorder/
$ node index.js
```

## License
Copyright (c) 2021 Tim Bailey  
Licensed under the MIT License. See `LICENSE` for more information.

## Contact
Tim Bailey - timb@bailey9.com
Project Link: [https://github.com/opnvr/recorder](https://github.com/opnvr/recorder)

## Acknowledgements
* Inspired by the proof of concept https://github.com/eventials/poc-mp4-websocket
